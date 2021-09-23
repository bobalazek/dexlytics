import commander from 'commander';

import Manager from './manager';

const program = new commander.Command();

// Database - Rebuild
const databaseRebuildCommand = program
  .command('database:rebuild')
  .action(async () => {
    await Manager.databaseRebuild();
    process.exit(0);
  });
;
program.addCommand(databaseRebuildCommand);

// Tokens - Sync
const tokensSyncCommand = program
  .command('tokens:sync')
  .argument('[source]', 'From which source? Options: "coingecko"')
  .option('-b, --batch-inserts', 'You you want to insert the tokens in batch?')
  .action(async (
    source: string = 'coingecko',
    options: any
  ) => {
    await Manager.tokensSync(
      source,
      options?.batchInserts ?? false
    );

    process.exit(0);
  })
;
program.addCommand(tokensSyncCommand);

// Pairs - sync
const pairsSyncCommand = program
  .command('pairs:sync')
  .argument('[exchangeKey]', 'For which exchange? Options: "pancakeswap_v2"')
  .option('-f, --from-block-number <fromBlockNumber>', 'Which is the from block number? Defaults to "0"')
  .option('-t, --to-block-number <toBlockNumber>', 'Which is the to block number? Defaults to "latest"')
  .option('-b, --batch-inserts', 'You you want to insert the pairs in batch?')
  .option('-u, --unprocessed-pairs-only', 'Do we want to only trigger unprocessed pairs?')
  .option('-m, --multithreaded', 'Should it be multithreaded?')
  .action(async (
    exchangeKey: string = 'pancakeswap_v2',
    options: any
  ) => {
    const fromBlockNumber = options?.fromBlockNumber
      ? parseInt(options.fromBlockNumber)
      : 0;
    const toBlockNumber = options?.toBlockNumber && options.toBlockNumber !== 'latest'
      ? parseInt(options.toBlockNumber)
      : 'latest';
    const batchInserts = <boolean>(options?.batchInserts ?? false);
    const unprocessedPairsOnly = <boolean>(options?.unprocessedPairsOnly ?? false);
    const multithreaded = <boolean>(options?.multithreaded ?? false);

    if (multithreaded) {
      await Manager.pairsSyncMultithreaded(
        exchangeKey,
        fromBlockNumber,
        toBlockNumber,
        batchInserts,
        unprocessedPairsOnly
      );
    } else {
      await Manager.pairsSync(
        exchangeKey,
        fromBlockNumber,
        toBlockNumber,
        batchInserts,
        unprocessedPairsOnly
      );
    }

    process.exit(0);
  })
;
program.addCommand(pairsSyncCommand);

// Swaps - sync
const swapsSyncCommand = program
  .command('swaps:sync')
  .argument('[exchangeKey]', 'For which exchange? Options: "pancakeswap_v2"')
  .option('-p, --pair-ids <pairIds>', 'A comma delimited list of all the pairs, for example: "1,2,3,4,5,6"')
  .option('-f, --from-block-number <fromBlockNumber>', 'Which is the from block number? Defaults to "0"')
  .option('-t, --to-block-number <toBlockNumber>', 'Which is the to block number? Defaults to "latest"')
  .option('-b, --batch-inserts', 'You you want to insert the swaps in batch?')
  .option('-u, --unprocessed-pairs-only', 'Do we want to only trigger unprocessed pairs?')
  .option('-m, --multithreaded', 'Should it be multithreaded?')
  .action(async (
    exchangeKey: string = 'pancakeswap_v2',
    options: any
  ) => {
    const fromBlockNumber = options?.fromBlockNumber
      ? parseInt(options.fromBlockNumber)
      : 0;
    const toBlockNumber = options?.toBlockNumber && options.toBlockNumber !== 'latest'
      ? parseInt(options.toBlockNumber)
      : 'latest';
    const batchInserts = <boolean>(options?.batchInserts ?? false);
    const unprocessedPairsOnly = <boolean>(options?.unprocessedPairsOnly ?? false);
    const multithreaded = <boolean>(options?.multithreaded ?? false);
    const pairIds = <number[]>(options?.pairIds?.split(',').map((pairId: string) => {
      return parseInt(pairId);
    }) ?? []);

    if (multithreaded) {
      await Manager.swapsSyncMultithreaded(
        exchangeKey,
        pairIds,
        fromBlockNumber,
        toBlockNumber,
        batchInserts,
        unprocessedPairsOnly
      );
    } else {
      await Manager.swapsSync(
        exchangeKey,
        pairIds,
        fromBlockNumber,
        toBlockNumber,
        batchInserts,
        unprocessedPairsOnly
      );
    }

    process.exit(0);
  })
;
program.addCommand(swapsSyncCommand);

program.parse(process.argv);
