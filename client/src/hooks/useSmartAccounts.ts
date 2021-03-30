import { DCAAccount } from "app-domain";
import { ethAddress } from "consts";
import { Contract, ethers } from "ethers";
import createDCAContract, { CreateDCAContractPayload } from "lib/createDCAContract";
import getAAveResolverContract from "lib/getAAveResolverContract";
import getERC20Contract from "lib/getERC20Contract";
import getSmartAccountContract from "lib/getSmartAccountContract";
import { Contracts } from "lib/instantiateContracts";
import sleep from "lib/sleep";
import { useEffect, useState } from "react";

import DCAAccountArtifact from "../contracts/DCAAccount.json";
import IERC20Artifact from "../contracts/IERC20.json";

export default (provider: ethers.providers.Web3Provider | undefined, contracts: Contracts | undefined, selectedAddress: string, syncBalance: () => Promise<any>) => {
  const [smartAccounts, setSmartAccounts] = useState<DCAAccount[]>([])
  const [activeSmartAccountAddress, setActiveSmartAccountAddress] = useState<string>("")
  let [dcaAccount, setDcaAccount] = useState<Contract>();
  const [activeSmartAccount, setActiveSmartAccount] = useState<DCAAccount>()
  const [loadingDCA, setLoadingDCA] = useState<boolean>(false);
  const [loadingRefresh, setLoadingRefresh] = useState<boolean>(false);

  useEffect(() => {
    setLoadingDCA(true);

    setActiveSmartAccountAddress("");
    setSmartAccounts([])

    getDCAAccounts()
      .then(async dcaAccounts => {
        setSmartAccounts(dcaAccounts)
        setLoadingDCA(false);
      })


  }, [selectedAddress])

  useEffect(() => {
    if (!activeSmartAccountAddress || !provider) {
      setActiveSmartAccount(undefined)
      return
    }

    const smartAccount = smartAccounts.find(account => account.address === activeSmartAccountAddress)

    if (!smartAccount) {
      setActiveSmartAccount(undefined)
      return
    }

    setDcaAccount(getSmartAccountContract(provider, activeSmartAccountAddress))
    setActiveSmartAccount(smartAccount)
  }, [activeSmartAccountAddress])

  async function loadAccount(address: string): Promise<DCAAccount> {
    const dcaAccount = new ethers.Contract(address, DCAAccountArtifact.abi, provider)

    const timeRef = await dcaAccount.timeRef()
    const token = await dcaAccount.token()
    const depositAmount = await dcaAccount.depositAmount()
    const period = await dcaAccount.period()

    const ethBalance = await provider?.getBalance(address)
    let tokenBalance;
    let liquidityPoolAmount;

    if (token == ethAddress) {
      tokenBalance = ethBalance
    } else {
      const erc20 = new ethers.Contract(token, IERC20Artifact.abi, provider)
      tokenBalance = await erc20.balanceOf(address)
    }

    if (provider) {
      const aaveResolver = getAAveResolverContract(provider)

      const aavePosition = await aaveResolver.getPosition(address, [token])

      liquidityPoolAmount = aavePosition[1].totalCollateralETH
    }

    return {
      address,
      timeRef: new Date(+timeRef * 1000),
      period: +period,
      token,
      tokenBalance: +ethers.utils.formatEther(tokenBalance),
      ethBalance: ethBalance ? +ethers.utils.formatEther(ethBalance) : 0,
      depositAmount: +ethers.utils.formatEther(depositAmount),
      liquidityPoolAmount: +ethers.utils.formatEther(liquidityPoolAmount)
    }
  }

  async function getDCAAccounts(): Promise<DCAAccount[]> {
    if (!contracts) {
      return Promise.resolve([])
    }

    const smartAccounts = await contracts.dsaResolver.getAuthorityAccounts(selectedAddress);

    return Promise.all(
      smartAccounts.map(loadAccount)
    )
  }

  const selectSmartAccount = (address: string) => {
    setActiveSmartAccountAddress(address)
    setDcaAccount(new ethers.Contract(address, DCAAccountArtifact.abi, provider?.getSigner(0)))
  }

  const syncSmartAccounts = async () => {
    let poll = 20;
    while (poll--) {
      await sleep(2000);
      let currentSmartAccounts = await getDCAAccounts();

      if (!smartAccounts || currentSmartAccounts.length !== smartAccounts.length) {
        setSmartAccounts(currentSmartAccounts);
        return;
      }
    }
  }

  const buildDCAAccount = async (payload: CreateDCAContractPayload): Promise<any> => {
    if (!contracts) {
      return
    }

    await createDCAContract(contracts.instaIndex, selectedAddress, payload)

    await syncSmartAccounts();
  }

  const getTokenBalance = async (): Promise<number> => {
    if (!activeSmartAccountAddress || !provider) {
      return 0
    }

    const dcaAccount = getSmartAccountContract(provider, activeSmartAccountAddress)

    const token = await (await dcaAccount.token()).toString();
    let tokenBalance

    if (token && token !== ethAddress) {
      const tokenContract = getERC20Contract(provider, token)
      tokenBalance = await (await tokenContract.balanceOf(activeSmartAccountAddress)).toString()

      return +ethers.utils.formatEther(tokenBalance)
    } else if (token == ethAddress) {
      const ethBalance = (await provider.getBalance(activeSmartAccountAddress)).toString()

      return +ethers.utils.formatEther(ethBalance);
    }

    return 0
  }

  const getLiquidityPoolBalance = async (token: string): Promise<number> => {
    if (!activeSmartAccountAddress || !provider) {
      return 0
    }

    const aaveResolver = getAAveResolverContract(provider)

    const aavePosition = await aaveResolver.getPosition(activeSmartAccountAddress, [token])

    return +ethers.utils.formatEther(aavePosition[1].totalCollateralETH)
  }

  const syncAccountTokenBalance = async () => {
    const saIndex = smartAccounts.map(a => a.address).indexOf(activeSmartAccountAddress)

    if (saIndex >= 0) {
      const tokenBalance = await getTokenBalance()

      const smartAccountsClone = [...smartAccounts]

      const activeSmartAccount = {
        ...smartAccountsClone[saIndex],
        tokenBalance
      }
      smartAccountsClone[saIndex] = activeSmartAccount

      setSmartAccounts(smartAccountsClone)
      setActiveSmartAccount(activeSmartAccount)
    }
  }

  const syncAccountLiqPoolBalance = async () => {
    const saIndex = smartAccounts.map(a => a.address).indexOf(activeSmartAccountAddress)

    if (saIndex >= 0) {
      const tokenBalance = await getTokenBalance()
      const liquidityPoolAmount = await getLiquidityPoolBalance(smartAccounts[saIndex].token)

      const smartAccountsClone = [...smartAccounts]

      const activeSmartAccount = {
        ...smartAccountsClone[saIndex],
        tokenBalance,
        liquidityPoolAmount
      }

      smartAccountsClone[saIndex] = activeSmartAccount

      setSmartAccounts(smartAccountsClone)
      setActiveSmartAccount(activeSmartAccount)
    }
  }

  const depositToken = async (amount: string): Promise<any> => {
    if (!provider || !activeSmartAccount || !dcaAccount) {
      return
    }

    const tx = await dcaAccount.deposit(
      activeSmartAccount.token,
      ethers.utils.parseEther(amount),
      0,
      0, {
      value: ethers.utils.parseEther(amount)
    });

    await provider.waitForTransaction(tx.hash)

    syncAccountTokenBalance()
    syncBalance()
  }

  const withdrawToken = async (amount: string): Promise<any> => {
    if (!provider || !activeSmartAccount || !dcaAccount) {
      return
    }

    const tx = await dcaAccount.withdraw(
      activeSmartAccount.token,
      ethers.utils.parseEther(amount),
      selectedAddress,
      0,
      0
    )

    await provider.waitForTransaction(tx.hash)

    syncAccountTokenBalance()
    syncBalance()
  }

  const depositLiquidityPool = async (amount: string): Promise<any> => {
    if (!provider || !activeSmartAccount || !dcaAccount) {
      return
    }

    const tx = await dcaAccount.depositLiquidityPool(
      activeSmartAccount.token,
      ethers.utils.parseEther(amount),
      0,
      0);

    await provider.waitForTransaction(tx.hash)

    syncAccountLiqPoolBalance()
  }

  const withdrawLiquidityPool = async (amount: string): Promise<any> => {
    if (!provider || !activeSmartAccount || !dcaAccount) {
      return
    }

    const tx = await dcaAccount.withdrawLiquidityPool(
      activeSmartAccount.token,
      ethers.utils.parseEther(amount),
      0,
      0);

    await provider.waitForTransaction(tx.hash)

    syncAccountLiqPoolBalance()
  }

  const refresh = async () => {
    setLoadingRefresh(true);
    setLoadingDCA(true);

    const dcaAccounts = await getDCAAccounts()

    setSmartAccounts(dcaAccounts)
    setLoadingDCA(false);

    const activeSmartAccount = smartAccounts.find(a => a.address === activeSmartAccountAddress)

    if (activeSmartAccount) {
      setActiveSmartAccount(activeSmartAccount)
    }
    setLoadingRefresh(false);
  }

  return {
    activeSmartAccount,
    smartAccounts,
    loadingDCA,
    loadingRefresh,
    buildDCAAccount,
    selectSmartAccount,
    depositToken,
    withdrawToken,
    depositLiquidityPool,
    withdrawLiquidityPool,
    refresh
  };
}
