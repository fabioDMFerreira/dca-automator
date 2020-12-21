import { network, ethers } from 'hardhat';
import { Contract } from 'ethers';
import fs from 'fs';

interface ContractContainer {
  name: string,
  contract: Contract
}

// This is a script for deploying your contracts. You can adapt it to deploy
// yours, or create new ones.
async function main() {
  // This is just a convenience check
  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Buidler EVM network, which" +
      "gets automatically created and destroyed every time. Use the Buidler" +
      " option '--network localhost'"
    );
  }

  // ethers is avaialble in the global scope
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress()
  console.log(
    "Deploying the contracts with the account:",
    deployerAddress
  );

  const contractsDir = __dirname + "/../contracts";

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const contracts: ContractContainer[] = [];
  const contractsFilesNames = fs.readdirSync(contractsDir)

  for (let i = 0; i < contractsFilesNames.length; i++) {
    const contractFileName = contractsFilesNames[i];
    const contractName = contractFileName.split('.')[0]

    if (fs.lstatSync(contractsDir + "/" + contractFileName).isDirectory()) {
      continue;
    }

    const contractFactory = await ethers.getContractFactory(contractName);
    const contract = await contractFactory.deploy();

    await contract.deployed();

    console.log(contractName, " address: ", contract.address);
    contracts.push({
      name: contractName,
      contract
    })
  }

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(contracts);

  await setInstaIndexBasics(deployerAddress, contracts);
  await buildSmartAccount(deployerAddress, contracts);
  await enableBasicConnector(deployerAddress, contracts);
}

function saveFrontendFiles(contracts: ContractContainer[]) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify(
      contracts.reduce((obj: any, contractContainer: ContractContainer) => {
        obj[contractContainer.name] = contractContainer.contract.address;
        return obj;
      }, {}), undefined, 2
    )
  );

  contracts.forEach((contract) => {
    fs.copyFileSync(
      __dirname + `/../artifacts/contracts/${contract.name}.sol/${contract.name}.json`,
      contractsDir + `/${contract.name}.json`
    );
  })
}

async function setInstaIndexBasics(signerAddress: string, contracts: ContractContainer[]) {
  const instaIndex = getContractByName("InstaIndex", contracts);
  const instaList = getContractByName("InstaList", contracts);
  const instaConnectors = getContractByName("InstaConnectors", contracts);
  const instaAccount = getContractByName("InstaAccount", contracts);

  await instaIndex.setBasics(signerAddress, instaList.address, instaAccount.address, instaConnectors.address)
  await instaList.setIndex(instaIndex.address)
  await instaAccount.setIndex(instaIndex.address)
}

async function buildSmartAccount(signerAddress: string, contracts: ContractContainer[]) {
  const instaIndex = getContractByName("InstaIndex", contracts);

  const currentVersion = await instaIndex.versionCount()
  await instaIndex.build(signerAddress, currentVersion, signerAddress)
  await instaIndex.build(signerAddress, currentVersion, signerAddress)
}

async function enableBasicConnector(signerAddress: string, contracts: ContractContainer[]) {
  // const instaIndex = getContractByName("InstaIndex", contracts);
  // const connectBasic = getContractByName("ConnectBasic", contracts);

  // const currentVersion = await instaIndex.versionCount()

  // await instaIndex.build(signerAddress, currentVersion, signerAddress)

}

function getContractByName(name: string, contracts: ContractContainer[]) {
  const contractContainer = contracts.find(contract => contract.name == name)

  if (!contractContainer) {
    throw new Error(`${name} not found`)
  }

  return contractContainer.contract;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
