import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import console from './console';

export interface ContractContainer {
  name: string,
  contract: Contract
}

export default class ContractsList {
  _contracts: ContractContainer[]

  constructor() {
    this._contracts = []
  }

  async deploy(contractName: string, ...contractArgs: any): Promise<Contract> {
    console.log("Deploying " + contractName);
    const factory = await ethers.getContractFactory(contractName)
    const contract = await factory.deploy(...contractArgs);
    await contract.deployed().then(() => console.log(contractName + " ready"))

    this.push(contractName, contract)
    return contract
  }

  push(contractName: string, contract: Contract) {
    this._contracts.push({
      name: contractName,
      contract
    })
  }

  getContractByName(contractName: string) {
    const contractContainer = this._contracts.find(contract => contract.name == contractName)

    if (!contractContainer) {
      throw new Error(`${contractName} not found`)
    }

    return contractContainer.contract;
  }

  getAddresses() {
    return this._contracts.reduce((obj: any, contractContainer: ContractContainer) => {
      console.log(`${contractContainer.name}:${contractContainer.contract.address}`)
      obj[contractContainer.name] = contractContainer.contract.address;
      return obj;
    }, {})
  }

  getAllContracts() {
    return this._contracts;
  }
}
