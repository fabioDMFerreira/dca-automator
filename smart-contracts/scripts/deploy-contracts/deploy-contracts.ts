import { network, ethers } from 'hardhat';
import console from '../console';
import ContractsList from '../ContractsList';

// This is a script for deploying your contracts. You can adapt it to deploy
// yours, or create new ones.
export async function deployContracts(): Promise<ContractsList> {
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

  const contracts = new ContractsList();

  const instaIndex = await contracts.deploy("InstaIndex");
  await contracts.deploy("InstaList");
  await contracts.deploy("InstaConnectors");
  await contracts.deploy("DCAAccount");

  await setInstaIndexBasics(deployerAddress, contracts);

  await contracts.deploy("InstaDSAResolver", instaIndex.address, [])

  await contracts.deploy("InstaAaveV2Resolver")

  // We also save the contract's artifacts and address in the frontend directory
  generateArtifacts(contracts, __dirname + "/../../../client/src/contracts");
  generateArtifacts(contracts, __dirname + "/../../../keeper/contracts");
  generateArtifacts(contracts, __dirname + "/../../last-artifacts-deployed/" + network.name);

  return contracts
}

function generateArtifacts(contracts: ContractsList, contractsDir: string) {
  const fs = require("fs");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify(
      contracts.getAddresses(), undefined, 2
    )
  );

  contracts.getAllContracts().forEach((contract) => {
    fs.copyFileSync(
      __dirname + `/../../artifacts/contracts/${contract.name}.sol/${contract.name}.json`,
      contractsDir + `/${contract.name}.json`
    );
  })

  fs.copyFileSync(
    __dirname + `/../../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json`,
    contractsDir + `/IERC20.json`
  );
}

async function setInstaIndexBasics(signerAddress: string, contracts: ContractsList) {
  const instaIndex = contracts.getContractByName("InstaIndex");
  const instaList = contracts.getContractByName("InstaList");
  const instaConnectors = contracts.getContractByName("InstaConnectors");
  const dcaAccount = contracts.getContractByName("DCAAccount");

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
