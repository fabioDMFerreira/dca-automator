import { useState } from 'react';

// This is the Buidler EVM network id, you might change it in the buidler.config.js
// Here's a list of network ids https://docs.metamask.io/guide/ethereum-provider.html#properties
// to use when deploying to other networks.
const HARDHAT_EVM_CHAIN_ID = '1337';

export default () => {
  const [selectedAddress, setSelectedAddress] = useState<string>("")
  const [isConnectingWallet, setConnectingWallet] = useState<boolean>(false)
  const [networkError, setNetworkError] = useState<string>("")

  async function connectWallet() {
    setConnectingWallet(true)

    const [address] = await window.ethereum.enable();

    setSelectedAddress(address)

    checkNetwork()

    setConnectingWallet(false)
  }

  async function checkNetwork() {
    const chainID = await window.ethereum.request({ method: 'net_version' })
    if (chainID === HARDHAT_EVM_CHAIN_ID) {
      return true;
    }

    setNetworkError('Please connect Metamask to Localhost:8545');

    return false;
  }

  async function disconnectWallet() {
    setSelectedAddress("")
  }

  function dismissNetworkError() {
    setNetworkError("")
  }

  // We reinitialize it whenever the user changes their account.
  window.ethereum.on("accountsChanged", ([newAddress]: string[]) => {
    // `accountsChanged` event can be triggered with an undefined newAddress.
    // This happens when the user removes the Dapp from the "Connected
    // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
    // To avoid errors, we reset the dapp state
    if (newAddress === undefined) {
      return setSelectedAddress("")
    }

    setSelectedAddress(newAddress)

    checkNetwork()
  });

  // We reset the dapp state if the network is changed
  window.ethereum.on("networkChanged", ([networkId]: string[]) => {
    setSelectedAddress("")
  });

  return {
    isConnectingWallet,
    selectedAddress,
    networkError,
    connectWallet,
    disconnectWallet,
    dismissNetworkError,
  }
}
