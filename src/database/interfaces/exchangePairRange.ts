export default interface ExchangePairRangeInterface {
  id: number;
  exchangeId: number;
  fromBlockNumber: number;
  toBlockNumber: number;
  startedAt: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
