import { ERC20ContractsAddresses, ERC20Token } from './config';
import { Contract, providers, Signer } from "ethers";
import { readArtifact } from "@nomiclabs/buidler/plugins";
import { config } from '@nomiclabs/buidler';

export default class ERC20 {
  token: ERC20Token;
  provider: providers.JsonRpcProvider;

  constructor(provider: providers.JsonRpcProvider, token: ERC20Token) {
    this.token = token;
    this.provider = provider;
  }

  async instiateContract(signer?: Signer) {
    const contractAddress = ERC20ContractsAddresses[this.token];
    const { abi } = await readArtifact(config.paths.artifacts, "IERC20");

    return new Contract(contractAddress, abi, signer || this.provider);
  }

  async getBalanceOf(owner: string): Promise<any> {
    const contract = await this.instiateContract();

    return contract.balanceOf(owner);
  }

}
