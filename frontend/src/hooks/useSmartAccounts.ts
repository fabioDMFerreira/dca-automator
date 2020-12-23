import { Contract, ethers } from "ethers";
import { Contracts } from "lib/instantiateContracts";
import sleep from "lib/sleep";
import { useEffect, useState } from "react";

import DCAAccountArtifact from "../contracts/DCAAccount.json";

export default (provider: ethers.providers.Web3Provider, contracts: Contracts | undefined, selectedAddress: string) => {
  const [smartAccounts, setSmartAccounts] = useState<string[]>([])
  const [activeSmartAccount, setActiveSmartAccount] = useState<string>("")
  const [activeAccountContract,setActiveAccountContract] = useState<Contract>();

  useEffect(() => {
    getSmartAccounts()
      .then(smartAccounts => {
        setSmartAccounts(smartAccounts)
      })

  }, [selectedAddress])

  async function getSmartAccounts(): Promise<string[]> {
    if (!contracts) {
      return Promise.resolve([])
    }

    let smartAccounts = []

    const userLink = await contracts.instaList.userLink(selectedAddress)

    const userList = await contracts.instaList.userList(selectedAddress, userLink.first)
    let userListNext = userList.next

    while (userListNext.toString() != "0") {
      let userList = await contracts.instaList.userList(selectedAddress, userListNext);
      userListNext = userList.next;
      const accountAddress = await contracts.instaList.accountAddr(userList[0])
      smartAccounts.push(accountAddress.toString())
    }

    return smartAccounts;
  }

  const selectSmartAccount = (address: string) => {
    setActiveSmartAccount(address)
    setActiveAccountContract(new ethers.Contract(address, DCAAccountArtifact.abi, provider?.getSigner(0)))
  }

  const checkAddressIsAuthorized = (address: string) => {
    if(!activeAccountContract){
      return false
    }
    return activeAccountContract.isAuth(address);
  }

  const addSmartAccount = async function addSmartAccount() {
    if (!contracts) {
      return
    }

    const versionAccount = await contracts.instaIndex.versionCount()

    await contracts.instaIndex.build(selectedAddress, versionAccount, 60, selectedAddress)

    let poll = 10;
    while (poll--) {
      await sleep(2000);
      let currentSmartAccounts = await getSmartAccounts();

      if (!smartAccounts || currentSmartAccounts.length !== smartAccounts.length) {
        setSmartAccounts(smartAccounts);
        return;
      }
    }
  }

  return {
    smartAccounts,
    activeSmartAccount,
    addSmartAccount,
    selectSmartAccount,
    checkAddressIsAuthorized
  }
}
