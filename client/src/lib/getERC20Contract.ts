import { Contract, ethers } from "ethers"

import IERC20Artifact from "../contracts/IERC20.json";

export default (provider: ethers.providers.Web3Provider, address: string): Contract => {
  return new ethers.Contract(address, IERC20Artifact.abi, provider?.getSigner(0))
}
