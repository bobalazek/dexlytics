export default interface ExchangeInterface {
  id: number;
  key: string;
  name: string;
  platform: string | null;
  factoryContract: ExchangeContractInterface | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExchangeContractInterface {
  address: string;
  abi: string[];
  startBlockNumber: number;
  swapAbiKey: string | null;
}
