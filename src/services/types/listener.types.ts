import { TopicFilter } from "ethers";

export type SplitBlocks = {
  from: number;
  to: number;
};
export type TopicFilters = {
  [key in string]: TopicFilter | null;
};
