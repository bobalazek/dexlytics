export default interface PairSwapRangeInterface {
  id: number;
  pairId: number;
  fromBlockNumber: number;
  toBlockNumber: number;
  startedAt: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
