import { Pool, QueryResult } from 'pg';

import DatabaseAbis from './database/abis';
import DatabaseErrors from './database/errors';
import DatabaseExchanges from './database/exchanges';
import DatabasePairs from './database/pairs';
import DatabaseSwaps from './database/swaps';
import DatabaseTokens from './database/tokens';
import { createAbisTable, dropAbisTable } from '../database/sql/abis';
import { createErrorsTable, dropErrorsTable } from '../database/sql/errors';
import { createExchangesTable, dropExchangesTable } from '../database/sql/exchanges';
import { createExchangePairRangesTable, dropExchangePairRangesTable } from '../database/sql/exchangePairRanges';
import { createPairsTable, dropPairsTable } from '../database/sql/pairs';
import { createPairsMetadataTable, dropPairsMetadataTable } from '../database/sql/pairsMetadata';
import { createPairSwapRangesTable, dropPairSwapRangesTable } from '../database/sql/pairSwapRanges';
import { createTokensTable, dropTokensTable } from '../database/sql/tokens';
import { createSwapsTable, dropSwapsTable } from '../database/sql/swaps';
import logger from '../utils/logger';

export default class DatabaseService {
  public abis: DatabaseAbis;
  public errors: DatabaseErrors;
  public exchanges: DatabaseExchanges;
  public pairs: DatabasePairs;
  public swaps: DatabaseSwaps;
  public tokens: DatabaseTokens;

  private _database: Pool;

  constructor(database: Pool) {
    this._database = database;

    this.abis = new DatabaseAbis(this._database);
    this.errors = new DatabaseErrors(this._database);
    this.exchanges = new DatabaseExchanges(this._database);
    this.pairs = new DatabasePairs(this._database);
    this.swaps = new DatabaseSwaps(this._database);
    this.tokens = new DatabaseTokens(this._database);
  }

  async rebuild(): Promise<boolean> {
    // TimescaleDB extension
    logger.notice('Add timescaledb extension ...');
    await this._database.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`);

    // ABIs table
    logger.notice('Drop ABIs table ...');
    await this._database.query(dropAbisTable);

    logger.notice('Create ABIs table ...');
    await this._database.query(createAbisTable);

    // Exchanges table
    logger.notice('Drop exchanges table ...');
    await this._database.query(dropExchangesTable);

    logger.notice('Create exchanges table ...');
    await this._database.query(createExchangesTable);

    // Exchange pair ranges table
    logger.notice('Drop exchange pair ranges table ...');
    await this._database.query(dropExchangePairRangesTable);

    logger.notice('Create exchange pair ranges table ...');
    await this._database.query(createExchangePairRangesTable);

    // Tokens table
    logger.notice('Drop tokens table ...');
    await this._database.query(dropTokensTable);

    logger.notice('Create tokens table ...');
    await this._database.query(createTokensTable);

    // Pairs table
    logger.notice('Drop pairs table ...');
    await this._database.query(dropPairsTable);

    logger.notice('Create pairs table ...');
    await this._database.query(createPairsTable);

    // Pairs metadata table
    logger.notice('Drop pairs metadata table ...');
    await this._database.query(dropPairsMetadataTable);

    logger.notice('Create pairs metadata table ...');
    await this._database.query(createPairsMetadataTable);

    // Pair swap ranges table
    logger.notice('Drop pair swap ranges table ...');
    await this._database.query(dropPairSwapRangesTable);

    logger.notice('Create pair swap ranges table ...');
    await this._database.query(createPairSwapRangesTable);

    // Swaps table
    logger.notice('Drop swaps table ...');
    await this._database.query(dropSwapsTable);

    logger.notice('Create swaps table ...');
    await this._database.query(createSwapsTable);

    // Errors table
    logger.notice('Drop errors table ...');
    await this._database.query(dropErrorsTable);

    logger.notice('Create errors table ...');
    await this._database.query(createErrorsTable);

    return true;
  }

  async query(queryStream: any): Promise<QueryResult<any>> {
    return this._database.query(queryStream);
  }
}
