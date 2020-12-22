import React from "react";

// We'll use ethers to interact with the Ethereum network and our contract
import { ethers } from "ethers";
import { formatEther } from "ethers/lib/utils";

// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import contractAddresses from "../contracts/contract-address.json";
import InstaIndexArtifact from "../contracts/InstaIndex.json";
import InstaListArtifact from "../contracts/InstaList.json";
import InstaAccountArtifact from "../contracts/InstaAccount.json";


// All the logic of this dapp is contained in the Dapp component.
// These other components are just presentational ones: they don't have any
// logic. They just render HTML.
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import SmartAccountsList from "./SmartAccountsList";
import SmartAccount from "./SmartAccount";

// This is the Buidler EVM network id, you might change it in the buidler.config.js
// Here's a list of network ids https://docs.metamask.io/guide/ethereum-provider.html#properties
// to use when deploying to other networks.
const HARDHAT_EVM_CHAIN_ID = '1337';

interface Props { }

// This component is in charge of doing these things:
//   1. It connects to the user's wallet
//   2. Initializes ethers and the Token contract
//   3. Polls the user balance to keep it updated.
//   4. Transfers tokens by sending transactions
//   5. Renders the whole application
//
// Note that (3) and (4) are specific of this sample application, but they show
// you how to keep your Dapp and contract's state in sync,  and how to send a
// transaction.
export class Dapp extends React.Component<Props> {
  // We store multiple things in Dapp's state.
  // You don't need to follow this pattern, but it's an useful example.
  initialState = {
    // The user's address and balance
    isWalletConnected: false,
    isConnectingWallet: false,
  }

  state: {
    isWalletConnected: boolean,
    isConnectingWallet: boolean,

    selectedAddress?: string,
    balance?: string,
    networkError?: string,
    smartAccounts?: string[],
    activeSmartAccount?: string,
  }

  _instaIndex?: ethers.Contract
  _instaList?: ethers.Contract
  _instaAccount?: ethers.Contract

  _pollDataInterval?: NodeJS.Timeout
  _provider?: ethers.providers.Web3Provider

  constructor(props: Props) {
    super(props)

    this.state = this.initialState
  }

  componentDidMount() {
    this._connectWallet()
  }


  render() {
    // Ethereum wallets inject the window.ethereum object. If it hasn't been
    // injected, we instruct the user to install MetaMask.
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    // The next thing we need to do, is to ask the user to connect their wallet.
    // When the wallet gets connected, we are going to save the users's address
    // in the component's state. So, if it hasn't been saved yet, we have
    // to show the ConnectWallet component.
    //
    // Note that we pass it a callback that is going to be called when the user
    // clicks a button. This callback just calls the _connectWallet method.
    if (!this.state.selectedAddress) {
      return (
        <ConnectWallet
          connectWallet={() => this._connectWallet()}
          networkError={this.state.networkError}
          dismiss={() => this._dismissNetworkError()}
        />
      );
    }

    // If the token data or the user's balance hasn't loaded yet, we show
    // a loading component.
    if (this.state.isConnectingWallet) {
      return <Loading />;
    }

    // If everything is loaded, we render the application.
    return (
      <div className="container p-4">
        <div className="row">
          <div className="col-12">
            <p>
              Address: {this.state.selectedAddress}
            </p>
            <p>ETH: {this.state.balance}</p>
          </div>
        </div>

        <hr />

        <button
          className="btn btn-info"
          type="button"
          onClick={() => this._addSmartAccount()}
        >
          + Add Smart Account
        </button>

        <div className="row mt-4">
          <div className="col-6">
            {
              this.state.smartAccounts &&
              <SmartAccountsList
                smartAccounts={this.state.smartAccounts}
                setActive={this._setSmartAccountActive.bind(this)}
                activeSmartAccount={this.state.activeSmartAccount}
              />
            }
          </div>
          {
            this.state.activeSmartAccount &&
            <SmartAccount
              address={this.state.activeSmartAccount}
              checkAddressAuthorized={this._checkAddressAuthorized.bind(this)}
            />
          }
        </div>
      </div>
    );
  }

  componentWillUnmount() {
    // We poll the user's balance, so we have to stop doing that when Dapp
    // gets unmounted
    this._stopPollingData();
  }

  async _connectWallet() {
    this.setState({
      isConnectingWallet: true
    })
    // This method is run when the user clicks the Connect. It connects the
    // dapp to the user's wallet, and initializes it.

    // To connect to the user's wallet, we have to run this method.
    // It returns a promise that will resolve to the user's address.
    const [selectedAddress] = await window.ethereum.enable();

    // Once we have the address, we can initialize the application.

    // First we check the network
    if (!this._checkNetwork()) {
      return;
    }

    this._initialize(selectedAddress);

    // We reinitialize it whenever the user changes their account.
    window.ethereum.on("accountsChanged", ([newAddress]: string[]) => {
      this._stopPollingData();
      // `accountsChanged` event can be triggered with an undefined newAddress.
      // This happens when the user removes the Dapp from the "Connected
      // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
      // To avoid errors, we reset the dapp state
      if (newAddress === undefined) {
        return this._resetState();
      }

      this._initialize(newAddress);
    });

    // We reset the dapp state if the network is changed
    window.ethereum.on("networkChanged", ([networkId]: string[]) => {
      this._stopPollingData();
      this._resetState();
    });
  }

