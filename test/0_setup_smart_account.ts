import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { Contract, utils } from "ethers";
import { ethers } from 'hardhat';

import InstaAccountABI from '../artifacts/contracts/InstaAccount.sol/InstaAccount.json'
import ConnectBasicABI from '../artifacts/contracts/ConnectBasic.sol/ConnectBasic.json'
import UniswapABI from '../artifacts/contracts/Uniswap.sol/ConnectUniswapV2.json';
import IERC20ABI from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json'

describe("Setup smart account", () => {

  const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";

  // Signer
  let signer: SignerWithAddress;
  let signerAddress: string;

  // Contracts
  let instaIndex: Contract;
  let instaList: Contract;
  let instaConnectors: Contract;
  let instaAccount: Contract;

  // Resolvers
  let instaDSAResolver: Contract;
  let uniswapResolver: Contract;

  // Connectors
  let connectBasic: Contract;
  let uniswap: Contract;

  // Tokens
  let dai: Contract;

  // Smart Account
  let smartAccount: Contract;
  let smartAccountAddress = "0xeb2cA376e44deB977B79b2f24994275d3B443753"; // instaIndex.createClone alawys generates this smartAccount address at first time

  before(async () => {
    [signer] = await ethers.getSigners();
    signerAddress = await signer.getAddress()

    dai = await ethers.getContractAt(IERC20ABI.abi, daiAddress);

    let instaIndexFactory = await ethers.getContractFactory("InstaIndex")
    instaIndex = await instaIndexFactory.deploy();

    let instaListFactory = await ethers.getContractFactory("InstaList")
    instaList = await instaListFactory.deploy();

    let instaConnectorsFactory = await ethers.getContractFactory("InstaConnectors")
    instaConnectors = await instaConnectorsFactory.deploy();

    let instaAccountFactory = await ethers.getContractFactory("InstaAccount")
    instaAccount = await instaAccountFactory.deploy();

    let connectBasicFactory = await ethers.getContractFactory("ConnectBasic")
    connectBasic = await connectBasicFactory.deploy();

    let uniswapFactory = await ethers.getContractFactory("ConnectUniswapV2")
    uniswap = await uniswapFactory.deploy();

    await instaIndex.deployed()
    await instaList.deployed()
    await instaConnectors.deployed()
    await instaAccount.deployed()
    await connectBasic.deployed()
    await uniswap.deployed()

    await instaIndex.setBasics(signerAddress, instaList.address, instaAccount.address, instaConnectors.address)
    await instaList.setIndex(instaIndex.address)
    await instaAccount.setIndex(instaIndex.address)
    await instaConnectors.setIndex(instaIndex.address)

    // Enable Connectors
    await expect(
      instaConnectors.enable(connectBasic.address)
    )
      .to.emit(instaConnectors, "LogEnable")
      .withArgs(connectBasic.address)
    await expect(
      instaConnectors.enable(uniswap.address)
    )
      .to.emit(instaConnectors, "LogEnable")
      .withArgs(uniswap.address)

    // Instantiate Resolvers
    let instaDSAResolverFactory = await ethers.getContractFactory("InstaDSAResolver")
    instaDSAResolver = await instaDSAResolverFactory.deploy(instaIndex.address, []);

    let uniswapResolverFactory = await ethers.getContractFactory("InstaUniswapV2Resolver")
    uniswapResolver = await uniswapResolverFactory.deploy();


    await instaDSAResolver.deployed()
  })

  it("build smart account", async () => {
    let currentVersion = await instaIndex.versionCount()
    expect(currentVersion.toString()).to.equal('1')

    await expect(
      await instaList.accounts()
    ).to.be.equal("0")

    await expect(
      instaIndex.build(signerAddress, currentVersion, signerAddress)
    )
      .to.emit(instaIndex, "LogAccountCreated")
      .withArgs(signerAddress, signerAddress, smartAccountAddress, signerAddress)

    await expect(
      await instaList.accounts()
    ).to.be.equal("1")

    smartAccount = await ethers.getContractAt(InstaAccountABI.abi, smartAccountAddress)

    await expect(
      await smartAccount.isAuth(signerAddress)
    ).to.be.equal(true)
  })

  it("resolver should get smart accounts addresses", async () => {
    const accounts = await instaDSAResolver.getAuthorityDetails(signerAddress)

    expect(accounts.filter((a: any[]) => typeof a[0] == 'string')[0][0]).to.equal(smartAccountAddress)
  })

  it("deposit eth to smart account", async () => {

    await expect(
      await ethers.provider.getBalance(smartAccountAddress)
    ).to.equal("0")

    const rangeLow = 9.5
    const signerBalance = +ethers.utils.formatEther(await ethers.provider.getBalance(signerAddress))
    const rangeHigh = 10
    expect(
      signerBalance
    ).to.
      greaterThan(rangeLow).
      lessThan(rangeHigh)

    await signer.sendTransaction({
      to: smartAccountAddress,
      value: ethers.utils.parseEther("1")
    })

    await expect(
      await ethers.provider.getBalance(smartAccountAddress)
    ).to.equal(ethers.utils.parseEther("1").toString())

    const signerBalanceAfterTransfer = +ethers.utils.formatEther(await ethers.provider.getBalance(signerAddress))
    await expect(
      signerBalanceAfterTransfer
    ).to.
      greaterThan(rangeLow - 1).
      lessThan(rangeHigh - 1)
  })

  it("withdraw eth from smart account", async () => {


    await expect(
      await ethers.provider.getBalance(smartAccountAddress)
    ).to.equal(ethers.utils.parseEther("1").toString())

    const rangeLow = 8.5
    const signerBalance = +ethers.utils.formatEther(await ethers.provider.getBalance(signerAddress))
    const rangeHigh = 9
    expect(
      signerBalance
    ).to.
      greaterThan(rangeLow).
      lessThan(rangeHigh)

    const targets = [connectBasic.address];
    const datas = [
      encodeBasicConnectSpell(
        "withdraw",
        [
          ethAddress,
          ethers.utils.parseEther("0.5").toString(),
          signerAddress,
          0,
          0
        ]
      )
    ];

    await smartAccount.cast(targets, datas, signerAddress)

    await expect(
      await ethers.provider.getBalance(smartAccountAddress)
    ).to.equal(ethers.utils.parseEther("0.5").toString())

    const signerBalanceAfterWithdraw = +ethers.utils.formatEther(await ethers.provider.getBalance(signerAddress))
    expect(
      signerBalanceAfterWithdraw
    ).to.
      greaterThan(rangeLow + 0.5).
      lessThan(rangeHigh + 0.5)

  });

  it("buy DAI in uniswap", async () => {
    const [buyAmount, unitAmt] = await uniswapResolver.getBuyAmount(daiAddress, ethAddress, ethers.utils.parseEther("0.5"), 1)

    const targets = [uniswap.address];
    const datas = [
      encodeUniswapSpell(
        "buy",
        [
          daiAddress,
          ethAddress,
          buyAmount,
          unitAmt,
          0,
          0
        ]
      )
    ];

    await expect(
      await dai.balanceOf(smartAccountAddress)
    ).to.equal("0")

    await smartAccount.cast(targets, datas, signerAddress)

    const daiBalance = await dai.balanceOf(smartAccountAddress)
    await expect(
      daiBalance
    ).to.not.equal("0")
  });

})

function encodeBasicConnectSpell( method: string, args: any[]) {
  const ifc = new utils.Interface(ConnectBasicABI.abi)

  const funcFrags = ifc.getFunction(method)

  return ifc.encodeFunctionData(funcFrags, args);
}

function encodeUniswapSpell(method: string, args: any[]) {
  const ifc = new utils.Interface(UniswapABI.abi)

  const funcFrags = ifc.getFunction(method)

  return ifc.encodeFunctionData(funcFrags, args);
}
