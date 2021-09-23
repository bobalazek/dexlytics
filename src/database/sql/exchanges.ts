const dropExchangesTable = `DROP TABLE IF EXISTS exchanges CASCADE`;

const createExchangesTable = `
  CREATE TABLE exchanges (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NULL,
    factory_contract JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
  INSERT INTO exchanges (key, name, platform, factory_contract)
  VALUES
    (
      'pancakeswap',
      'Pancakeswap (v1)',
      'binance-smart-chain',
      '{
        "address": "0xBCfCcbde45cE874adCB698cC183deBcF17952812",
        "abi": [
          "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
        ],
        "start_block_number": 586851,
        "swap_abi_key": "pancake_pair"
      }'::JSONB
    ),
    (
      'pancakeswap_v2',
      'Pancakeswap (v2)',
      'binance-smart-chain',
      '{
        "address": "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
        "abi": [
          "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
        ],
        "start_block_number": 6809737,
        "swap_abi_key": "pancake_pair"
      }'::JSONB
    ),
    (
      'uniswap',
      'Uniswap (v1)',
      'ethereum',
      null
    ),
    (
      'uniswap_v2',
      'Uniswap (v2)',
      'ethereum',
      '{
        "address": "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        "abi": [
          "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
        ],
        "start_block_number": 10000835,
        "swap_abi_key": null
      }'::JSONB
    ),
    (
      'uniswap_v3',
      'Uniswap (v3)',
      'ethereum',
      '{
        "address": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        "abi": [
          "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)"
        ],
        "start_block_number": 12369621,
        "swap_abi_key": null
      }'::JSONB
    )
  ;
`;

export {
  dropExchangesTable,
  createExchangesTable,
}
