export default interface PlatformSwapInterface {
  pairAddress: string;
  senderAddress: string;
  recipientAddress: string;
  amount0In: string;
  amount0Out: string;
  amount1In: string;
  amount1Out: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
}
