import { BaseContract, Wallet } from "ethers";
import Erc20Abi from "./abi/erc20.json";
import { Erc20 } from "./types/ERC20";

export default class Erc20Contract {
  readonly contract: Erc20;

  constructor(address: string, wallet: Wallet) {
    this.contract = new BaseContract(address, Erc20Abi, wallet) as Erc20;
  }

  // View

  async symbol(): Promise<string> {
    return this.contract.symbol();
  }

  async decimals(): Promise<number> {
    return Number(await this.contract.decimals());
  }
}
