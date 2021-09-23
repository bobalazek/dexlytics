import RangeType from '../types/range';
import logger from './logger';

export function splitRangeIntoSubRanges(from: number, to: number, limit: number): RangeType[] {
  if (to < from) {
    logger.critical('Invalid range. To can not be larger than from!');
    process.exit(1);
  }

  if (!Number.isInteger(from)) {
    logger.critical('The "from" parameter needs bo be an integer!');
    process.exit(1);
  }

  if (!Number.isInteger(to)) {
    logger.critical('The "to" parameter needs bo be an integer!');
    process.exit(1);
  }

  if (!Number.isInteger(limit)) {
    logger.critical('The "limit" parameter needs bo be an integer!');
    process.exit(1);
  }

  let start = from;
  let end = start + limit;
  let ranges: RangeType[] = [];
  while (true) {
    if (to - end <= 0) {
      ranges.push([start, to]);
      break;
    }

    ranges.push([start, end]);

    start += limit;
    end += limit;
  }

  return ranges;
}

export function getAvailableSubRanges(
  from: number,
  to: number,
  limit: number,
  existingRanges: RangeType[]
): RangeType[] {
  // Remove all existing ranges where the from value is less than the total range from
  // and where the to value is higher than the total to value.
  existingRanges = existingRanges.filter((existingRanges) => {
    return existingRanges[1] >= from && existingRanges[0] <= to;
  });

  if (existingRanges.length === 0) {
    return splitRangeIntoSubRanges(
      from,
      to,
      limit
    );
  }

  existingRanges = mergeRanges(existingRanges);

  let currentExistingRangeIndex = 0;
  let currentExistingRange = existingRanges[currentExistingRangeIndex];
  let start = from;
  if (isInRange(start, currentExistingRange[0], currentExistingRange[1])) {
    start = currentExistingRange[1];
    currentExistingRange = existingRanges[++currentExistingRangeIndex];
  }

  let end = start + limit;
  let ranges: RangeType[] = [];
  while (true) {
    if (currentExistingRange) {
      if (start === currentExistingRange[0]) {
        start = currentExistingRange[1];
        end = start + limit;
        currentExistingRange = existingRanges[++currentExistingRangeIndex];
        continue;
      }

      if (end >= currentExistingRange[0]) {
        end = currentExistingRange[0];
        ranges.push([start, end]);

        start = currentExistingRange[1];
        end = start + limit;

        currentExistingRange = existingRanges[++currentExistingRangeIndex];
        if (!currentExistingRange) {
          continue;
        }
      }
    }

    if (to - end <= 0) {
      if (start < to) {
        ranges.push([start, to]);
      }

      break;
    }

    ranges.push([start, end]);

    start += limit;
    end += limit;
  }

  return ranges;
}

export function getAvailableLowestDenominatorSubRanges(
  from: number,
  to: number,
  limit: number,
  existingRanges2D: RangeType[][]
): RangeType[] {
  let existingRangesFinal: RangeType[] = [];
  for (const existingRanges of existingRanges2D) {
    existingRangesFinal.push(...existingRanges)
  }

  // TODO: find the lowest possible denominator accross all the sub ranges.
  // It could be, that one the sub ranges would NOT have a processed range,
  // while other sub ranges would be, so because of that we would still need
  // to process that missing range.

  return getAvailableSubRanges(
    from,
    to,
    limit,
    existingRangesFinal
  );
}

export function mergeRanges(
  ranges: RangeType[]
): RangeType[] {
  if (ranges.length === 0) {
    return [];
  }

  let mergedRanges: RangeType[] = [];

  ranges.sort((a: RangeType, b: RangeType) => {
    return a[0] > b[0] ? 1 : -1;
  });

  // If we have any existing ranges with the same start range, use the one with the biggest range
  const rangesMap = new Map<number, number>();
  ranges.forEach((range) => {
    if (!rangesMap.has(range[0])) {
      rangesMap.set(range[0], range[1]);
    }

    const to = <number>rangesMap.get(range[0]);
    if (to < range[1]) {
      rangesMap.set(range[0], range[1]);
    }
  });

  const newRanges = Array.from(rangesMap);
  let currentExistingRangeIndex = 0;
  let currentExistingRange = newRanges[currentExistingRangeIndex];
  let [
    start,
    end,
  ] = currentExistingRange;
  for (const range of newRanges) {
    if (range[0] <= end) {
      end = Math.max(end, range[1]);
    } else {
      mergedRanges.push([start, end]);
      [
        start,
        end,
      ] = range;
    }
  }
  mergedRanges.push([start, end]);

  return mergedRanges;
}

export function isInRange(value: number, from: number, to: number): boolean {
  return value >= from && value <= to;
}

export function sleep(milliseconds: number): Promise<unknown> {
  return new Promise((resolve) => {
    return setTimeout(resolve, milliseconds);
  });
}
