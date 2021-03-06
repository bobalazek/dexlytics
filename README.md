# Dexlytics

Dexlytics is a tool that analyzes token pairs on DEXes.

**Notice: It's still under heavy development and things do not yet work as expected or as fast as they should!**

## Functionality

* Sync tokens (only Coingecko right now)
* Sync created pairs from exchanges (only Pancakeswap V2 right now)
* Sync created pair swaps

## TODO

* Analyze all token data to get the most promising tokens
* Process the price data for each token:
  * OHLCV
  * Current price
  * Price change in the past: 5m, 10m, 15m, 30m, 1h, 2h, 3h, ....
  * All time high and all time low price (amount & time)
  * Current market cap
  * Trading volume in the past: 5m, 10m, 15m,...
  * Holders count
  * Swaps count
  * Current token supply
  * Max token supply
* Analyze large swaps and whales
* Metadata such as date created, twitter link, website, github, trust factor (coingecko and/or dextools), contract data, ...

## Usage

* Rebuild database: `docker exec -it dexlytics_node yarn do database:rebuild`
* Sync tokens: `docker exec -it dexlytics_node yarn do tokens:sync [source] [--batch-inserts]`
* Sync pairs: `docker exec -it dexlytics_node yarn do pairs:sync [exchangeKey] [--from-block-number <fromBlockNumber>|--to-block-number <toBlockNumber>|--batch-inserts|--unprocessed-pairs-only|--multithreaded]`
* Sync swaps: `docker exec -it dexlytics_node yarn do swaps:sync [exchangeKey] [--pair-ids <pairIds>|--from-block-number <fromBlockNumber>|--to-block-number <toBlockNumber>|--batch-inserts|--unprocessed-pairs-only|--multithreaded]`

## Development

First you'll need to create a new `.env` file by copying `.env.example` files content. You will probably also want to use pgadmin and grafana, so for that just duplicate the `docker-compose.override.example.yml` file and rename it to `docker-compose.override.yml`. After that, run `docker-compose build` to build and then `docker-compose up -d` to start the containers.


## License

Dexlytics is licensed under the MIT license.
