import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { Contract, utils } from "ethers";
import { ethers, waffle } from 'hardhat';

import DCAAccountABI from '../artifacts/contracts/DCAAccount.sol/DCAAccount.json'
import ConnectBasicABI from '../artifacts/contracts/ConnectBasic.sol/ConnectBasic.json'
import IERC20ABI from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json'

describe("DCA time", () => {

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

  // Connectors
  let connectBasic: Contract;
  let aave: Contract;

  // Tokens
  let dai: Contract;

  // Smart Account
  let smartAccount: Contract;
  let smartAccountAddress = "0xFE3d243Ccf7f2153c2D596eD0c5EACbC01B1433A"; // instaIndex.createClone alawys generates this smartAccount address at first time

  before(async () => {
    [, signer] = await ethers.getSigners();
    signerAddress = await signer.getAddress()

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

    let currentVersion = await instaIndex.versionCount()
    const period = 60 * 60;
    await expect(
      instaIndex.build(signerAddress, currentVersion, period, signerAddress)
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

  it("should fail executing dca operation if current timestamp is prior to contract time reference", async () => {
    const targets = [aave.address];
    const datas = [
      encodeBasicConnectSpell(
        "deposit",
        [
          ethAddress,
          ethers.utils.parseEther("0.5"),
          0,
          0
        ]
      )
    ];

    await expect(
      smartAccount.dca(targets, datas, signerAddress)
    ).to.be.revertedWith("not permited yet")

  })

  it("should execute dca operation if current timestamp is after time reference and update time reference accordingly", async () => {
    const rangeLow = 4.9
    const smartAccountBalance = +ethers.utils.formatEther(await ethers.provider.getBalance(smartAccountAddress))
    const rangeHigh = 5.1
    expect(
      smartAccountBalance
    ).to.
      greaterThan(rangeLow).
      lessThan(rangeHigh)

    const targets = [connectBasic.address];
    const datas = [
      encodeBasicConnectSpell(
        "withdraw",
        [
          ethAddress,
          ethers.utils.parseEther("0.8").toString(),
          signerAddress,
          0,
          0
        ]
      )
    ];

    const timeRef = await smartAccount.taskTimeRef();

    await waffle.provider.send("evm_setNextBlockTimestamp", [+timeRef + 1]);

    await expect(
      smartAccount.dca(targets, datas, signerAddress)
    ).to.emit(smartAccount, "LogCast")

    const newTimeRef = await smartAccount.taskTimeRef();

    expect(+newTimeRef.toString()).to.equal(+timeRef + (60 * 60))

    const smartAccountBalanceAfterWithdrawal = +ethers.utils.formatEther(await ethers.provider.getBalance(smartAccountAddress))
    expect(
      smartAccountBalanceAfterWithdrawal
    ).to.
      greaterThan(rangeLow - 0.8).
      lessThan(rangeHigh - 0.8)

  })

})

function encodeBasicConnectSpell(method: string, args: any[]) {
  const ifc = new utils.Interface(ConnectBasicABI.abi)

  const funcFrags = ifc.getFunction(method)

  return ifc.encodeFunctionData(funcFrags, args);
}
