import { ChainConfig, config } from "./config";
import { BlockTag, ethers, JsonRpcProvider, Wallet } from "ethers";
import BigNumberJs from "bignumber.js";

export default class Connection {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly wallet: Wallet;

  constructor(config: ChainConfig) {
    this.provider = new JsonRpcProvider(config.rpc);
    this.wallet = new Wallet(config.privateKey, this.provider);
  }

  async calculateNonce() {
    return this.provider.getTransactionCount(this.wallet.address, "latest");
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  async getNetworkFeeData() {
    return this.provider.getFeeData();
  }

  getWallet(): Wallet {
    return this.wallet;
  }

  async getBlock(block?: BlockTag) {
    return this.provider.getBlock(block || "latest");
  }

  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async getTransaction(txHash: string) {
    return this.provider.getTransaction(txHash);
  }

  approveGasPrice(estimation: bigint) {
    return config
      .get<BigNumberJs>("gasPriceMultiplier")
      .multipliedBy(estimation.toString())
      .toFixed(0);
  }

  async approveGasLimit() {
    const block = await this.getBlock();
    if (!block) {
      return config.get<BigNumberJs>("gasLimitDefault").toFixed(0);
    }
    return config
      .get<BigNumberJs>("gasLimitMultiplier")
      .multipliedBy(block.gasLimit.toString())
      .toFixed(0);
  }
}
