import bre from '@nomiclabs/buidler';
import { ethers, config as buidlerConfig } from "@nomiclabs/buidler";
import { expect } from "chai";
import GelatoCoreLib from '@gelatonetwork/core';
import { Contract, ContractFactory, Signer } from 'ethers';
import config, { ERC20ContractsAddresses } from '../src/config';
import { readArtifact } from '@nomiclabs/buidler/plugins';

// running `npx buidler test` automatically makes use of buidler-waffle plugin
// => only dependency we need is "chai"

// Constants
const DAI_100 = ethers.utils.parseUnits("100", 18);
const TWO_MINUTES = 120; // seconds

// Contracts
const InstaIndex = require("../pre-compiles/InstaIndex.json");
const InstaList = require("../pre-compiles/InstaList.json");
const InstaAccount = require("../pre-compiles/InstaAccount.json");
const ConnectAuth = require("../pre-compiles/ConnectAuth.json");
const IERC20 = require("../pre-compiles/IERC20.json");
const IUniswapExchange = require("../pre-compiles/IUniswapExchange.json");
const ConnectUniswapV2 = require("../pre-compiles/ConnectUniswapV2.json");
const ConnectGelato = require("../pre-compiles/ConnectGelato.json");

describe("Dollar Cost Averaging", function () {
  this.timeout(0);
  if (bre.network.name !== "ganache") {
    console.error("Test Suite is meant to be run on ganache only");
    process.exit(1);
  }

  // Wallet to use for local testing
  let userWallet: Signer;
  let userAddress: string;
  let dsaAddress: string;

  // Deployed instances
  let connectUniswapV2: Contract;
  let connectGelato: Contract;
  let gelatoCore: Contract;
  let dai: Contract;
  let providerModuleDSA: Contract;

  // Contracts to deploy and use for local testing
  let dsa: Contract;
  let conditionTimeStateful: Contract; // contract instance

  before(async function () {
    // Get Test Wallet for local testnet
    [userWallet] = await ethers.getSigners();
    userAddress = await userWallet.getAddress();

    // Ganache default accounts prefilled with 100 ETH
    expect(await userWallet.getBalance()).to.be.gt(
      ethers.utils.parseEther("10")
    );

    // ===== DSA SETUP ==================
    const instaIndex = await ethers.getContractAt(
      InstaIndex.abi,
      config.contracts.InstaIndex
    );
    const instaList = await ethers.getContractAt(
      InstaList.abi,
      config.contracts.InstaList
    );
    connectUniswapV2 = await ethers.getContractAt(
      ConnectUniswapV2.abi,
      config.contracts.ConnectUniswapV2
    );
    connectGelato = await ethers.getContractAt(
      ConnectGelato.abi,
      config.contracts.ConnectGelato
    );

    // Deploy DSA and get and verify ID of newly deployed DSA
    const dsaIDPrevious = await instaList.accounts();
    await expect(instaIndex.build(userAddress, 1, userAddress)).to.emit(
      instaIndex,
      "LogAccountCreated"
    );
    const dsaID = dsaIDPrevious.add(1);
    await expect(await instaList.accounts()).to.be.equal(dsaID);

    // Instantiate the DSA
    dsaAddress = await instaList.accountAddr(dsaID);
    dsa = await ethers.getContractAt(InstaAccount.abi, dsaAddress);

    // ===== GELATO SETUP ==================
    gelatoCore = await ethers.getContractAt(
      GelatoCoreLib.GelatoCore.abi,
      config.contracts.GelatoCore
    );

    // Add GelatoCore as auth on DSA
    const addAuthData = await bre.run("abi-encode-withselector", {
      abi: ConnectAuth.abi,
      functionname: "add",
      inputs: [gelatoCore.address],
    });
    await dsa.cast(
      [config.contracts.ConnectAuth],
      [addAuthData],
      userAddress
    );
    expect(await dsa.isAuth(gelatoCore.address)).to.be.true;

    // 1) Instantiate the Condition obj of the Task
    //  a) We instantiate ConditionTimeStateful contract to get the Data for the condition
    const ConditionTimeStateful = await ethers.getContractFactory("ConditionTimeStateful");
    conditionTimeStateful = await ConditionTimeStateful.deploy(gelatoCore.address)

    await conditionTimeStateful.deployed()

    console.log("ConditionTimeStateful deployed to:", conditionTimeStateful.address)

    // ===== Dapp Dependencies SETUP ==================
    // This test assumes our user has 100 DAI deposited in Maker DSR
    dai = await ethers.getContractAt(IERC20.abi, ERC20ContractsAddresses.DAI);
    expect(await dai.balanceOf(userAddress)).to.be.equal(0);

    // Let's get the test user 100 DAI++ from Kyber
    // const daiUniswapExchange = await ethers.getContractAt(
    //   IUniswapExchange.abi,
    //   config.contracts.DAI_UNISWAP
    // );
    // await daiUniswapExchange.ethToTokenTransferInput(
    //   1,
    //   2525644800, // random timestamp in the future (year 2050)
    //   userAddress,
    //   {
    //     value: ethers.utils.parseEther("2"),
    //   }
    // );

    // const daiBalance = await dai.balanceOf(userAddress)
    // expect(daiBalance).to.be.gte(DAI_100);

    // Deploy ProviderModuleDSA to local testnet
    const ProviderModuleDSA = await ethers.getContractFactory(
      "ProviderModuleDSA"
    );
    providerModuleDSA = await ProviderModuleDSA.deploy(
      instaIndex.address,
      gelatoCore.address
    );
    await providerModuleDSA.deployed();
  });

  it("#1: Dollar Cost Averaging DAI", async function () {

    const timeCondition = new GelatoCoreLib.Condition({
      inst: conditionTimeStateful.address,
      data: await conditionTimeStateful.getConditionData(dsa.address),
    });

    // ======= Action/Spells setup ======
    const spells = [];

    const conditionTimeStatefulArtifact = await readArtifact(buidlerConfig.paths.artifacts, 'ConditionTimeStateful')

    const actionUpdateConditionTime = new GelatoCoreLib.Action({
      addr: conditionTimeStateful.address,
      data: await bre.run("abi-encode-withselector", {
        abi: conditionTimeStatefulArtifact.abi,
        functionname: "setRefTime",
        inputs: [TWO_MINUTES /* _timeDelta */, 0],
      }),
      operation: GelatoCoreLib.Operation.Call, // This Action must be called from the UserProxy
    });

    spells.push(actionUpdateConditionTime)

    var ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // Reference of Ether on uniswap
    var buyAmount = "2900000000000000000000"; // 290 dai/ether * 10 ether in 18 decimals
    var unitAmt = "10000000000000000";
    const connectorUniswap = new GelatoCoreLib.Action({
      addr: connectUniswapV2.address,
      data: await bre.run("abi-encode-withselector", {
        abi: ConnectUniswapV2.abi,
        functionname: "buy",
        inputs: [ERC20ContractsAddresses.DAI, ETH, buyAmount, unitAmt, 0, 0], //
      }),
      operation: GelatoCoreLib.Operation.Delegatecall,
    });

    spells.push(connectorUniswap);

    // ======= Gelato Task Setup =========
    // A Gelato Task just combines Conditions with Actions
    // You also specify how much GAS a Task consumes at max and the ceiling
    // gas price under which you are willing to auto-transact. There is only
    // one gas price in the current Gelato system: fast gwei read from Chainlink.
    const GAS_LIMIT = "4000000";
    const GAS_PRICE_CEIL = ethers.utils.parseUnits("1000", "gwei");
    const dollarCostAveraging = new GelatoCoreLib.Task({
      conditions: [timeCondition],
      actions: spells,
      selfProviderGasLimit: GAS_LIMIT,
      selfProviderGasPriceCeil: GAS_PRICE_CEIL,
    });

    // ======= Gelato Provider setup ======
    // Someone needs to pay for gas for automatic Task execution on Gelato.
    // Gelato has the concept of a "Provider" to denote who is providing (depositing)
    // ETH on Gelato in order to pay for automation gas. In our case, the User
    // is paying for his own automation gas. Therefore, the User is a "Self-Provider".
    // But since Gelato only talks to smart contract accounts, the User's DSA proxy
    // plays the part of the "Self-Provider" on behalf of the User behind the DSA.
    // A GelatoProvider is an object with the address of the provider - in our case
    // the DSA address - and the address of the "ProviderModule". This module
    // fulfills certain functions like encoding the execution payload for the Gelato
    // protocol. Check out ./contracts/ProviderModuleDSA.sol to see what it does.
    const gelatoSelfProvider = new GelatoCoreLib.GelatoProvider({
      addr: dsa.address,
      module: providerModuleDSA.address,
    });

    // ======= Executor Setup =========
    // For local Testing purposes our test User account will play the role of the Gelato
    // Executor network because this logic is non-trivial to fork into a local instance
    await gelatoCore.stakeExecutor({
      value: await gelatoCore.minExecutorStake(),
    });
    expect(await gelatoCore.isExecutorMinStaked(userAddress)).to.be.true;

    // ======= Gelato Task Provision =========
    // Gelato requires some initial setup via its multiProvide API
    // We must 1) provide ETH to pay for future automation gas, 2) we must
    // assign an Executor network to the Task, 3) we must tell Gelato what
    // "ProviderModule" we want to use for our Task.
    // Since our DSA proxy is the one through which we interact with Gelato,
    // we must do this setup via the DSA proxy by using ConnectGelato
    const TASK_AUTOMATION_FUNDS = await gelatoCore.minExecProviderFunds(
      GAS_LIMIT,
      GAS_PRICE_CEIL
    );
    await dsa.cast(
      [connectGelato.address], // targets
      [
        await bre.run("abi-encode-withselector", {
          abi: ConnectGelato.abi,
          functionname: "multiProvide",
          inputs: [
            userAddress,
            [],
            [providerModuleDSA.address],
            TASK_AUTOMATION_FUNDS,
            0,
            0,
          ],
        }),
      ], // datas
      userAddress, // origin
      {
        value: TASK_AUTOMATION_FUNDS,
        gasLimit: 5000000,
      }
    );
    expect(await gelatoCore.providerFunds(dsa.address)).to.be.gte(
      TASK_AUTOMATION_FUNDS
    );
    expect(
      await gelatoCore.isProviderLiquid(dsa.address, GAS_LIMIT, GAS_PRICE_CEIL)
    );
    expect(await gelatoCore.executorByProvider(dsa.address)).to.be.equal(
      userAddress
    );
    expect(
      await gelatoCore.isModuleProvided(dsa.address, providerModuleDSA.address)
    ).to.be.true;

    // ======= 📣 TASK SUBMISSION 📣 =========
    // In Gelato world our DSA is the User. So we must submit the Task
    // to Gelato via our DSA and hence use ConnectGelato again.
    const expiryDate = 0;
    await expect(
      dsa.cast(
        [connectGelato.address], // targets
        [
          await bre.run("abi-encode-withselector", {
            abi: ConnectGelato.abi,
            functionname: "submitTaskCycle",
            inputs: [
              gelatoSelfProvider,
              [dollarCostAveraging],
              expiryDate,
              0,
            ],
          }),
        ], // datas
        userAddress, // origin
        {
          gasLimit: 5000000,
        }
      )
    ).to.emit(gelatoCore, "LogTaskSubmitted");

    // Task Receipt: a successfully submitted Task in Gelato
    // is wrapped in a TaskReceipt. For testing we instantiate the TaskReceipt
    // for our to be submitted Task.
    const taskReceipt = new GelatoCoreLib.TaskReceipt({
      userProxy: dsa.address,
      provider: gelatoSelfProvider,
      tasks: [dollarCostAveraging],
      cycleId: 1,
      submissionsLeft: 0,
    });

    const taskReceiptId = await gelatoCore.currentTaskReceiptId();
    taskReceipt.id = taskReceiptId;

    const transactionHash = await gelatoCore.hashTaskReceipt(taskReceipt);

    expect(
      await gelatoCore.taskReceiptHash(taskReceipt.id)
    ).to.be.equal(transactionHash);

    // ======= 📣 TASK EXECUTION 📣 =========
    // This stuff is normally automated by the Gelato Network and Dapp Developers
    // and their Users don't have to take care of it. However, for local testing
    // we simulate the Gelato Execution logic.

    // First we fetch the gelatoGasPrice as fed by ChainLink oracle. Gelato
    // allows Users to specify a maximum fast gwei gas price for their Tasks
    // to remain executable up until.
    const gelatoGasPrice = await bre.run("fetchGelatoGasPrice");
    expect(gelatoGasPrice).to.be.lte(
      dollarCostAveraging.selfProviderGasPriceCeil
    );

    expect(
      await gelatoCore.canExec(
        taskReceipt,
        dollarCostAveraging.selfProviderGasLimit,
        gelatoGasPrice
      )
    ).to.be.equal("OK");

    const dsaDAIBefore = await dai.balanceOf(dsa.address);
    expect(dsaDAIBefore).to.be.equal(0);

    // Skip forth in time to nextDueDate
    let blockNumber = await ethers.provider.getBlockNumber()
    let block = await ethers.provider.getBlock(blockNumber);
    let nextDueDate = block.timestamp + TWO_MINUTES + 1;
    await ethers.provider.send("evm_mine", [nextDueDate]);

    // For testing we now simulate automatic Task Execution ❗
    await expect(
      gelatoCore.exec(taskReceipt, {
        gasPrice: gelatoGasPrice, // Exectutor must use gelatoGasPrice (Chainlink fast gwei)
        gasLimit: dollarCostAveraging.selfProviderGasLimit,
      })
    ).to.emit(gelatoCore, "LogExecSuccess");

    expect(await dai.balanceOf(dsa.address)).to.be.equal("2900000000000000000000");
  });
});
