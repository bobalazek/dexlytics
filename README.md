# Moonlytics

Moonlytics is a tool that analyzes pairs on DEXes to try and find any potential tokens/pairs that are going to the moon!

**Notice: For the time being, the development on this project is paused until I can figure out a faster way to sync all the swaps from each token on an exchange!**

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

* Rebuild database: `docker exec -it moonlytics_node yarn do database:rebuild`
* Sync tokens: `docker exec -it moonlytics_node yarn do tokens:sync [source] [--batch-inserts]`
* Sync pairs: `docker exec -it moonlytics_node yarn do pairs:sync [exchangeKey] [--from-block-number <fromBlockNumber>|--to-block-number <toBlockNumber>|--batch-inserts|--unprocessed-pairs-only|--multithreaded]`
* Sync swaps: `docker exec -it moonlytics_node yarn do swaps:sync [exchangeKey] [--pair-ids <pairIds>|--from-block-number <fromBlockNumber>|--to-block-number <toBlockNumber>|--batch-inserts|--unprocessed-pairs-only|--multithreaded]`

## Development

First you'll need to create a new `.env` file by copying `.env.example` files content. You will probably also want to use pgadmin and grafana, so for that just duplicate the `docker-compose.override.example.yml` file and rename it to `docker-compose.override.yml`. After that, run `docker-compose build` to build and then `docker-compose up -d` to start the containers.


## License

Moonlytics is licensed under the MIT license.
