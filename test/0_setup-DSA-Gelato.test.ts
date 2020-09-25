import bre, { ethers } from '@nomiclabs/buidler';
import { expect } from "chai";
import GelatoCoreLib from '@gelatonetwork/core';
import { BigNumber, Contract, Signer } from 'ethers';
import config from '../src/config';


// running `npx buidler test` automatically makes use of buidler-waffle plugin
// Constants
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Contracts
const InstaIndex = require("../pre-compiles/InstaIndex.json");
const InstaList = require("../pre-compiles/InstaList.json");
const InstaConnectors = require("../pre-compiles/InstaConnectors.json");
const InstaAccount = require("../pre-compiles/InstaAccount.json");
const ConnectAuth = require("../pre-compiles/ConnectAuth.json");
const ConnectBasic = require("../pre-compiles/ConnectBasic.json");
const ProviderModuleDSA_ABI = require("../pre-compiles/ProviderModuleDSA_ABI.json");

describe("DSA setup with Gelato Tests", function () {
  this.timeout(50000);
  if (bre.network.name !== "ganache") {
    console.error("Test Suite is meant to be run on ganache only");
    process.exit(1);
  }

  // Wallet to use for local testing
  let userWallet: Signer;
  let userAddress: string;
  let dsaAddress: string;

  // Deployed instances
  let instaIndex: Contract;
  let instaList: Contract;
  let instaConnectors: Contract;
  let instaAccount: Contract;
  let gelatoCore: Contract;
  let providerModuleDSA: Contract;

  // Contracts to deploy and use for local testing
  let dsa: Contract;

  // Other variables
  let dsaVersion: any;
  let dsaID: any;

  before(async function () {
    // Get Test Wallet for local testnet
    [userWallet] = await ethers.getSigners();
    userAddress = await userWallet.getAddress();

    // ===== DSA LOCAL SETUP ==================
    instaIndex = await ethers.getContractAt(
      InstaIndex.abi,
      config.contracts.InstaIndex
    );
    instaList = await ethers.getContractAt(
      InstaList.abi,
      config.contracts.InstaList
    );
    instaConnectors = await ethers.getContractAt(
      InstaConnectors.abi,
      config.contracts.InstaConnectors
    );
    instaAccount = await ethers.getContractAt(
      InstaAccount.abi,
      config.contracts.InstaAccount
    );

    dsaVersion = await instaAccount.version();
    dsaID = await instaList.accounts();

    // Deploy DSA and get and verify ID of newly deployed DSA
    await expect(instaIndex.build(userAddress, 1, userAddress)).to.emit(
      instaIndex,
      "LogAccountCreated"
    );
    await expect(await instaList.accounts()).to.be.equal(dsaID.add(1));
    dsaID = dsaID.add(1);

    // Instantiate the DSA
    dsaAddress = await instaList.accountAddr(dsaID);
    dsa = await ethers.getContractAt(InstaAccount.abi, dsaAddress);

    // ===== GELATO LOCAL SETUP ==================
    gelatoCore = await ethers.getContractAt(
      GelatoCoreLib.GelatoCore.abi,
      config.contracts.GelatoCore
    );
    providerModuleDSA = await ethers.getContractAt(
      ProviderModuleDSA_ABI,
      config.contracts.ProviderModuleDSA
    );
  });

  it("#1: Forks InstaDapp Mainnet config", async function () {
    expect(await instaIndex.list()).to.be.equal(instaList.address);
    expect(dsaVersion).to.be.equal(1);
    expect(await instaIndex.connectors(dsaVersion)).to.be.equal(
      instaConnectors.address
    );
    expect(await instaConnectors.connectors(config.contracts.ConnectAuth)).to
      .be.true;
    expect(await instaConnectors.connectors(config.contracts.ConnectBasic)).to
      .be.true;
    expect(await instaConnectors.connectors(config.contracts.ConnectMaker)).to
      .be.true;
    expect(await instaConnectors.connectors(config.contracts.ConnectCompound))
      .to.be.true;
  });

  it("#2: Deploys a DSA with user as authority", async function () {
    expect(await dsa.isAuth(userAddress)).to.be.true;
  });

  it("#3: Let's User deposit and withdraw funds from DSA", async function () {
    // Send withdraw TX via DSA.cast delegatecall
    const gasLimit = ethers.BigNumber.from(1000000);
    const gasPrice = ethers.utils.parseUnits("20", "gwei");
    const gasCostMax = gasLimit.mul(gasPrice);

    // Deposit funds into DSA
    const initialWalletBalance = await userWallet.getBalance();
    expect(await ethers.provider.getBalance(dsaAddress)).to.be.equal(0);
    await userWallet.sendTransaction({
      to: dsaAddress,
      value: ethers.utils.parseEther("1"),
      gasLimit,
      gasPrice,
    });
    expect(await userWallet.getBalance()).to.be.lt(
      initialWalletBalance.sub(ethers.utils.parseEther("1"))
    );
    expect(await ethers.provider.getBalance(dsaAddress)).to.be.equal(
      ethers.utils.parseEther("1")
    );

    // Encode Payloads for ConnectBasic.withdraw
    const withdrawData = await bre.run("abi-encode-withselector", {
      abi: ConnectBasic.abi,
      functionname: "withdraw",
      inputs: [ETH, ethers.utils.parseEther("1"), userAddress, 0, 0],
    });

    await expect(
      dsa.cast([config.contracts.ConnectBasic], [withdrawData], userAddress, {
        gasLimit,
        gasPrice,
      })
    )
      .to.emit(dsa, "LogCast")
      .withArgs(userAddress, userAddress, 0);

    expect(await ethers.provider.getBalance(dsaAddress)).to.be.equal(0);
    expect(await userWallet.getBalance()).to.be.gte(
      initialWalletBalance.sub(gasCostMax.mul(2))
    );
  });

  it("#4: Enables GelatoCore as a User of the DSA", async function () {
    expect(await dsa.isAuth(gelatoCore.address)).to.be.false;

    // Encode Payloads for ConnectAuth.addModule
    const addAuthData = await bre.run("abi-encode-withselector", {
      abi: ConnectAuth.abi,
      functionname: "add",
      inputs: [gelatoCore.address],
    });

    await expect(
      dsa.cast([config.contracts.ConnectAuth], [addAuthData], userAddress)
    )
      .to.emit(dsa, "LogCast")
      .withArgs(userAddress, userAddress, 0);

    expect(await dsa.isAuth(gelatoCore.address)).to.be.true;
  });

  it("#5: ConnectGelato is deployed and whitelisted on mainnet", async function () {
    expect(
      await instaConnectors.isConnector([config.contracts.ConnectGelato])
    ).to.be.true;
  });

  it("#6: Gelato ProviderModuleDSA returns correct execPayload", async function () {
    // Deposit 1 ETH into DSA
    await userWallet.sendTransaction({
      to: dsaAddress,
      value: ethers.utils.parseEther("1"),
    });
    expect(await ethers.provider.getBalance(dsaAddress)).to.be.equal(
      ethers.utils.parseEther("1")
    );

    // We withdraw to otherWallet to ignore gasUsed during test
    const { 1: otherWallet } = await ethers.getSigners();

    // Instantiate Gelato ConnectBasic.withdraw Task
    const withdrawFromDSATask = new GelatoCoreLib.Task({
      actions: [
        new GelatoCoreLib.Action({
          addr: config.contracts.ConnectBasic,
          data: await bre.run("abi-encode-withselector", {
            abi: ConnectBasic.abi,
            functionname: "withdraw",
            inputs: [
              ETH,
              ethers.utils.parseEther("1"),
              await otherWallet.getAddress(),
              0,
              0,
            ],
          }),
          operation: GelatoCoreLib.Operation.Delegatecall, // placeholder
        }),
      ],
    });

    // otherWallet needs to be an authority to qualify as withdraw to address.
    const addAuthData = await bre.run("abi-encode-withselector", {
      abi: ConnectAuth.abi,
      functionname: "add",
      inputs: [await otherWallet.getAddress()],
    });
    await dsa.cast(
      [config.contracts.ConnectAuth],
      [addAuthData],
      userAddress
    );

    const [execPayload] = await providerModuleDSA.execPayload(
      0, // placeholder
      ethers.constants.AddressZero, // placeholder
      ethers.constants.AddressZero, // placeholder
      withdrawFromDSATask,
      0 // placeholder
    );

    await expect(() =>
      userWallet.sendTransaction({
        to: dsaAddress,
        data: execPayload,
      })
    ).to.changeBalance(otherWallet, ethers.utils.parseEther("1"));
    expect(await ethers.provider.getBalance(dsaAddress)).to.be.equal(0);
  });

});
