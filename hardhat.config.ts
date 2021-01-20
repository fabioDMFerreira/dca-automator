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
const kovanURL = `https://kovan.infura.io/v3/${INFURA_ID}`;

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
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "b83f06807cf81300b54dc375d30b70ee0b3673b3b7ec7f876bda9df0d9e5f22f",
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "e75b27bae8a270fecbb5b074acb17f6156c8503ef8c306d887ebc96aa6eeb092",
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "5bfc101f51e09f9cac3adf91a4ee86319a92a9b845907ebeb7cb75035db91f8b",
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "cd61793fd78dce523ae8e636a1e22c7f6b6d69d02fdbf571a08d1a488728d42b",
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "419db2685495879c50495c46ebb11ea390fdec7e6c7e46f125b1ed1a5120bfbd",
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "4e327414d373752cdc0b09ba808a177da3b003bc1cf9f1a287ab2ff2f87bb905",
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "a627b9dfde13b29a942cbacd8335c2929a66c3dfadcde305ca4d90494b617c04",
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "34467405c173db767533ac8244f5f91d530f54a1339a7d8256687ba4088b79bb",
        balance: ethers.utils.parseEther("1000").toString(),
      }, {
        privateKey: "b0c18b3011507fadf0cb4593d51fe85af53f1e621f0cb3a20d8becd9e5dfba81",
        balance: ethers.utils.parseEther("1000").toString(),
      }],
      forking: {
        url: infuraURL,
      },
    },
    kovan: {
      url: kovanURL,
      accounts: ["cdf26c00dd5d4b56edce92609c78f79fc272aee66a55e2aeef140e8a5dd74d1c"]
    },
    ganache: {
      accounts: ["cdf26c00dd5d4b56edce92609c78f79fc272aee66a55e2aeef140e8a5dd74d1c"],
      url: infuraURL,
    },
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
