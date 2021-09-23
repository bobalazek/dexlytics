const dropAbisTable = `DROP TABLE IF EXISTS abis CASCADE`;

const createAbisTable = `
  CREATE TABLE abis (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
  INSERT INTO abis (key, data)
  VALUES
    (
      'erc20',
      '[
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)"
      ]'::JSONB
    ),
    (
      'pancake_pair',
      '[
        "event Mint(address indexed sender, uint amount0, uint amount1)",
        "event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)",
        "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
        "event Sync(uint112 reserve0, uint112 reserve1)"
      ]'::JSONB
    )
  ;
`;

export {
  dropAbisTable,
  createAbisTable,
}
