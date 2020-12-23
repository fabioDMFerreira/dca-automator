import useConnectWallet from 'hooks/useConnectWallet';
import useLoadWallet from 'hooks/useLoadWallet';
import useSmartAccounts from 'hooks/useSmartAccounts';
import React from 'react';

import { ConnectWallet } from './ConnectWallet';
import { Loading } from './Loading';
import { NoWalletDetected } from './NoWalletDetected';
import SmartAccount from './SmartAccount';
import SmartAccountsList from './SmartAccountsList';

export default () => {
  const {
    connectWallet,
    isConnectingWallet,
    selectedAddress,
    networkError,
    dismissNetworkError,
  } = useConnectWallet();

  const {
    balance,
    provider,
    contracts,
  } = useLoadWallet(selectedAddress)

  const {
    smartAccounts,
    activeSmartAccount,
    addSmartAccount,
    selectSmartAccount,
    checkAddressIsAuthorized
  } = useSmartAccounts(provider, contracts, selectedAddress)

  // Ethereum wallets inject the window.ethereum object. If it hasn't been
  // injected, we instruct the user to install MetaMask.
  if (window.ethereum === undefined) {
    return <NoWalletDetected />;
  }

  if (isConnectingWallet) {
    return <Loading />;
  }

  if (!selectedAddress) {
    return (
      <ConnectWallet
        connectWallet={connectWallet}
        networkError={networkError}
        dismiss={dismissNetworkError}
      />
    );
  }



  return (
    <div className="container p-4">
      <div className="row">
        <div className="col-12">
          <p>
            Address: {selectedAddress}
          </p>
          <p>ETH: {balance}</p>
        </div>
      </div>

      <hr />

      <button
        className="btn btn-info"
        type="button"
        onClick={() => addSmartAccount()}
      >
        + Add Smart Account
    </button>

      <div className="row mt-4">
        <div className="col-6">
          {
            smartAccounts &&
            <SmartAccountsList
              smartAccounts={smartAccounts}
              setActive={selectSmartAccount}
              activeSmartAccount={activeSmartAccount}
            />
          }
        </div>
        {
          activeSmartAccount &&
          <SmartAccount
            address={activeSmartAccount}
            checkAddressAuthorized={checkAddressIsAuthorized}
          />
        }
      </div>
    </div>
  );
}
