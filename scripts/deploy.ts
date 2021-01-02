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


  console.log("Account balance:", (await deployer.getBalance()).toString());

  const contracts: ContractContainer[] = [];

  let instaIndexFactory = await ethers.getContractFactory("InstaIndex")
  let instaIndex = await instaIndexFactory.deploy();
  contracts.push({
    contract: instaIndex,
    name: "InstaIndex"
  });
  await instaIndex.deployed();

  let instaListFactory = await ethers.getContractFactory("InstaList")
  let instaList = await instaListFactory.deploy();
  contracts.push({
    contract: instaList,
    name: "InstaList"
  });

  let instaConnectorsFactory = await ethers.getContractFactory("InstaConnectors")
  let instaConnectors = await instaConnectorsFactory.deploy();
  contracts.push({
    contract: instaConnectors,
    name: "InstaConnectors"
  });

  let dcaAccountFactory = await ethers.getContractFactory("DCAAccount")
  let dcaAccount = await dcaAccountFactory.deploy();
  contracts.push({
    contract: dcaAccount,
    name: "DCAAccount"
  });

  let connectBasicFactory = await ethers.getContractFactory("ConnectBasic")
  let connectBasic = await connectBasicFactory.deploy();
  contracts.push({
    contract: connectBasic,
    name: "ConnectBasic"
  });

  let aaveFactory = await ethers.getContractFactory("ConnectAaveV2")
  let aave = await aaveFactory.deploy();
  contracts.push({
    contract: aave,
    name: "ConnectAaveV2"
  });

  await setInstaIndexBasics(deployerAddress, contracts);

  let instaDSAResolverFactory = await ethers.getContractFactory("InstaDSAResolver")
  let instaDSAResolver = await instaDSAResolverFactory.deploy(instaIndex.address, []);
  contracts.push({
    contract: instaDSAResolver,
    name: "InstaDSAResolver"
  });
  await instaDSAResolver.deployed();

  let aaveResolverFactory = await ethers.getContractFactory("InstaAaveV2Resolver")
  let aaveResolver = await aaveResolverFactory.deploy();
  contracts.push({
    contract: aaveResolver,
    name: "InstaAaveV2Resolver"
  });

  // We also save the contract's artifacts and address in the frontend directory
  generateArtifacts(contracts, __dirname + "/../frontend/src/contracts");
  generateArtifacts(contracts, __dirname + "/../src/contracts");

  await buildSmartAccount(deployerAddress, contracts);
}

function generateArtifacts(contracts: ContractContainer[], contractsDir: string) {
  const fs = require("fs");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify(
      contracts.reduce((obj: any, contractContainer: ContractContainer) => {
        console.log(`${contractContainer.name}:${contractContainer.contract.address}`)
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

  fs.copyFileSync(
    __dirname + `/../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json`,
    contractsDir + `/IERC20.json`
  );
}

async function setInstaIndexBasics(signerAddress: string, contracts: ContractContainer[]) {
  const instaIndex = getContractByName("InstaIndex", contracts);
  const instaList = getContractByName("InstaList", contracts);
  const instaConnectors = getContractByName("InstaConnectors", contracts);
  const dcaAccount = getContractByName("DCAAccount", contracts);

  await instaIndex.setBasics(signerAddress, instaList.address, dcaAccount.address, instaConnectors.address)
  await instaList.setIndex(instaIndex.address)
  await dcaAccount.setIndex(instaIndex.address)
  await instaConnectors.setIndex(instaIndex.address)

  const connectBasic = getContractByName("ConnectBasic", contracts);
  const connectAaveV2 = getContractByName("ConnectAaveV2", contracts);

  await instaConnectors.enable(connectBasic.address)
  await instaConnectors.enable(connectAaveV2.address)
}

async function buildSmartAccount(signerAddress: string, contracts: ContractContainer[]) {
  const instaIndex = getContractByName("InstaIndex", contracts);

  const currentVersion = await instaIndex.versionCount()
  await instaIndex.build(signerAddress, currentVersion, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", ethers.utils.parseEther("0.1"), 60, signerAddress)
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
