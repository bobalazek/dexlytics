import AbiInterface from './interfaces/abi';
import ExchangeInterface from './interfaces/exchange';
import ExchangePairRangeInterface from './interfaces/exchangePairRange';
import PairInterface from './interfaces/pair';
import PairSwapRangeInterface from './interfaces/pairSwapRange';
import SwapInterface from './interfaces/swap';
import TokenInterface from './interfaces/token';

export function convertRowToToken(row: any): TokenInterface {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    decimals: row.decimals,
    platform: row.platform,
    address: row.address,
    blockNumber: row.blockNumber,
    coingeckoId: row.coingecko_id,
    timestamp: row.timestamp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function convertRowToPair(row: any): PairInterface {
  return {
    id: row.id,
    exchangeId: row.exchange_id,
    address: row.address,
    blockNumber: row.block_number,
    token0Id: row.token0_id,
    token1Id: row.token1_id,
    timestamp: row.timestamp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function convertRowToExchange(row: any): ExchangeInterface {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    platform: row.platform,
    factoryContract: row.factory_contract
      ? {
        address: row.factory_contract.address,
        abi: row.factory_contract.abi,
        startBlockNumber: row.factory_contract.start_block_number,
        swapAbiKey: row.factory_contract.swap_abi_key,
      }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function convertRowToAbi(row: any): AbiInterface {
  return {
    id: row.id,
    key: row.key,
    data: row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function convertRowToSwap(row: any): SwapInterface {
  return {
    id: row.id,
    transactionHash: row.transaction_hash,
    senderAddress: row.sender_address,
    recipientAddress: row.recipient_address,
    blockNumber: row.block_number,
    amount0In: row.amount0_in,
    amount0Out: row.amount0_out,
    amount1In: row.amount1_in,
    amount1Out: row.amount1_out,
    exchangeId: row.exchange_id,
    pairId: row.pair_id,
    timestamp: row.timestamp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function convertRowToExchangePairRange(row: any): ExchangePairRangeInterface {
  return {
    id: row.id,
    exchangeId: row.exchange_id,
    fromBlockNumber: row.from_block_number,
    toBlockNumber: row.to_block_number,
    startedAt: row.started_at,
    processedAt: row.processed_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function convertRowToPairSwapRange(row: any): PairSwapRangeInterface {
  return {
    id: row.id,
    pairId: row.pair_id,
    fromBlockNumber: row.from_block_number,
    toBlockNumber: row.to_block_number,
    startedAt: row.started_at,
    processedAt: row.processed_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
