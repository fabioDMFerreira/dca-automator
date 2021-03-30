import Keeper from './keeper';

import contractsAddresses from './contracts/contract-address.json';
import InstaList from './contracts/InstaList.json';
import { ethers } from 'ethers';


(async () => {
  const provider = new ethers.providers.JsonRpcProvider();

  const signer = await provider.getSigner()

  const instaList = new ethers.Contract(contractsAddresses.InstaList, InstaList.abi, signer)

  new Keeper(provider, signer, instaList);
})()
