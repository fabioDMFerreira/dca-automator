import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { Contract, utils } from "ethers";
import { ethers, waffle } from 'hardhat';

import DCAAccountABI from '../artifacts/contracts/DCAAccount.sol/DCAAccount.json'
import ConnectBasicABI from '../artifacts/contracts/ConnectBasic.sol/ConnectBasic.json'
import IERC20ABI from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json'

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

  // Connectors
  let connectBasic: Contract;
  let aave: Contract;

  // Tokens
  let dai: Contract;

  // Smart Account
  let smartAccount: Contract;
  let smartAccountAddress = "0xFE3d243Ccf7f2153c2D596eD0c5EACbC01B1433A"; // instaIndex.createClone alawys generates this smartAccount address at first time
  let smartAccountAddress2 = "0x66e8Be1FBD59FB2433D0044D2870A6CbcF53df3D"; // instaIndex.createClone alawys generates this smartAccount address at first time


  before(async () => {
    [, signer, signer2] = await ethers.getSigners();
    signerAddress = await signer.getAddress();
    signerAddress2 = await signer2.getAddress();


    dai = await ethers.getContractAt(IERC20ABI.abi, daiAddress);

    let instaIndexFactory = await ethers.getContractFactory("InstaIndex", { signer })
    instaIndex = await instaIndexFactory.deploy();

    let instaListFactory = await ethers.getContractFactory("InstaList", { signer })
    instaList = await instaListFactory.deploy();

    let instaConnectorsFactory = await ethers.getContractFactory("InstaConnectors", { signer })
    instaConnectors = await instaConnectorsFactory.deploy();

    let dcaAccountFactory = await ethers.getContractFactory("DCAAccount", { signer })
    dcaAccount = await dcaAccountFactory.deploy();

    let connectBasicFactory = await ethers.getContractFactory("ConnectBasic", { signer })
    connectBasic = await connectBasicFactory.deploy();

    let aaveFactory = await ethers.getContractFactory("ConnectAaveV2", { signer })
    aave = await aaveFactory.deploy();

    await instaIndex.deployed()
    await instaList.deployed()
    await instaConnectors.deployed()
    await dcaAccount.deployed()
    await connectBasic.deployed()
    await aave.deployed()

    await instaIndex.setBasics(signerAddress, instaList.address, dcaAccount.address, instaConnectors.address)
    await instaList.setIndex(instaIndex.address)
    await dcaAccount.setIndex(instaIndex.address)
    await instaConnectors.setIndex(instaIndex.address)

    // Enable Connectors
    await expect(
      instaConnectors.enable(connectBasic.address)
    )
      .to.emit(instaConnectors, "LogEnable")
      .withArgs(connectBasic.address)
    await expect(
      instaConnectors.enable(aave.address)
    )
      .to.emit(instaConnectors, "LogEnable")
      .withArgs(aave.address)

    // Instantiate Resolvers
    let instaDSAResolverFactory = await ethers.getContractFactory("InstaDSAResolver")
    instaDSAResolver = await instaDSAResolverFactory.deploy(instaIndex.address, []);

    let aaveResolverFactory = await ethers.getContractFactory("InstaAaveV2Resolver")
    aaveResolver = await aaveResolverFactory.deploy();

    await instaDSAResolver.deployed()

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
  })

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
