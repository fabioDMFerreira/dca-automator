import bre, { ethers } from "@nomiclabs/buidler";
import { BigNumber, Signer, utils } from "ethers";
import ERC20 from "../src/ERC20";

// We expect 4 balance changes
let balanceChangeCounter = 0;

let myUserWallet: Signer;
let myUserAddress: string;

// We also want to keep track of token balances in our UserWallet
let myUserWalletETHBalance: BigNumber;
let myUserWalletKNCBalance: BigNumber;
let myUserWalletDAIBalance: BigNumber;

async function logBalances(erc20Contract: ERC20) {
  try {
    // We get our User Wallet from the Buidler Runtime Env
    [myUserWallet] = await ethers.getSigners();
    myUserAddress = await myUserWallet.getAddress();

    // We also want to keep track of token balances in our UserWallet
    myUserWalletETHBalance = await myUserWallet.getBalance();
    myUserWalletDAIBalance = await erc20Contract.getBalanceOf(myUserAddress)

    const formatMyUserWalletETHBalance = utils
      .formatEther(myUserWalletETHBalance)
      .toString();
    const formatMyUserWalletDAIBalance = utils
      .formatEther(myUserWalletDAIBalance)
      .toString();


    const status = balanceChangeCounter > 0 ? "NEW" : "Current";
    console.log(
      `\n ___💰 ${status} Token BALANCES! ____💰
        \n myUserWallet Address: ${myUserAddress}\n
        \n myUserWallet ETH Balance: ${formatMyUserWalletETHBalance} ETH\n
        \n myUserWallet DAI Balance:   ${formatMyUserWalletDAIBalance} DAI\n
        `
    );
    if (balanceChangeCounter == 3) {
      console.log("\n 3 Balance changes observed ✅ ");
      console.log("\n DEMO FINISHED 🍦 GREAT SUCCESS! ");
      process.exit(0);
    } else {
      console.log("\n ⏰  Listening for new Balance changes ... ⏰  ");
    }
  } catch (error) {
    console.error("\n ❌ logBalances", error);
  }
}

async function monitorBalancesAndLogChange(erc20Contract: ERC20) {
  try {
    const userWalletETHBalance = await myUserWallet.getBalance();
    const userWalletETHBalanceChanged = userWalletETHBalance.eq(
      myUserWalletETHBalance
    )
      ? false
      : true;

    const userWalletDAIBalance = await erc20Contract.getBalanceOf(myUserAddress)

    const userWalletDAIBalanceChanged = userWalletDAIBalance.eq(
      myUserWalletDAIBalance
    )
      ? false
      : true;

    if (userWalletETHBalanceChanged || userWalletDAIBalanceChanged) {
      balanceChangeCounter++;
      await logBalances(erc20Contract);
    }
  } catch (error) {
    console.error("\n ❌ monitorBalancesAndLogChange", error);
  }
}

async function main() {
  const daiContract = new ERC20(ethers.provider, "DAI")

  await logBalances(daiContract);
  monitorBalancesAndLogChange(daiContract);
  setInterval(() => monitorBalancesAndLogChange(daiContract), 20 * 1000);
}

main()
  .catch(
    (err) => console.error(err)
  );
