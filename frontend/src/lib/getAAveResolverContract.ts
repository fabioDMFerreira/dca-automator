import { Contract, ethers } from "ethers"

import artifact from "../contracts/InstaAaveV2Resolver.json";
import contractsAddresses from '../contracts/contract-address.json'

export default (provider: ethers.providers.Web3Provider): Contract => {
  return new ethers.Contract(contractsAddresses.InstaAaveV2Resolver, artifact.abi, provider?.getSigner(0))
}
