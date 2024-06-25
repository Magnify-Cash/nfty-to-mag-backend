import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
import nodeConfig from "config";
import get from "lodash.get";
import BigNumberJs from "bignumber.js";

BigNumberJs.config({ DECIMAL_PLACES: nodeConfig.get("decimalPlaces") });

export type ChainConfig = {
  rpc: string;
  bridgeContractAddress: string;
  bridgeContractCreationBlock: number;
  name?: string;
  privateKey: string;
};

export type ChainsConfig = Record<"source" | "destination", ChainConfig>;

export type CronConfig = Record<
  "updateCoins" | "searchEvents" | "processQueue" | "refundStuckOrders",
  string
>;

export type TtlConfig = Record<"ordersLifeSec", number>;

export type SourceEventsConfig = Record<
  "send" | "refund" | "addToken" | "removeToken",
  string
>;

export type DestinationEventsConfig = Record<"withdraw", string>;

export type ProgressConfig = {
  block: string;
};

export type ApiConfig = {
  coingecko: string;
};

export type MongoConfig = {
  url: string;
};

export type Config = {
  metadata: Record<string, any>;
  env: string;
  port: number;
  corsWhitelist: string[];
  decimalPlaces: number; // default
  blocksStep: number;
  gasPriceMultiplier: BigNumberJs;
  gasLimitMultiplier: BigNumberJs;
  gasLimitDefault: BigNumberJs;
  chains: ChainsConfig;
  cron: CronConfig;
  ttl: TtlConfig;
  sourceEvents: SourceEventsConfig;
  destinationEvents: DestinationEventsConfig;
  progress: ProgressConfig;
  api: ApiConfig;
  mongo: MongoConfig;
};

class ConfigurationClass {
  private readonly values: Partial<Config>;

  constructor() {
    this.values = this.getConfig();
  }

  get<T>(path?: string): T {
    return path ? get(this.values, path) : this.values;
  }

  setMetadata(metadata: Record<string, any>): void {
    this.values.metadata = metadata;
  }

  private getConfig(): Partial<Config> {
    return {
      env: process.env.NODE_ENV || "development",
      port: parseInt(process.env.PORT || "3000", 10),
      corsWhitelist: process.env.CORS_WHITELIST
        ? process.env.CORS_WHITELIST.split(",")
        : [],
      chains: {
        source: {
          rpc: process.env.SOURCE_RPC || "",
          bridgeContractAddress: process.env.SOURCE_BRIDGE_ADDRESS || "",
          bridgeContractCreationBlock:
            Number(process.env.SOURCE_CREATION_BLOCK) || 0,
          privateKey: process.env.SOURCE_ADMIN_PK || "",
        },
        destination: {
          rpc: process.env.DESTINATION_RPC || "",
          bridgeContractAddress: process.env.DESTINATION_BRIDGE_ADDRESS || "",
          bridgeContractCreationBlock:
            Number(process.env.DESTINATION_CREATION_BLOCK) || 0,
          privateKey: process.env.DESTINATION_ADMIN_PK || "",
        },
      },
      decimalPlaces: nodeConfig.get<number>("decimalPlaces"),
      blocksStep: nodeConfig.get<number>("blocksStep"),
      gasPriceMultiplier: new BigNumberJs(
        nodeConfig.get<number>("gasPriceMultiplier"),
      ),
      gasLimitMultiplier: new BigNumberJs(
        nodeConfig.get<number>("gasLimitMultiplier"),
      ),
      gasLimitDefault: new BigNumberJs(
        nodeConfig.get<number>("gasLimitDefault"),
      ),
      cron: nodeConfig.get<CronConfig>("cron"),
      ttl: nodeConfig.get<TtlConfig>("ttl"),
      sourceEvents: nodeConfig.get<SourceEventsConfig>("sourceEvents"),
      destinationEvents:
        nodeConfig.get<DestinationEventsConfig>("destinationEvents"),
      progress: nodeConfig.get<ProgressConfig>("progress"),
      api: nodeConfig.get<ApiConfig>("api"),
      mongo: {
        url: process.env.MONGO_URL || "",
      },
    };
  }
}

export const config = new ConfigurationClass();
