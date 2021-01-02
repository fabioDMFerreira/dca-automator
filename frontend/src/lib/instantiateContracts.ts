import { Contract, ethers } from "ethers"
// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import contractAddresses from "../contracts/contract-address.json";
import InstaIndexArtifact from "../contracts/InstaIndex.json";
import InstaListArtifact from "../contracts/InstaList.json";
import DCAAccountArtifact from "../contracts/DCAAccount.json";
import InstaDSAResolverArtifact from "../contracts/InstaDSAResolver.json";
export interface Contracts {
  instaIndex: Contract,
  instaList: Contract,
  dcaAccount: Contract,
  dsaResolver: Contract,
}

export default (provider: ethers.providers.Web3Provider) => {
  return {
    instaIndex: new ethers.Contract(
      contractAddresses.InstaIndex,
      InstaIndexArtifact.abi,
      provider?.getSigner(0)
    ),

    instaList: new ethers.Contract(
      contractAddresses.InstaList,
      InstaListArtifact.abi,
      provider?.getSigner(0)
    ),

    dcaAccount: new ethers.Contract(
      contractAddresses.DCAAccount,
      DCAAccountArtifact.abi,
      provider?.getSigner(0)
    ),

    dsaResolver: new ethers.Contract(
      contractAddresses.InstaDSAResolver,
      InstaDSAResolverArtifact.abi,
      provider?.getSigner(0)
    ),
  }
}
