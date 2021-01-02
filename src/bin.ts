import { ethers } from 'hardhat';
import Keeper from './keeper';

import contractsAddresses from './contracts/contract-address.json'


(async () => {

  const instaList = await ethers.getContractAt("InstaList", contractsAddresses.InstaList)

  const [signer] = await ethers.getSigners()

  let httpProvider = new ethers.providers.JsonRpcProvider();
  // let currentProvider = new web3.providers.HttpProvider('http://localhost:8545');
  // let web3Provider = new ethers.providers.Web3Provider(currentProvider);

  new Keeper(httpProvider, signer, instaList);

})()
