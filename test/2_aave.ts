import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { Contract, utils } from "ethers";
import { ethers } from 'hardhat';

import DCAAccountABI from '../artifacts/contracts/DCAAccount.sol/DCAAccount.json'
import ConnectAaveABI from '../artifacts/contracts/ConnectAaveV2.sol/ConnectAaveV2.json';
import IERC20ABI from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json'
import { deployContracts } from "../scripts/deploy-contracts/deploy-contracts";

describe("Aave", () => {

  const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";

  // Signer
  let signer: SignerWithAddress;
  let signerAddress: string;

  // Contracts
  let instaIndex: Contract;
  let instaList: Contract;
  let instaConnectors: Contract;
  let dcaAccount: Contract;

  // Resolvers
  let instaDSAResolver: Contract;
  let aaveResolver: Contract;

  // Tokens
  let dai: Contract;

  // Smart Account
  let smartAccount: Contract;
  let smartAccountAddress = "0xeb2cA376e44deB977B79b2f24994275d3B443753"; // instaIndex.createClone alawys generates this smartAccount address at first time

  before(async () => {
    const signers = await ethers.getSigners();
    signer = signers[2];
    signerAddress = await signer.getAddress()

    dai = await ethers.getContractAt(IERC20ABI.abi, daiAddress);

    const contracts = await deployContracts()

    instaIndex = contracts.getContractByName("InstaIndex").connect(signer);
    instaList = contracts.getContractByName("InstaList").connect(signer);
    instaConnectors = contracts.getContractByName("InstaConnectors").connect(signer);
    dcaAccount = contracts.getContractByName("DCAAccount").connect(signer);
    instaDSAResolver = contracts.getContractByName("InstaDSAResolver").connect(signer);
    aaveResolver = contracts.getContractByName("InstaAaveV2Resolver").connect(signer)

    let currentVersion = await instaIndex.versionCount()
    const period = 60 * 60;
    await expect(
      instaIndex.build(signerAddress, currentVersion, ethAddress, ethers.utils.parseEther("0.5"), period, signerAddress)
    ).to.emit(instaIndex, "LogAccountCreated")
      .withArgs(signerAddress, signerAddress, smartAccountAddress, signerAddress)

    await signer.sendTransaction({
      to: smartAccountAddress,
      value: ethers.utils.parseEther("5")
    })

    smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer)

    await expect(
      await smartAccount.isAuth(signerAddress)
    ).to.be.equal(true)
  })


  it("should deposit eth in aave", async () => {
    const rangeLow = 4.9
    const smartAccountBalance = +ethers.utils.formatEther(await ethers.provider.getBalance(smartAccountAddress))
    const rangeHigh = 5.1
    expect(
      smartAccountBalance
    ).to.
      greaterThan(rangeLow).
      lessThan(rangeHigh)

    await expect(
      smartAccount.depositLiquidityPool(
        ethAddress,
        ethers.utils.parseEther("1"),
        0,
        0)
    ).to.emit(smartAccount, "LogLiquidityPoolDeposit")

    const smartAccountBalanceAfterDeposit = +ethers.utils.formatEther(await ethers.provider.getBalance(smartAccountAddress))
    expect(
      smartAccountBalanceAfterDeposit
    ).to.
      greaterThan(rangeLow - 1).
      lessThan(rangeHigh - 1)

  }).timeout(30000)

  it("should show eth deposited in aave", async () => {
    const aavePosition = await aaveResolver.getPosition(smartAccountAddress, [ethAddress])

    // console.log(ethers.utils.formatEther(aavePosition[1][0]))
    // console.log(ethers.utils.formatEther(aavePosition[1][1]))
    // console.log(ethers.utils.formatEther(aavePosition[1][2]))
    // console.log(ethers.utils.formatEther(aavePosition[1][3]))
    // console.log(ethers.utils.formatEther(aavePosition[1][4]))
    // console.log(ethers.utils.formatEther(aavePosition[1][5]))
    // console.log(ethers.utils.formatEther(aavePosition[1][6]))

    // console.log(ethers.utils.formatEther(aavePosition[1].totalCollateralETH))
    // console.log(ethers.utils.formatEther(aavePosition[1].totalBorrowsETH))
    // console.log(ethers.utils.formatEther(aavePosition[1].availableBorrowsETH))
    // console.log(ethers.utils.formatEther(aavePosition[1].currentLiquidationThreshold))
    // console.log(ethers.utils.formatEther(aavePosition[1].ltv))
    // console.log(ethers.utils.formatEther(aavePosition[1].healthFactor))
    // console.log(ethers.utils.formatEther(aavePosition[1].ethPriceInUsd))

    expect(+ethers.utils.formatEther(aavePosition[1].totalCollateralETH)).to.
      greaterThan(0.99).
      lessThan(1.01)
  })

  it("should withdraw from aave", async () => {
    const rangeLow = 3.9
    const smartAccountBalance = +ethers.utils.formatEther(await ethers.provider.getBalance(smartAccountAddress))
    const rangeHigh = 4.1
    expect(
      smartAccountBalance
    ).to.
      greaterThan(rangeLow).
      lessThan(rangeHigh)

    await expect(
      smartAccount.withdrawLiquidityPool(  ethAddress,
        ethers.utils.parseEther("0.5"),
        0,
        0)
    ).to.emit(smartAccount, "LogLiquidityPoolWithdraw")

    const smartAccountBalanceAfterDeposit = +ethers.utils.formatEther(await ethers.provider.getBalance(smartAccountAddress))
    expect(
      smartAccountBalanceAfterDeposit
    ).to.
      greaterThan(rangeLow + 0.5).
      lessThan(rangeHigh + 0.5)
  })

  it("should show eth after withdraw in aave", async () => {
    const aavePosition = await aaveResolver.getPosition(smartAccountAddress, [ethAddress])

    expect(+ethers.utils.formatEther(aavePosition[1].totalCollateralETH)).to.
      greaterThan(0.49).
      lessThan(0.51)
  })

})
