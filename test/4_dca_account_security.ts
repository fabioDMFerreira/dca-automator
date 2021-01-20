import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { Contract } from "ethers";
import { ethers, waffle } from 'hardhat';

import DCAAccountABI from '../artifacts/contracts/DCAAccount.sol/DCAAccount.json'
import IERC20ABI from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json'
import { deployContracts } from "../scripts/deploy-contracts/deploy-contracts";

describe("Protect dca account", () => {

  const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";

  // Signer
  let signer: SignerWithAddress;
  let signer2: SignerWithAddress;
  let signerAddress: string;
  let signerAddress2: string;

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
  let smartAccountAddress = "0xeb2cA376e44deB977B79b2f24994275d3B443753"; // instaIndex.createClone alawys generates this smartAccount address at first time


  before(async () => {
    const signers = await ethers.getSigners();
    signer = signers[1];
    signer2 = signers[2];
    signerAddress = await signer.getAddress()
    signerAddress2 = await signer.getAddress()

    dai = await ethers.getContractAt(IERC20ABI.abi, daiAddress);

    const contracts = await deployContracts()

    instaIndex = contracts.getContractByName("InstaIndex").connect(signer);
    instaList = contracts.getContractByName("InstaList").connect(signer);
    instaConnectors = contracts.getContractByName("InstaConnectors").connect(signer);
    dcaAccount = contracts.getContractByName("DCAAccount").connect(signer);
    instaDSAResolver = contracts.getContractByName("InstaDSAResolver").connect(signer);
    aaveResolver = contracts.getContractByName("InstaAaveV2Resolver").connect(signer)


    let currentVersion = await instaIndex.versionCount();
    const period = 60 * 60;
    await expect(
      instaIndex.build(signerAddress, currentVersion, ethAddress, ethers.utils.parseEther("0.5"), period, signerAddress)
    ).to.emit(instaIndex, "LogAccountCreated")
      .withArgs(signerAddress, signerAddress, smartAccountAddress, signerAddress)

    await signer.sendTransaction({
      to: smartAccountAddress,
      value: ethers.utils.parseEther("2")
    })


  })

  it("withdraw should fail if the user is not allowed", async () => {
    const smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer2)

    await expect(
      smartAccount.withdraw(
        ethAddress,
        ethers.utils.parseEther("0.5").toString(),
        signerAddress2,
        0,
        0
      )
    ).to.be.revertedWith("permission-denied")

  })

  it("withdraw should work if the user is enabled", async () => {
    const smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer)

    await expect(
      smartAccount.withdraw(
        ethAddress,
        ethers.utils.parseEther("0.5").toString(),
        signerAddress2,
        0,
        0
      )
    ).to.emit(smartAccount, "LogWithdraw")

  })

  it("dca should fail if the user is not allowed", async () => {
    const smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer2)

    const timeRef = await smartAccount.timeRef();
    await waffle.provider.send("evm_setNextBlockTimestamp", [+timeRef + 1000]);

    await expect(
      smartAccount.dca(signerAddress2)
    ).to.be.revertedWith("permission-denied")

  })

  it("dca should work if the user is enabled", async () => {
    const smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer)

    const timeRef = await smartAccount.timeRef();
    await waffle.provider.send("evm_setNextBlockTimestamp", [+timeRef + 2000]);

    await expect(
      smartAccount.dca(signerAddress)
    ).to.emit(smartAccount, "LogCast")
  }).timeout(30000)

  it("setIndex should fail even if signer is the account creator", async () => {
    const smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer)

    await expect(
      smartAccount.setIndex(signerAddress)
    ).to.be.revertedWith("permission-denied")
  })

  it("depositLiquidityPool should fail if signer is not the account creator", async () => {
    const smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer2)

    await expect(
      smartAccount.depositLiquidityPool(ethAddress,
        ethers.utils.parseEther("0.5"),
        0,
        0)
    ).to.be.revertedWith("permission-denied")
  })

  it("depositLiquidityPool should work if signer is the account creator", async () => {
    const smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer)

    await expect(
      smartAccount.depositLiquidityPool(ethAddress,
        ethers.utils.parseEther("0.5"),
        0,
        0)
    ).to.emit(smartAccount,"LogLiquidityPoolDeposit")
  })

  it("withdrawLiquidityPool should fail if signer is not the account creator", async () => {
    const smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer2)

    await expect(
      smartAccount.withdrawLiquidityPool(ethAddress,
        ethers.utils.parseEther("0.5"),
        0,
        0)
    ).to.be.revertedWith("permission-denied")
  })

})
