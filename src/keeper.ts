import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { Contract, ethers } from "ethers";

import ERC20 from './contracts/IERC20.json';
import DCAAccount from './contracts/DCAAccount.json';


export default class Keeper {
  provider: ethers.providers.JsonRpcProvider
  signer: SignerWithAddress
  instaList: Contract
  running: boolean

  constructor(provider: ethers.providers.JsonRpcProvider, signer: SignerWithAddress, instaList: Contract) {
    this.provider = provider;
    this.signer = signer;
    this.instaList = instaList
    this.running = false;
    setInterval(this._execute.bind(this), 1000 * 10)
  }

  async _execute() {
    this.running = true;

    const accountsToDCA: string[] = []

    const nAccounts = +(await this.instaList.accounts()).toString();

    await Promise.all([...Array(nAccounts).keys()].map(
      async accountIndex => {
        const saAddr = (await this.instaList.accountAddr(accountIndex + 1)).toString()

        const dca = await this.getDCADetails(saAddr)

        console.log(saAddr, ":", dca)

        if (dca.timeRef < new Date() && dca.depositAmount < dca.tokenBalance) {
          accountsToDCA.push(saAddr)
        }
      }
    ))

    console.log("accounts to DCA:", accountsToDCA)
    await Promise.all(accountsToDCA.map((address) => {
      this.dca(address)
    }))

    this.running = false;
  }

  async getDCADetails(address: string): Promise<{
    timeRef: Date,
    token: string,
    tokenBalance: number,
    depositAmount: number
  }> {
    const dca = await this.getDCAContract(address)

    const timeRef = await dca.timeRef();
    const depositAmount = await +ethers.utils.formatEther(await dca.depositAmount());
    const token = await dca.token();
    let tokenBalance: number

    if (token === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
      tokenBalance = await +ethers.utils.formatEther(await this.provider.getBalance(address))
    } else {
      const tokenContract = new ethers.Contract(token, ERC20.abi, this.provider)
      tokenBalance = await +ethers.utils.formatEther(await tokenContract.balanceOf(address))
    }

    return {
      timeRef: new Date(+timeRef.toString() * 1000),
      token,
      tokenBalance,
      depositAmount
    }
  }

  async dca(address: string) {
    const dca = await this.getDCAContract(address)

    const tx = await dca.dca(this.signer.address);

    await this.provider.waitForTransaction(tx.hash)
  }

  getDCAContract(address: string): Contract {
    return new ethers.Contract(address, DCAAccount.abi, this.signer)
  }
}
