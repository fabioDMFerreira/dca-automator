import { Contract, ethers } from "ethers"

import DCAAccountArtifact from "../contracts/DCAAccount.json";

export default (provider: ethers.providers.Web3Provider, smartAccountAddress: string): Contract => {
  return new ethers.Contract(smartAccountAddress, DCAAccountArtifact.abi, provider?.getSigner(0))
}