  async _initialize(userAddress: string) {
    // This method initializes the dapp

    // Then, we initialize ethers, fetch the token's data, and start polling
    // for the user's balance.

    // Fetching the token data and the user's balance are specific to this
    // sample project, but you can reuse the same initialization pattern.
    await this._intializeEthers(userAddress);

    await this._instantiateContracts();
    await this._initializeSmartAccounts(userAddress);

    const balance = await this._getEthBalance(userAddress)
    // We first store the user's address in the component's state
    this.setState({
      selectedAddress: userAddress,
      balance,
      isWalletConnected: true,
      isConnectingWallet: false,
    });

  }

  async _initializeSmartAccounts(userAdress: string) {
    const smartAccounts = await this._getSmartAccounts(userAdress);

    this.setState({
      smartAccounts
    })
  }

  async _instantiateContracts() {
    this._instaIndex = new ethers.Contract(
      contractAddresses.InstaIndex,
      InstaIndexArtifact.abi,
      this._provider?.getSigner(0)
    )

    this._instaList = new ethers.Contract(
      contractAddresses.InstaList,
      InstaListArtifact.abi,
      this._provider?.getSigner(0)
    )

    this._instaAccount = new ethers.Contract(
      contractAddresses.DCAAccount,
      InstaAccountArtifact.abi,
      this._provider?.getSigner(0)
    )
  }

  async _getEthBalance(userAddress: string): Promise<string> {
    if (!this._provider) {
      return "";
    }

    const balance = await this._provider.getBalance(userAddress);

    return formatEther(balance)
  }

  async _intializeEthers(userAddress: string) {
    // We first initialize ethers by creating a provider using window.ethereum
    this._provider = new ethers.providers.Web3Provider(window.ethereum);


    // When, we initialize the contract using that provider and the token's
    // artifact. You can do this same thing with your contracts.
    // this._token = new ethers.Contract(
    //   contractAddress.Token,
    //   TokenArtifact.abi,
    //   this._provider.getSigner(0)
    // );
  }

  // The next to methods are needed to start and stop polling data. While
  // the data being polled here is specific to this example, you can use this
  // pattern to read any data from your contracts.
  //
  // Note that if you don't need it to update in near real time, you probably
  // don't need to poll it. If that's the case, you can just fetch it when you
  // initialize the app, as we do with the token data.
  _startPollingData() {
    // this._pollDataInterval = setInterval(() => this._updateBalance(), 1000);

    // We run it once immediately so we don't have to wait for it
    // this._updateBalance();
  }

  _stopPollingData() {
    if (this._pollDataInterval) {
      clearInterval(this._pollDataInterval);
    }
    this._pollDataInterval = undefined;
  }

  // This method just clears part of the state.
  _dismissTransactionError() {
    this.setState({ transactionError: undefined });
  }

  // This method just clears part of the state.
  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  // This is an utility method that turns an RPC error into a human readable
  // message.
  _getRpcErrorMessage(error: any) {
    if (error.data) {
      return error.data.message;
    }

    return error.message;
  }

  // This method resets the state
  _resetState() {
    this.setState(this.initialState);
  }

  // This method checks if Metamask selected network is Localhost:8545
  async _checkNetwork() {
    const chainID = await window.ethereum.request({ method: 'net_version' })
    if (chainID === HARDHAT_EVM_CHAIN_ID) {
      return true;
    }

    this.setState({
      networkError: 'Please connect Metamask to Localhost:8545'
    });

    return false;
  }

  async _addSmartAccount() {
    if (!this._instaIndex || !this._instaList || !this._instaAccount) {
      return
    }

    const versionAccount = await this._instaIndex.versionCount()

    await this._instaIndex.build(this.state.selectedAddress, versionAccount, this.state.selectedAddress)

    let poll = 10;
    while (poll--) {
      await sleep(2000);
      let smartAccounts = await this._getSmartAccounts(this.state.selectedAddress || "");

      if (!this.state.smartAccounts || smartAccounts.length !== this.state.smartAccounts.length) {
        this.setState({
          smartAccounts
        });
        return;
      }
    }
  }

  async _getSmartAccounts(userAddress: string): Promise<string[]> {
    if (!this._instaIndex || !this._instaList || !this._instaAccount) {
      return [];
    }
    let smartAccounts = []

      const userLink = await this._instaList.userLink(userAddress)

      const userList = await this._instaList.userList(userAddress, userLink.first)
      let userListNext = userList.next

      while (userListNext.toString() != "0") {
        let userList = await this._instaList.userList(userAddress, userListNext);
        userListNext = userList.next;
        const accountAddress = await this._instaList.accountAddr(userList[0])
        smartAccounts.push(accountAddress.toString())
      }

    return smartAccounts;
  }

  _setSmartAccountActive(activeSmartAccount: string) {
    this.setState({
      activeSmartAccount
    })
  }

  async _checkAddressAuthorized(smartAccountAddress: string, addressToCheck: String): Promise<boolean> {
    const account = new ethers.Contract(smartAccountAddress, InstaAccountArtifact.abi, this._provider?.getSigner(0))

    const isAuth = await account.isAuth(addressToCheck)

    return isAuth
  }

}

function sleep(timeout: number): Promise<any> {
  return new Promise((accept) => {
    setTimeout(accept, timeout)
  })
}
