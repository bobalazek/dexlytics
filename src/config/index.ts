import PlatformEnum from '../enums/platform';
import PlatformServiceProviderEnum from '../enums/platformProvider';

const PROVIDER_NODE_URLS = {
  [PlatformEnum.ETHEREUM]: [
    'https://mainnet.infura.io/',
  ],
  [PlatformEnum.BINANCE_SMART_CHAIN]: [
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://bsc-dataseed3.binance.org/',
    'https://bsc-dataseed4.binance.org/',
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-dataseed2.defibit.io/',
    'https://bsc-dataseed4.defibit.io/',
    'https://bsc-dataseed1.ninicoin.io/',
    'https://bsc-dataseed2.ninicoin.io/',
    'https://bsc-dataseed3.ninicoin.io/',
    'https://bsc-dataseed4.ninicoin.io/',
    'wss://bsc-ws-node.nariox.org:443',
  ],
};

const DEFAULT_DATE = '1970-01-01 00:00:00';

// For now, we can't really use ethers because it doesn't support multiple addresses for swaps,
// which makes it unusable...
const DEFAULT_PLATFORM_SERVICE_PROVIDER = PlatformServiceProviderEnum.WEB3;

const MAX_BLOCK_RANGE = 5000;

// Let's do 3 block ranges at the time, so we won't need to spawn new processes "too" often
const MULTITHREADING_MAX_BLOCK_RANGE = MAX_BLOCK_RANGE * 3;

export {
  PROVIDER_NODE_URLS,
  DEFAULT_DATE,
  DEFAULT_PLATFORM_SERVICE_PROVIDER,
  MAX_BLOCK_RANGE,
  MULTITHREADING_MAX_BLOCK_RANGE,
}
