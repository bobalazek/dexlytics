import { ethers } from 'ethers';
import Web3 from 'web3';
import { AbiItem, AbiInput } from 'web3-utils';
import { EventData } from 'web3-eth-contract';
import Web3EthAbi from 'web3-eth-abi';

import DatabaseService from '../database';
import PlatformEnum from '../../enums/platform';
import PlatformPairInterface from '../../interfaces/platformPair';
import ExchangeInterface from '../../database/interfaces/exchange';
import PlatformTokenDataInterface from '../../interfaces/platformTokenData';
import PairInterface from '../../database/interfaces/pair';
import PlatformBlockInterface from '../../interfaces/platformBlock';
import PlatformSwapInterface from '../../interfaces/platformSwap';
import PlatformAdapterInterface from './adapter';
import { PROVIDER_NODE_URLS } from '../../config';
import logger from '../../utils/logger';

export default class PlatformWeb3Adapter implements PlatformAdapterInterface {
  private _databaseService: DatabaseService;
  private _providers: Map<PlatformEnum, Web3>;
  private _abis: Map<string, string[]>;

  constructor(databaseService: DatabaseService) {
    this._databaseService = databaseService;
    this._providers = new Map();
    this._abis = new Map();
  }

  getProvider(platform: PlatformEnum): Web3 {
    if (this._providers.has(platform)) {
      return <Web3>this._providers.get(platform);
    }

    return this.setProvider(platform);
  }

  setProvider(platform: PlatformEnum, url?: string): Web3 {
    if (!PROVIDER_NODE_URLS[platform]) {
      logger.critical(`Provider URLs for platform "${platform}" not found!`);
      process.exit(1);
    }

    const provider = new Web3(
      url ?? PROVIDER_NODE_URLS[platform][0]
    );

    this._providers.set(platform, provider);

    return provider;
  }

