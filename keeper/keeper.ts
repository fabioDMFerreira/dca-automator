import { Contract, ethers, Signer } from "ethers";
import fs from 'fs';

import ERC20 from './contracts/IERC20.json';
import DCAAccount from './contracts/DCAAccount.json';
import InstaIndex from './contracts/InstaIndex.json';

import contractAddresses from './contracts/contract-address.json';

const LogFile = `reports/gas-cost-txs.csv`;

export default class Keeper {
  provider: ethers.providers.JsonRpcProvider
  signer: Signer
  instaList: Contract
  running: boolean

  constructor(provider: ethers.providers.JsonRpcProvider, signer: Signer, instaList: Contract) {
    this.provider = provider;
    this.signer = signer;
    this.instaList = instaList
    this.running = false;

    fs.writeFileSync(LogFile, "# deposits,Sum of deposits,Gas cost(eth),Gas cost($),1ETH = 1000$,Test details(80-150 contracts dcaing every 1min/30min and depositing 0.01ETH/2ETH in the aave ethereum liquidity the pool)\n")

    setInterval(this._execute.bind(this), 1000 * 30 * 1)
    this._execute.bind(this);
  }

  async _execute() {
    if (this.running) {
      return;
    }

    this.running = true;

    const accountsToDCA: string[] = []

    const nAccounts = +(await this.instaList.accounts()).toString();
    let sumDeposit = 0;

    await Promise.all([...Array(nAccounts).keys()].map(
      async accountIndex => {
        const saAddr = (await this.instaList.accountAddr(accountIndex + 1)).toString()

        const dca = await this.getDCADetails(saAddr)

        if (dca.timeRef < new Date() && dca.depositAmount < dca.tokenBalance && accountsToDCA.length < 12) {
          sumDeposit += dca.depositAmount
          console.log({
            ...dca
          })
          accountsToDCA.push(saAddr)
        }
      }
    ))

    console.log("accounts to DCA:", accountsToDCA)
    try {
      if (accountsToDCA.length >= 1) {
        await this.batchDCA(accountsToDCA, sumDeposit);
      }
    } catch (err) {
      console.log("batch DCA failed", err)
    }
    // await Promise.all(accountsToDCA.map((address) => {
    //   this.dca(address)
    //     .catch(err => {
    //       console.log("failed dca", address);
    //       console.log(err);
    //     })
    // }))

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

    const signerAddress = await this.signer.getAddress()

    const tx = await dca.dca(signerAddress);

    await this.provider.waitForTransaction(tx.hash)

    console.log("dca executed: ", address)
  }

  async batchDCA(addresses: string[], sum: number) {
    let retries = 3;

    while (retries-- > 0) {
      let tx;
      try {
        const instaIndex = await this.getInstaIndexContract()

        tx = await instaIndex.batchDCA(addresses);

        console.log('waiting for confirmation')
        await this.provider.waitForTransaction(tx.hash, 1, 60000)
        console.log('tx confirmed')

        console.log("getting tx receipt")
        const receipt = await this.provider.getTransactionReceipt(tx.hash);
        console.log("calculating gas cost")

        let gasUsed = receipt.gasUsed
        let gasPrice = tx.gasPrice
        let gasLimit = tx.gasLimit

        gasUsed = gasUsed
        gasPrice = gasPrice
        gasLimit = gasLimit

        const gasCost = +ethers.utils.formatEther(gasUsed.mul(gasPrice));

        console.log(`Gas spent dcaing ${addresses.length} accounts: ${gasCost}ETH (+- ${gasCost * 1000}$)`)
        fs.appendFileSync(LogFile, `${addresses.length},${sum},${gasCost},${gasCost * 1000}\n`)
        return
      } catch (err) {
        console.log(err)
        await sleep(2000)
      }
    }
  }

  getDCAContract(address: string): Contract {
    return new ethers.Contract(address, DCAAccount.abi, this.signer)
  }

  getInstaIndexContract(): Contract {
    return new ethers.Contract(contractAddresses.InstaIndex, InstaIndex.abi, this.signer)
  }
}

function sleep(timeout: number) {
  return new Promise(function (resolve, reject) {

    // Setting 2000 ms time
    setTimeout(resolve, timeout);
  })
}

