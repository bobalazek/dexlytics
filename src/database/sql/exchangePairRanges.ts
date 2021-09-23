const dropExchangePairRangesTable = `DROP TABLE IF EXISTS exchange_pair_ranges CASCADE`;

const createExchangePairRangesTable = `
  CREATE TABLE exchange_pair_ranges (
    id SERIAL PRIMARY KEY,
    exchange_id INTEGER NOT NULL REFERENCES exchanges (id),
    from_block_number INTEGER NOT NULL,
    to_block_number INTEGER NOT NULL,
    started_at TIMESTAMP NULL,
    processed_at TIMESTAMP NULL,
    failed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
`;

export {
  dropExchangePairRangesTable,
  createExchangePairRangesTable,
}
