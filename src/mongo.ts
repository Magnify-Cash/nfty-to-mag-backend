import { connect } from "mongoose";
import { config, MongoConfig } from "./config";
import { trueLogger } from "./utils/logs.handler";
import { MongoOrder } from "./models/order.schema";
import { MongoToken } from "./models/token.schema";
import { MongoProgress } from "./models/progress.scema";
import JobsService from "./services/jobs.service";

const mongoConfig = config.get<MongoConfig>("mongo");

export const mongoConnect = async () => {
  const Network =
    await JobsService.getSourceBridgeService.contract.wallet.provider?.getNetwork();
  connect(mongoConfig.url, {
    dbName: "magnify-cash-" + Network?.name,
  })
    .then(() => {
      trueLogger().info(`Connected to MongoDB!`);
      MongoProgress.createIndexes()
        .then(() => trueLogger().info("MongoProgress indexes created!"))
        .catch((e) => trueLogger().error("MongoProgress indexes => " + e));
      MongoOrder.createIndexes()
        .then(() => trueLogger().info("MongoOrder indexes created!"))
        .catch((e) => trueLogger().error("MongoOrder indexes => " + e));
      MongoToken.createIndexes()
        .then(() => trueLogger().info("MongoToken indexes created!"))
        .catch((e) => trueLogger().error("MongoToken indexes => " + e));
    })
    .catch((err: any) => trueLogger().emerg("" + err));
};
