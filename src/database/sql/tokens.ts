const dropTokensTable = `DROP TABLE IF EXISTS tokens CASCADE`;

const createTokensTable = `
  CREATE TABLE tokens (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NULL,
    platform TEXT NULL,
    address TEXT NULL,
    block_number INTEGER NULL,
    coingecko_id TEXT NULL,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX idx_tokens_platform_address
  ON tokens(platform, address);
  CREATE UNIQUE INDEX idx_tokens_coingecko_id
  ON tokens(coingecko_id);
`;

export {
  dropTokensTable,
  createTokensTable,
}
