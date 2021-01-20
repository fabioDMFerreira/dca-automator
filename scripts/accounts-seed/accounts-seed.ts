import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { network, ethers } from 'hardhat';
import { Contract } from 'ethers';
import { deployContracts } from '../deploy-contracts/deploy-contracts';
import ContractsList from '../ContractsList';

interface ContractContainer {
  name: string,
  contract: Contract
}

// This is a script for deploying your contracts. You can adapt it to deploy
// yours, or create new ones.
export async function accountsSeed(contracts: ContractsList) {
  const signers = await ethers.getSigners();

  console.log("Building dca accounts");

  await Promise.all(
    signers.map(signer => {
      return buildSmartAccounts(signer, contracts, getRndInteger(5, 15))
    }))
}

async function buildSmartAccounts(signer: SignerWithAddress, contracts: ContractsList, numberOfAccounts: number) {
  const signerAddress = await signer.getAddress()

  const instaIndex = contracts.getContractByName("InstaIndex");


  for (let i = 0; i < numberOfAccounts; i++) {
    const depositAmount = getRndFloat(0.01, 5)
    const period = getRndInteger(60, 1800)
    const currentVersion = await instaIndex.versionCount()
    const tx = await instaIndex.build(signerAddress, currentVersion, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", ethers.utils.parseEther(depositAmount.toString()), period, signerAddress)
    await tx.wait()
  }

  const dsaResolver = contracts.getContractByName("InstaDSAResolver");

  const accounts = await dsaResolver.getAuthorityAccounts(signerAddress);

  await Promise.all(accounts.map(
    (account: string) => {
      return signer.sendTransaction({
        to: account,
        value: ethers.utils.parseEther("15")
      })
    }
  ))
}

function getRndInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function getRndFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
