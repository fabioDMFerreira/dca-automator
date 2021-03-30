import useAaveResolver from 'hooks/useAaveResolver';
import useConnectWallet from 'hooks/useConnectWallet';
import useLoadWallet from 'hooks/useLoadWallet';
import useSmartAccounts from 'hooks/useSmartAccounts';
import { formatTokenAmount } from 'lib/token';
import React from 'react';
import AddDCAContract from './AddDCAContract';

import { ConnectWallet } from './ConnectWallet';
import { Loading } from './Loading';
import { NoWalletDetected } from './NoWalletDetected';
import SmartAccount from './SmartAccount';
import SmartAccountsList from './SmartAccountsList';

export default () => {
  // Ethereum wallets inject the window.ethereum object. If it hasn't been
  // injected, we instruct the user to install MetaMask.
  if (window.ethereum === undefined) {
    return <NoWalletDetected />;
  }

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
    syncBalance,
  } = useLoadWallet(selectedAddress)

  const {
    smartAccounts,
    loadingDCA,
    activeSmartAccount,
    loadingRefresh,
    buildDCAAccount,
    selectSmartAccount,
    depositToken,
    withdrawToken,
    depositLiquidityPool,
    withdrawLiquidityPool,
    refresh
  } = useSmartAccounts(provider, contracts, selectedAddress, syncBalance)

  const {
    tokens
  } = useAaveResolver();

  if (isConnectingWallet) {
    return <Loading />;
  }

  if (!selectedAddress || networkError) {
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
        <div className="col-4">
          <p>
            {selectedAddress}
          </p>
          {
            balance &&
            <p>{formatTokenAmount(+balance)}ETH</p>
          }
        </div>
        <div className="col-8 ">
          <AddDCAContract
            buildDCAContract={buildDCAAccount}
            tokens={tokens}
          />
        </div>
      </div>

      <button className="btn btn-info" disabled={loadingRefresh} onClick={refresh}>Refresh</button>

      {
        smartAccounts &&
        <div className="mb-4">
          <SmartAccountsList
            smartAccounts={smartAccounts}
            setActive={selectSmartAccount}
            activeSmartAccount={activeSmartAccount?.address}
            loading={loadingDCA}
          />
        </div>
      }

      {
        activeSmartAccount &&
        <SmartAccount
          account={activeSmartAccount}
          depositToken={depositToken}
          withdrawToken={withdrawToken}
          depositLiquidityPool={depositLiquidityPool}
          withdrawLiquidityPool={withdrawLiquidityPool}
        />
      }
    </div >
  );
}
