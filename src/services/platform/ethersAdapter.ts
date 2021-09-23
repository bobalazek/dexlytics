import { ethers } from 'ethers';

import DatabaseService from '../database';
import PlatformEnum from '../../enums/platform';
import PlatformPairInterface from '../../interfaces/platformPair';
import ExchangeInterface from '../../database/interfaces/exchange';
import PairInterface from '../../database/interfaces/pair';
import PlatformTokenDataInterface from '../../interfaces/platformTokenData';
import PlatformBlockInterface from '../../interfaces/platformBlock';
import PlatformAdapterInterface from './adapter';
import PlatformSwapInterface from '../../interfaces/platformSwap';
import { PROVIDER_NODE_URLS } from '../../config';
import logger from '../../utils/logger';

export default class PlatformEthersAdapter implements PlatformAdapterInterface {
  private _databaseService: DatabaseService;
  private _providers: Map<PlatformEnum, ethers.providers.JsonRpcProvider>;
  private _abis: Map<string, string[]>;

  constructor(databaseService: DatabaseService) {
    this._databaseService = databaseService;
    this._providers = new Map();
    this._abis = new Map();
  }

  getProvider(platform: PlatformEnum): ethers.providers.JsonRpcProvider {
    if (this._providers.has(platform)) {
      return <ethers.providers.JsonRpcProvider>this._providers.get(platform);
    }

    return this.setProvider(platform);
  }

  setProvider(platform: PlatformEnum, url?: string): ethers.providers.JsonRpcProvider {
    if (!PROVIDER_NODE_URLS[platform]) {
      logger.critical(`Provider URLs for platform "${platform}" not found!`);
      process.exit(1);
    }

    const provider = new ethers.providers.JsonRpcProvider(
      url ?? PROVIDER_NODE_URLS[platform][0]
    );

    this._providers.set(platform, provider);

    return provider;
  }

  async rotateProvider(platform: PlatformEnum): Promise<boolean> {
    const nodeUrls = PROVIDER_NODE_URLS[platform];
    const provider = this.getProvider(platform);
    const currentUrl = provider.connection.url;
    const currentUrlIndex = nodeUrls.indexOf(currentUrl);
    const nextUrlIndex = (currentUrlIndex + 1) % nodeUrls.length;
    const url = nodeUrls[nextUrlIndex];

    this.setProvider(platform, url);

    return true;
  }

  async getPairs(
    exchange: ExchangeInterface,
    fromBlock: number,
    toBlock: number
  ): Promise<PlatformPairInterface[]> {
    const provider = this.getProvider(<PlatformEnum>exchange.platform);
    const contract = new ethers.Contract(
      exchange.factoryContract!.address,
      exchange.factoryContract!.abi,
      provider
    );

    const events = await contract.queryFilter(
      contract.filters.PairCreated(),
      fromBlock,
      toBlock
    );

    return events.map((event) => {
      return {
        address: event.args!.pair,
        token0Address: event.args!.token0,
        token1Address: event.args!.token1,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        transactionHash: event.transactionHash,
      };
    });
  }

  async getSwaps(
    exchange: ExchangeInterface,
    pairOrAddresses: PairInterface | string[],
    fromBlock: number,
    toBlock: number
  ): Promise<PlatformSwapInterface[]> {
    const swapAbiKey = exchange.factoryContract!.swapAbiKey || null;
    if (!swapAbiKey) {
      logger.critical('Swap ABI key not found for this exchange!');
      process.exit(1);
    }

    if (!this._abis.has(swapAbiKey)) {
      const erc20Abi = await this._databaseService.abis.getAbiByKey(swapAbiKey);
      if (!erc20Abi) {
        logger.critical(`${swapAbiKey} ERC20 ABI not found!`);
        process.exit(1);
      }
      this._abis.set(swapAbiKey, erc20Abi.data);
    }

    if (Array.isArray(pairOrAddresses)) {
      logger.critical(`Batch addresses not supported in ethers - https://github.com/ethers-io/ethers.js/issues/473`);
      process.exit(1);
    }

    const provider = this.getProvider(<PlatformEnum>exchange.platform);
    const contract = new ethers.Contract(
      pairOrAddresses.address,
      <string[]>this._abis.get(swapAbiKey),
      provider
    );

    const events = await contract.queryFilter(
      contract.filters.Swap(),
      fromBlock,
      toBlock
    );

    return events.map((event) => {
      return {
        pairAddress: event.address,
        senderAddress: event.args!.sender,
        recipientAddress: event.args!.to,
        amount0In: event.args!.amount0In,
        amount0Out: event.args!.amount0Out,
        amount1In: event.args!.amount1In,
        amount1Out: event.args!.amount1Out,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        transactionHash: event.transactionHash,
      };
    });
  }

  async getTokenData(
    platform: PlatformEnum,
    address: string
  ): Promise<PlatformTokenDataInterface | null> {
    if (!this._abis.has('erc20')) {
      const erc20Abi = await this._databaseService.abis.getAbiByKey('erc20');
      if (!erc20Abi) {
        logger.critical('ERC20 ABI not found!');
        process.exit(1);
      }
      this._abis.set('erc20', erc20Abi.data);
    }

    const provider = this.getProvider(platform);
    const contract = new ethers.Contract(
      address,
      <string[]>this._abis.get('erc20'),
      provider
    );

    const name = await contract.name();
    const symbol = await contract.symbol();
    const decimals = await contract.decimals();

    return {
      name,
      symbol,
      decimals,
    };
  }

  async getBlockData(
    platform: PlatformEnum,
    blockNumberOrHash: number | string
  ): Promise<PlatformBlockInterface | null> {
    const provider = this.getProvider(platform);

    const block = await provider.getBlock(
      blockNumberOrHash
    );

    return {
      number: block.number,
      hash: block.hash,
      timestamp: block.timestamp,
      difficulty: block.difficulty,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString(),
    };
  }

  async getLastBlockNumber(platform: PlatformEnum): Promise<number | null> {
    const provider = this.getProvider(platform);

    return await provider.getBlockNumber();
  }
}
