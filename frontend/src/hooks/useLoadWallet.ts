import { formatEther } from 'ethers/lib/utils';
import { ethers } from "ethers";
import { useEffect, useState } from "react"

import instantiateContracts, { Contracts } from "lib/instantiateContracts";

export default (selectedAddress: string) => {
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  const [balance, setBalance] = useState<string>("")
  const [contracts, setContracts] = useState<Contracts>()

  useEffect(() => {
    if (!provider) {
      return;
    }

    setContracts(instantiateContracts(provider))

    syncBalance();
  }, [selectedAddress])

  const syncBalance = async () => {
    const balance = await provider.getBalance(selectedAddress)

    setBalance(formatEther(balance))
  }

  return {
    balance,
    provider,
    contracts,
    syncBalance,
  };
}