  async rotateProvider(platform: PlatformEnum): Promise<boolean> {
    const nodeUrls = PROVIDER_NODE_URLS[platform];
    const provider = this.getProvider(platform);
    const currentUrl = (<any>provider.currentProvider).host;
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
    const abi = this.getAbi(exchange.factoryContract!.abi);
    const provider = this.getProvider(<PlatformEnum>exchange.platform);
    const contract = new provider.eth.Contract(
      abi,
      exchange.factoryContract!.address
    );

    const events = await contract.getPastEvents('PairCreated', {
      fromBlock,
      toBlock,
    });

    return events.map((event) => {
      return {
        address: event.returnValues.pair,
        token0Address: event.returnValues.token0,
        token1Address: event.returnValues.token1,
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

    const abiJsonInterface = new ethers.utils.Interface(<string[]>this._abis.get(swapAbiKey));
    const abi = this.getAbi(abiJsonInterface);
    const provider = this.getProvider(<PlatformEnum>exchange.platform);

    let events: EventData[] = [];
    if (
      !Array.isArray(pairOrAddresses) ||
      pairOrAddresses.length === 1
    ) {
      const contract = new provider.eth.Contract(
        abi,
        Array.isArray(pairOrAddresses)
          ? pairOrAddresses[0]
          : pairOrAddresses.address
      );
      events = await contract.getPastEvents('Swap', {
        fromBlock,
        toBlock,
      });
    } else {
      const swapAbi = Array.isArray(abi)
        ? abi.find((abiItem) => {
          return abiItem.name === 'Swap';
        })
        : abi;
      if (!swapAbi) {
        logger.critical(`Swap ABI item not found!`);
        process.exit(1);
      }

      const logs = await provider.eth.getPastLogs({
        fromBlock,
        toBlock,
        address: pairOrAddresses,
        topics: [
          abiJsonInterface.getEventTopic('Swap'),
        ],
      });
      for (const log of logs) {
        let event = swapAbi;

        // https://github.com/ChainSafe/web3.js/blob/1.x/packages/web3-eth-contract/src/index.js#L464-L476
        if (!event.anonymous){
          let indexedInputs = 0;
          event.inputs!.forEach((input) => {
            return input.indexed
              ? indexedInputs++
              : null;
          });

          if (indexedInputs > 0 && (log.topics.length !== indexedInputs + 1)){
            event = {
              anonymous: true,
              inputs: [],
              type: 'event',
            };
          }
        }

        const returnValues = (<any>Web3EthAbi).decodeLog(
          event.inputs,
          log.data,
          event.anonymous
            ? log.topics
            : log.topics.slice(1)
        );
        delete returnValues.__length__;

        if (Object.keys(returnValues).length === 0) {
          continue;
        }

        events.push({
          returnValues,
          raw: {
            data: log.data,
            topics: log.topics,
          },
          event: <string>(event.name ?? ''),
          signature: !event.anonymous && log.topics.length > 0
            ? log.topics[0]
            : '',
          logIndex: log.logIndex,
          transactionIndex: log.transactionIndex,
          transactionHash: log.transactionHash,
          blockHash: log.blockHash,
          blockNumber: log.blockNumber,
          address: log.address,
        });
      }
    }

    return events.map((event) => {
      return {
        pairAddress: event.address,
        senderAddress: event.returnValues.sender,
        recipientAddress: event.returnValues.to,
        amount0In: event.returnValues.amount0In,
        amount0Out: event.returnValues.amount0Out,
        amount1In: event.returnValues.amount1In,
        amount1Out: event.returnValues.amount1Out,
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
    const abi = this.getAbi(<string[]>this._abis.get('erc20'));
    const contract = new provider.eth.Contract(
      abi,
      address
    );

    const name = await contract.methods.name().call();
    const symbol = await contract.methods.symbol().call();
    const decimals = await contract.methods.decimals().call();

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

    const block = await provider.eth.getBlock(
      blockNumberOrHash
    );

    return {
      number: block.number,
      hash: block.hash,
      timestamp: typeof block.timestamp === 'string'
        ? (new Date(block.timestamp)).getTime() / 1000
        : block.timestamp,
      difficulty: block.difficulty,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString(),
    };
  }

  async getLastBlockNumber(platform: PlatformEnum): Promise<number | null> {
    const provider = this.getProvider(platform);

    return await provider.eth.getBlockNumber();
  }

  getAbi(abiArrayOrJsonInterface: string[] | ethers.utils.Interface): AbiItem | AbiItem[] {
    const abiJsonInterface = Array.isArray(abiArrayOrJsonInterface)
      ? new ethers.utils.Interface(abiArrayOrJsonInterface)
      : abiArrayOrJsonInterface;
    const abiStringOrArray = abiJsonInterface.format(ethers.utils.FormatTypes.json);
    const abi = <AbiItem | AbiItem[]><unknown>(typeof abiStringOrArray === 'string'
      ? JSON.parse(abiStringOrArray)
      : abiStringOrArray.map((abiString) => {
        return JSON.parse(abiString);
      })
    );

    // Workaround, because for some reason web3 doesn't work if the input here is undefined,
    // but the ethers parser above does return that one undefined.
    const fixAbiUndefinedName = (data: AbiInput[]) => {
      if (!(data instanceof Array)) {
        return data;
      }

      for (const key in data) {
        if (typeof data[key].name === 'undefined') {
          data[key].name = '';
        }
      }

      return data;
    };

    if (Array.isArray(abi)) {
      for (const key in abi) {
        abi[key].inputs = fixAbiUndefinedName(<AbiInput[]>abi[key].inputs);
        abi[key].outputs = fixAbiUndefinedName(<AbiInput[]>abi[key].outputs);
      }
    } else {
      abi.inputs = fixAbiUndefinedName(<AbiInput[]>abi.inputs);
      abi.outputs = fixAbiUndefinedName(<AbiInput[]>abi.outputs);
    }

    return abi;
  }
}
