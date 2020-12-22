import { HardhatUserConfig, task, types } from "hardhat/config";
import { ethers, utils } from 'ethers';
import fs from 'fs';

// ================================= PLUGINS =========================================
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-ganache";
import "@nomiclabs/hardhat-waffle";

const assert = require("assert");

// Process Env Variables
require("dotenv").config();
const INFURA_ID = process.env.INFURA_ID;
assert.ok(INFURA_ID, "no Infura ID in process.env");
const infuraURL = `https://mainnet.infura.io/v3/${INFURA_ID}`;

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
const config: HardhatUserConfig = {
  defaultNetwork: "ganache",
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: [{
        privateKey: "cdf26c00dd5d4b56edce92609c78f79fc272aee66a55e2aeef140e8a5dd74d1c",
        balance: ethers.utils.parseEther("10").toString(),
      }, {
        privateKey: "b83f06807cf81300b54dc375d30b70ee0b3673b3b7ec7f876bda9df0d9e5f22f",
        balance: ethers.utils.parseEther("10").toString(),
      }, {
        privateKey: "e75b27bae8a270fecbb5b074acb17f6156c8503ef8c306d887ebc96aa6eeb092",
        balance: ethers.utils.parseEther("10").toString(),
      }],
      forking: {
        url: infuraURL
      },
    },
    ganache: {
      accounts: ["cdf26c00dd5d4b56edce92609c78f79fc272aee66a55e2aeef140e8a5dd74d1c"],
      url: infuraURL,
    }
  },
  // This is a sample solc configuration that specifies which version of solc to use
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true
      }
    }
  },
};

export default config;




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

    console.log({ address })

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

