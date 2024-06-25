import { model, Schema } from "mongoose";

export interface IToken {
  _id: string; // symbol
  destinationAddress: string;
  sourceAddress: string;
  decimals: number;
  logoUrl: string;
}

const tokenSchema = new Schema<IToken>({
  _id: String,
  destinationAddress: { type: String, required: false, index: true },
  sourceAddress: { type: String, required: false, index: true },
  decimals: { type: Number, required: true },
  logoUrl: { type: String, required: false },
});

export const MongoToken = model<IToken>("Token", tokenSchema);
