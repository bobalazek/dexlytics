const dropPairSwapRangesTable = `DROP TABLE IF EXISTS pair_swap_ranges CASCADE`;

const createPairSwapRangesTable = `
  CREATE TABLE pair_swap_ranges (
    id SERIAL PRIMARY KEY,
    pair_id INTEGER NOT NULL REFERENCES pairs (id),
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
  dropPairSwapRangesTable,
  createPairSwapRangesTable,
}
