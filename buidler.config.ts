import { BuidlerConfig, task, usePlugin, types } from "@nomiclabs/buidler/config";
import { utils } from 'ethers';
import GelatoCoreLib from '@gelatonetwork/core';
import fs from 'fs';

const assert = require("assert");

// Process Env Variables
require("dotenv").config();
const INFURA_ID = process.env.INFURA_ID;
assert.ok(INFURA_ID, "no Infura ID in process.env");

// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_, bre) => {
  const accounts = await bre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
const config: BuidlerConfig = {
  defaultNetwork: "ganache",
  networks: {
    ganache: {
      // Standard config
      url: "http://localhost:8545",
      // @ts-ignore
      fork: `https://mainnet.infura.io/v3/${INFURA_ID}`,

      unlocked_accounts: ["0xb1dc62ec38e6e3857a887210c38418e4a17da5b2"]
    },
  },
  // This is a sample solc configuration that specifies which version of solc to use
  solc: {
    version: "0.6.12",
  },
};

export default config;

// ================================= PLUGINS =========================================
usePlugin("@nomiclabs/buidler-ethers");
usePlugin("@nomiclabs/buidler-ganache");
usePlugin("@nomiclabs/buidler-waffle");


// ================================= TASKS =========================================
task("abi-encode-withselector")
  .addPositionalParam(
    "abi",
    "Contract ABI in array form",
    undefined,
    types.json
  )
  .addPositionalParam("functionname")
  .addOptionalVariadicPositionalParam(
    "inputs",
    "Array of function params",
    undefined,
    types.json
  )
  .addFlag("log")
  .setAction(async (taskArgs) => {
    try {
      if (taskArgs.log) console.log(taskArgs);

      if (!taskArgs.abi)
        throw new Error("abi-encode-withselector: no abi passed");

      const interFace = new utils.Interface(taskArgs.abi);

      let functionFragment;
      try {
        functionFragment = interFace.getFunction(taskArgs.functionname);
      } catch (error) {
        throw new Error(
          `\n ❌ abi-encode-withselector: functionname "${taskArgs.functionname}" not found`
        );
      }

      let payloadWithSelector;

      if (taskArgs.inputs) {
        let iterableInputs;
        try {
          iterableInputs = [...taskArgs.inputs];
        } catch (error) {
          iterableInputs = [taskArgs.inputs];
        }
        payloadWithSelector = interFace.encodeFunctionData(
          functionFragment,
          iterableInputs
        );
      } else {
        payloadWithSelector = interFace.encodeFunctionData(
          functionFragment,
          []
        );
      }

      if (taskArgs.log)
        console.log(`\nEncodedPayloadWithSelector:\n${payloadWithSelector}\n`);
      return payloadWithSelector;
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

task(
  "fetchGelatoGasPrice",
  `Returns the current gelato gas price used for calling canExec and exec`
)
  .addOptionalParam("gelatocoreaddress")
  .addFlag("log", "Logs return values to stdout")
  .setAction(async (taskArgs, bre) => {
    try {
      const gelatoCore = await bre.ethers.getContractAt(
        GelatoCoreLib.GelatoCore.abi,
        taskArgs.gelatocoreaddress
          ? taskArgs.gelatocoreaddress
          : "0x1d681d76ce96E4d70a88A00EBbcfc1E47808d0b8"
      );

      const oracleAbi = ["function latestAnswer() view returns (int256)"];

      const gelatoGasPriceOracleAddress = await gelatoCore.gelatoGasPriceOracle();

      // Get gelatoGasPriceOracleAddress
      const gelatoGasPriceOracle = await bre.ethers.getContractAt(
        oracleAbi,
        gelatoGasPriceOracleAddress
      );

      // lastAnswer is used by GelatoGasPriceOracle as well as the Chainlink Oracle
      const gelatoGasPrice = await gelatoGasPriceOracle.latestAnswer();

      if (taskArgs.log) {
        console.log(
          `\ngelatoGasPrice: ${utils.formatUnits(
            gelatoGasPrice.toString(),
            "gwei"
          )} gwei\n`
        );
      }

      return gelatoGasPrice;
    } catch (error) {
      console.error(error, "\n");
      process.exit(1);
    }
  });


// The next line is part of the sample project, you don't need it in your
// project. It imports a Buidler task definition, that can be used for
// testing the frontend.
task("faucet", "Sends ETH and tokens to an address")
  .addPositionalParam("receiver", "The address that will receive them")
  .setAction(async ({ receiver }, bre) => {
    if (bre.network.name === "buidlerevm") {
      console.warn(
        "You are running the facuet task with Buidler EVM network, which" +
        "gets automatically created and destroyed every time. Use the Buidler" +
        " option '--network localhost'"
      );
    }

    const addressesFile =
      __dirname + "/frontend/src/contracts/contract-address.json";

    if (!fs.existsSync(addressesFile)) {
      console.error("You need to deploy your contract first");
      return;
    }

    const addressJson = fs.readFileSync(addressesFile);
    const address = JSON.parse(addressJson.toString('utf8'));

    console.log({address})

    if ((await bre.ethers.provider.getCode(address.Token)) === "0x") {
      console.error("You need to deploy your contract first");
      return;
    }

    const token = await bre.ethers.getContractAt("Token", address.Token);
    const [sender] = await bre.ethers.getSigners();

    const tx = await token.transfer(receiver, 100);
    await tx.wait();

    const tx2 = await sender.sendTransaction({
      to: receiver,
      value: bre.ethers.constants.WeiPerEther,
    });
    await tx2.wait();

    console.log(`Transferred 1 ETH and 100 tokens to ${receiver}`);
  });

