import PlatformEnum from '../../enums/platform';
import ExchangeInterface from '../../database/interfaces/exchange';
import PlatformPairInterface from '../../interfaces/platformPair';
import PlatformTokenDataInterface from '../../interfaces/platformTokenData';
import PlatformBlockInterface from '../../interfaces/platformBlock';
import PlatformSwapInterface from '../../interfaces/platformSwap';
import PairInterface from '../../database/interfaces/pair';

export default interface PlatformAdapterInterface {
  rotateProvider(platform: PlatformEnum): Promise<boolean>;

  getPairs(
    exchange: ExchangeInterface,
    fromBlock: number,
    toBlock: number
  ): Promise<PlatformPairInterface[]>;

  getSwaps(
    exchange: ExchangeInterface,
    pairOrAddresses: PairInterface | string[],
    fromBlock: number,
    toBlock: number
  ): Promise<PlatformSwapInterface[]>;

  getTokenData(
    platform: PlatformEnum,
    address: string
  ): Promise<PlatformTokenDataInterface | null>;

  getBlockData(
    platform: PlatformEnum,
    blockNumberOrHash: number | string
  ): Promise<PlatformBlockInterface | null>;

  getLastBlockNumber(platform: PlatformEnum): Promise<number | null>;
}
