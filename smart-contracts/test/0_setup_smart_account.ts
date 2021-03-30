import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { Contract } from "ethers";
import { ethers, waffle } from 'hardhat';

import DCAAccountABI from '../artifacts/contracts/DCAAccount.sol/DCAAccount.json'
import IERC20ABI from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json'
import { deployContracts } from "../scripts/deploy-contracts/deploy-contracts";

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
  let dcaAccount: Contract;

  // Resolvers
  let instaDSAResolver: Contract;

  // Tokens
  let dai: Contract;

  // Smart Account
  let smartAccount: Contract;
  let smartAccountAddress = "0xeb2cA376e44deB977B79b2f24994275d3B443753"; // instaIndex.createClone alawys generates this smartAccount address at first time

  before(async () => {
    [signer] = await ethers.getSigners();
    signerAddress = await signer.getAddress()

    dai = await ethers.getContractAt(IERC20ABI.abi, daiAddress);

    const contracts = await deployContracts()

    instaIndex = contracts.getContractByName("InstaIndex");
    instaList = contracts.getContractByName("InstaList");
    instaConnectors = contracts.getContractByName("InstaConnectors");
    dcaAccount = contracts.getContractByName("DCAAccount");
    instaDSAResolver = contracts.getContractByName("InstaDSAResolver");
  })

  it("build smart account", async () => {
    let currentVersion = await instaIndex.versionCount()
    expect(currentVersion.toString()).to.equal('1')

    await expect(
      await instaList.accounts()
    ).to.be.equal("0")

    const currentTimestamp = 1608572844070;
    const period = 60 * 60;
    const token = daiAddress;
    const depositAmount = ethers.utils.parseEther("100");

    await waffle.provider.send("evm_setNextBlockTimestamp", [currentTimestamp]);

    await expect(
      instaIndex.build(signerAddress, currentVersion, token, depositAmount, period, signerAddress)
    )
      .to.emit(instaIndex, "LogAccountCreated")
      .withArgs(signerAddress, signerAddress, smartAccountAddress, signerAddress)

    await expect(
      await instaList.accounts()
    ).to.be.equal("1")

    smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress)

    await expect(
      await smartAccount.isAuth(signerAddress)
    ).to.be.equal(true)

    const nextDCA = await smartAccount.timeRef()
    expect(nextDCA).to.equal(currentTimestamp + period);

    const accountToken = await smartAccount.token()
    expect(accountToken.toLowerCase()).to.equal(token);

    const accountDepositAmount = await smartAccount.depositAmount()
    expect(accountDepositAmount).to.equal(depositAmount);
  })

  it("resolver should get smart accounts addresses", async () => {
    const accounts = await instaDSAResolver.getAuthorityAccounts(signerAddress)

    expect(accounts[0]).to.equal(smartAccountAddress)
  })

  it("deposit eth to smart account", async () => {

    await expect(
      await ethers.provider.getBalance(smartAccountAddress)
    ).to.equal("0")

    const rangeLow = 999.5
    const signerBalance = +ethers.utils.formatEther(await ethers.provider.getBalance(signerAddress))
    const rangeHigh = 1000
    expect(
      signerBalance
    ).to.
      greaterThan(rangeLow).
      lessThan(rangeHigh)

    await smartAccount.deposit(
      ethAddress,
      ethers.utils.parseEther("3"),
      0,
      0, {
      value: ethers.utils.parseEther("3")
    }
    )

    await expect(
      await ethers.provider.getBalance(smartAccountAddress)
    ).to.equal(ethers.utils.parseEther("3").toString())

    const signerBalanceAfterTransfer = +ethers.utils.formatEther(await ethers.provider.getBalance(signerAddress))
    await expect(
      signerBalanceAfterTransfer
    ).to.
      greaterThan(rangeLow - 3).
      lessThan(rangeHigh - 3)
  })

  it("withdraw eth from smart account", async () => {
    const rangeLow = 996.5
    const signerBalance = +ethers.utils.formatEther(await ethers.provider.getBalance(signerAddress))
    const rangeHigh = 997
    expect(
      signerBalance
    ).to.
      greaterThan(rangeLow).
      lessThan(rangeHigh)

    await smartAccount.withdraw(
      ethAddress,
      ethers.utils.parseEther("0.5").toString(),
      signerAddress,
      0,
      0
    )

    await expect(
      await ethers.provider.getBalance(smartAccountAddress)
    ).to.equal(ethers.utils.parseEther("2.5").toString())

    const signerBalanceAfterWithdraw = +ethers.utils.formatEther(await ethers.provider.getBalance(signerAddress))
    expect(
      signerBalanceAfterWithdraw
    ).to.
      greaterThan(rangeLow + 0.5).
      lessThan(rangeHigh + 0.5)

  });

})

