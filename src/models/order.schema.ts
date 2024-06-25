import { model, Schema } from "mongoose";
import { config, TtlConfig } from "../config";

const ttlConfig = config.get<TtlConfig>("ttl");

export enum Status {
  Sent = "SENT",
  Blocked = "BLOCKED",
  Complete = "COMPLETE",
  Refunded = "REFUNDED",
}

export const orderId = (fromChain: string, fromChainNonce: number | string) => {
  return `${fromChain}:${fromChainNonce}`;
};

export interface IOrder {
  _id: string;
  createdAt: Date;
  fromChain: string;
  toChain: string;
  nonce: string;
  fromUser: string;
  toUser: string;
  tokenFromChain: string;
  tokenOtherChain: string;
  amount: string;
  status: string;
  sendTxHash: string;
  blockTxHash?: string;
  refundTxHash?: string;
  withdrawTxHash?: string;
  createdOnBlock: number;
  updatedOnBlock?: number;
  createdTimestamp: number;
  updatedTimestamp?: number;
}

const orderSchema = new Schema<IOrder>({
  _id: String, // chain:nonce
  createdAt: {
    type: Date,
    expires: ttlConfig.ordersLifeSec,
    default: Date.now,
  },
  fromChain: { type: String, required: true, index: true },
  toChain: { type: String, required: true, index: true },
  nonce: { type: String, required: true, index: true },
  fromUser: { type: String, required: true, index: true },
  toUser: { type: String, required: true, index: true },
  tokenFromChain: { type: String, required: true },
  tokenOtherChain: { type: String, required: true },
  amount: { type: String, required: true },
  status: { type: String, required: true, index: true },
  blockTxHash: { type: String, required: false },
  refundTxHash: { type: String, required: false },
  sendTxHash: { type: String, required: true },
  withdrawTxHash: { type: String, required: false },
  createdOnBlock: { type: Number, required: true },
  updatedOnBlock: { type: Number, required: false },
  createdTimestamp: { type: Number, required: true },
  updatedTimestamp: { type: Number, required: false },
});

export const MongoOrder = model<IOrder>("Order", orderSchema);
