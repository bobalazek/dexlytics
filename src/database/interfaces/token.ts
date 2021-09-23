export default interface TokenInterface {
  id: number;
  name: string;
  symbol: string;
  decimals: number | null;
  platform: string | null;
  address: string | null;
  blockNumber: number | null;
  coingeckoId: string | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}
