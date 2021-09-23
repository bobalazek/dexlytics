import { Pool } from 'pg';
import { serializeError } from 'serialize-error';

export default class DatabaseErrors {
  private _database: Pool;

  constructor(database: Pool) {
    this._database = database;
  }

  async insertError(parameters: any = null, error: any = null): Promise<boolean> {
    await this._database.query(`
      INSERT INTO errors (parameters, error)
      VALUES ($1::JSONB, $2::JSONB)
    `, [
      parameters,
      serializeError(error),
    ]);

    return true;
  }
}
