import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { Contract } from "ethers";
import { ethers, waffle } from 'hardhat';

import DCAAccountABI from '../artifacts/contracts/DCAAccount.sol/DCAAccount.json'
import IERC20ABI from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json'
import { deployContracts } from "../scripts/deploy-contracts/deploy-contracts";
import console from "../scripts/console";

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

  // Tokens
  let dai: Contract;

  // Smart Account
  let smartAccount: Contract;
  let smartAccountAddress = "0xeb2cA376e44deB977B79b2f24994275d3B443753"; // instaIndex.createClone alawys generates this smartAccount address at first time

  before(async () => {
    const signers = await ethers.getSigners();
    signer = signers[1];
    signerAddress = await signer.getAddress()

    dai = await ethers.getContractAt(IERC20ABI.abi, daiAddress);

    const contracts = await deployContracts()

    instaIndex = contracts.getContractByName("InstaIndex").connect(signer);
    instaList = contracts.getContractByName("InstaList").connect(signer);
    instaConnectors = contracts.getContractByName("InstaConnectors").connect(signer);
    dcaAccount = contracts.getContractByName("DCAAccount").connect(signer);
    instaDSAResolver = contracts.getContractByName("InstaDSAResolver").connect(signer);

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

  it("should fail executing dca operation if current timestamp is prior to contract time reference", async () => {
    await expect(
      smartAccount.dca(signerAddress)
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

    const timeRef = await smartAccount.timeRef();

    const blockTimestamp = +timeRef + 1

    await waffle.provider.send("evm_setNextBlockTimestamp", [blockTimestamp]);

    await expect(
      smartAccount.dca(signerAddress)
    ).to.emit(smartAccount, "LogCast")

    const newTimeRef = await smartAccount.timeRef();

    expect(+newTimeRef.toString()).to.equal(+blockTimestamp + (60 * 60))

    const smartAccountBalanceAfterWithdrawal = +ethers.utils.formatEther(await ethers.provider.getBalance(smartAccountAddress))
    expect(
      smartAccountBalanceAfterWithdrawal
    ).to.
      greaterThan(rangeLow - 0.5).
      lessThan(rangeHigh - 0.5)

  }).timeout(30000)

})
