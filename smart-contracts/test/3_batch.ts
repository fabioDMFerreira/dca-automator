import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai"
import { Contract } from "ethers";
import { ethers, waffle } from 'hardhat';

import DCAAccountABI from '../artifacts/contracts/DCAAccount.sol/DCAAccount.json'
import InstaIndexABI from '../artifacts/contracts/InstaIndex.sol/InstaIndex.json'
import IERC20ABI from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json'
import { deployContracts } from "../scripts/deploy-contracts/deploy-contracts";

describe("Batch DCA", () => {

  const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";

  // Signer
  let signer: SignerWithAddress;
  let signer2: SignerWithAddress;
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
  let smartAccountAddress2 = "0x80841C54e87AA7c1fB00953aE0cdaa0ec8aE3Ee4"; // instaIndex.createClone alawys generates this smartAccount address at first time


  before(async () => {
    const signers = await ethers.getSigners();
    signer = signers[1];
    signer2 = signers[2];
    signerAddress = await signer.getAddress()

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

    currentVersion = await instaIndex.versionCount();
    await expect(
      instaIndex.build(signerAddress, currentVersion, ethAddress, ethers.utils.parseEther("0.5"), period, signerAddress)
    ).to.emit(instaIndex, "LogAccountCreated")
      .withArgs(signerAddress, signerAddress, smartAccountAddress2, signerAddress)


    await signer.sendTransaction({
      to: smartAccountAddress,
      value: ethers.utils.parseEther("2")
    })

    await signer.sendTransaction({
      to: smartAccountAddress2,
      value: ethers.utils.parseEther("2")
    })

    smartAccount = await ethers.getContractAt(DCAAccountABI.abi, smartAccountAddress, signer)

  })

  it("should fail executing dca operation if current timestamp is prior to contract time reference", async () => {
    await expect(
      instaIndex.batchDCA([smartAccountAddress])
    ).to.be.revertedWith("not permited yet")

  })

  it("should execute dca operation if current timestamp is after time reference and update time reference accordingly", async () => {
    let instaIndexSigner2 = await ethers.getContractAt(InstaIndexABI.abi, instaIndex.address, signer2)
    const currentAccount1Balance = await ethers.provider.getBalance(smartAccountAddress)
    const currentAccount2Balance = await ethers.provider.getBalance(smartAccountAddress2)

    const timeRef = await smartAccount.timeRef();

    const blockTimestamp = +timeRef + 10

    await waffle.provider.send("evm_setNextBlockTimestamp", [blockTimestamp]);

    await expect(
      instaIndexSigner2.batchDCA([smartAccountAddress, smartAccountAddress2])
    ).to.emit(instaIndexSigner2, "LogBatchDCACompleted")

    const newTimeRef = await smartAccount.timeRef();

    expect(+newTimeRef.toString()).to.equal(+blockTimestamp + (60 * 60))

    const nextAccount1Balance = await ethers.provider.getBalance(smartAccountAddress)
    const nextAccount2Balance = await ethers.provider.getBalance(smartAccountAddress2)

    expect(
      +ethers.utils.formatEther(currentAccount1Balance) - 0.5
    ).to.equal(+ethers.utils.formatEther(nextAccount1Balance))

    expect(
      +ethers.utils.formatEther(currentAccount2Balance) - 0.5
    ).to.equal(+ethers.utils.formatEther(nextAccount2Balance))

  }).timeout(60000)

})
