import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { network, ethers } from 'hardhat';
import { Contract } from 'ethers';

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
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const deployerAddress = await deployer.getAddress()
  console.log(
    "Deploying the contracts with the account:",
    deployerAddress
  );


  console.log("Account balance:", (await deployer.getBalance()).toString());

  const contracts: ContractContainer[] = [];

  console.log("Deploying InstaIndex");
  let instaIndexFactory = await ethers.getContractFactory("InstaIndex")
  let instaIndex = await instaIndexFactory.deploy();
  contracts.push({
    contract: instaIndex,
    name: "InstaIndex"
  });
  await instaIndex.deployed().then(() => console.log("InstaIndex ready"))

  console.log("Deploying InstaList");
  let instaListFactory = await ethers.getContractFactory("InstaList")
  let instaList = await instaListFactory.deploy();
  contracts.push({
    contract: instaList,
    name: "InstaList"
  });
  await instaList.deployed().then(() => console.log("InstaList ready"))

  console.log("Deploying InstaConnectors");
  let instaConnectorsFactory = await ethers.getContractFactory("InstaConnectors")
  let instaConnectors = await instaConnectorsFactory.deploy();
  contracts.push({
    contract: instaConnectors,
    name: "InstaConnectors"
  });
  await instaConnectors.deployed().then(() => console.log("InstaConnectors ready"))

  console.log("Deploying DCAAccount");
  let dcaAccountFactory = await ethers.getContractFactory("DCAAccount")
  let dcaAccount = await dcaAccountFactory.deploy();
  contracts.push({
    contract: dcaAccount,
    name: "DCAAccount"
  });
  await dcaAccount.deployed().then(() => console.log("DCAAccount ready"))

  await setInstaIndexBasics(deployerAddress, contracts);

  console.log("Deploying InstaDSAResolver")
  let instaDSAResolverFactory = await ethers.getContractFactory("InstaDSAResolver")
  let instaDSAResolver = await instaDSAResolverFactory.deploy(instaIndex.address, []);
  contracts.push({
    contract: instaDSAResolver,
    name: "InstaDSAResolver"
  });

  console.log("Deploying InstaAaveV2Resolver")
  let aaveResolverFactory = await ethers.getContractFactory("InstaAaveV2Resolver")
  let aaveResolver = await aaveResolverFactory.deploy();
  contracts.push({
    contract: aaveResolver,
    name: "InstaAaveV2Resolver"
  });

  await Promise.all([
    instaDSAResolver.deployed().then(() => console.log("InstaDSAResolver ready")),
    aaveResolver.deployed().then(() => console.log('AaveResolver ready'))
  ])


  // We also save the contract's artifacts and address in the frontend directory
  generateArtifacts(contracts, __dirname + "/../frontend/src/contracts");
  generateArtifacts(contracts, __dirname + "/../src/contracts");
  generateArtifacts(contracts, __dirname + "/../last-artifacts-deployed/" + network.name);

  console.log("Building dca accounts");

  await Promise.all(

    signers.map(signer => {
      return buildSmartAccounts(signer, contracts, getRndInteger(5, 15))
    }))
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

  console.log('Initialize InstaIndex')
  const instaIndexTx = await instaIndex.setBasics(signerAddress, instaList.address, dcaAccount.address, instaConnectors.address)
  console.log('Initialize InstaList')
  const instaListTx = await instaList.setIndex(instaIndex.address)
  console.log('Initialize DCAAccount')
  const dcaAccountTx = await dcaAccount.setIndex(instaIndex.address)
  console.log('Initialize InstaConnectors')
  const instaConnectorsTx = await instaConnectors.setIndex(instaIndex.address)

  console.log("Waiting for contracts initialization transactions")
  await Promise.all([
    instaIndexTx.wait().then(() => console.log("InstaIndex initialized")),
    instaListTx.wait().then(() => console.log("InstaList initialized")),
    dcaAccountTx.wait().then(() => console.log("DCAAccount initialized")),
    instaConnectorsTx.wait().then(() => console.log("InstaConnectors initialized"))
  ])
}

async function buildSmartAccounts(signer: SignerWithAddress, contracts: ContractContainer[], numberOfAccounts: number) {
  const signerAddress = await signer.getAddress()

  const instaIndex = getContractByName("InstaIndex", contracts);


  for (let i = 0; i < numberOfAccounts; i++) {
    const depositAmount = getRndFloat(0.01, 5)
    const period = getRndInteger(60, 1800)
    const currentVersion = await instaIndex.versionCount()
    const tx = await instaIndex.build(signerAddress, currentVersion, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", ethers.utils.parseEther(depositAmount.toString()), period, signerAddress)
    await tx.wait()
  }

  const dsaResolver = getContractByName("InstaDSAResolver", contracts);

  const accounts = await dsaResolver.getAuthorityAccounts(signerAddress);

  await Promise.all(accounts.map(
    (account: string) => {
      return signer.sendTransaction({
        to: account,
        value: ethers.utils.parseEther("15")
      })
    }
  ))
}

function getRndInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function getRndFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
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
