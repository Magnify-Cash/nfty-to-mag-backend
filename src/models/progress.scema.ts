import { model, Schema } from "mongoose";

export interface IProgress {
  _id: string; // lastBlock
  destination: number;
  source: number;
}

const progressSchema = new Schema<IProgress>({
  _id: String,
  destination: { type: Number, required: false },
  source: { type: Number, required: false },
});

export const MongoProgress = model<IProgress>("Progress", progressSchema);
