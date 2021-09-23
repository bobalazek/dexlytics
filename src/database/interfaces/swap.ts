export default interface SwapInterface {
  id: number;
  transactionHash: string;
  senderAddress: string;
  recipientAddress: string;
  blockNumber: number;
  amount0In: string;
  amount0Out: string;
  amount1In: string;
  amount1Out: string;
  exchangeId: number;
  pairId: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}
