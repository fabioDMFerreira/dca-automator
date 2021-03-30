import { Contract } from "ethers"
import { parseEther } from "ethers/lib/utils"

export interface CreateDCAContractPayload {
  sellAmount: string,
  token: string,
  period: number
}

export default async (instaIndex: Contract, selectedAddress: string, payload: CreateDCAContractPayload) => {
  const versionAccount = await instaIndex.versionCount()

  await instaIndex.build(selectedAddress, versionAccount, payload.token, parseEther(payload.sellAmount), payload.period, selectedAddress)
}
