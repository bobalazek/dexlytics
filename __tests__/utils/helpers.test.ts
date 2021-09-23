/// <reference types="jest" />

import {
  getAvailableSubRanges,
  getAvailableLowestDenominatorSubRanges,
  isInRange,
  mergeRanges,
  splitRangeIntoSubRanges,
} from '../../src/utils/helpers';

describe('utils/helpers.ts', () => {
  it('splitRangeIntoSubRanges', () => {
    expect(splitRangeIntoSubRanges(0, 100, 50)).toStrictEqual([
      [0, 50],
      [50, 100],
    ]);

    expect(splitRangeIntoSubRanges(0, 101, 50)).toStrictEqual([
      [0, 50],
      [50, 100],
      [100, 101],
    ]);

    expect(splitRangeIntoSubRanges(0, 100, 200)).toStrictEqual([
      [0, 100],
    ]);

    expect(splitRangeIntoSubRanges(0, 2, 200)).toStrictEqual([
      [0, 2],
    ]);
  });

  it('getAvailableSubRanges', () => {
    expect(getAvailableSubRanges(0, 100, 50, [])).toStrictEqual([
      [0, 50],
      [50, 100],
    ]);

    expect(getAvailableSubRanges(0, 200, 50, [[10, 20], [90, 100], [160, 170]])).toStrictEqual([
      [0, 10],
      [20, 70],
      [70, 90],
      [100, 150],
      [150, 160],
      [170, 200],
    ]);

    expect(getAvailableSubRanges(0, 200, 50, [[0, 20], [90, 100], [160, 200]])).toStrictEqual([
      [20, 70],
      [70, 90],
      [100, 150],
      [150, 160],
    ]);

    expect(getAvailableSubRanges(0, 200, 300, [[100, 150]])).toStrictEqual([
      [0, 100],
      [150, 200],
    ]);

    expect(getAvailableSubRanges(0, 200, 300, [[1, 1]])).toStrictEqual([
      [0, 1],
      [1, 200],
    ]);

    expect(getAvailableSubRanges(0, 200, 50, [[50, 70]])).toStrictEqual([
      [0, 50],
      [70, 120],
      [120, 170],
      [170, 200],
    ]);

    expect(getAvailableSubRanges(0, 200, 50, [[50, 200]])).toStrictEqual([
      [0, 50],
    ]);

    expect(getAvailableSubRanges(50, 200, 50, [[50, 180]])).toStrictEqual([
      [180, 200],
    ]);

    expect(getAvailableSubRanges(50, 200, 200, [[60, 90]])).toStrictEqual([
      [50, 60],
      [90, 200],
    ]);

    expect(getAvailableSubRanges(50, 200, 200, [[40, 60]])).toStrictEqual([
      [60, 200],
    ]);

    expect(getAvailableSubRanges(50, 200, 200, [[180, 220]])).toStrictEqual([
      [50, 180],
    ]);

    expect(getAvailableSubRanges(50, 200, 200, [[10, 20], [210, 220]])).toStrictEqual([
      [50, 200],
    ]);

    expect(getAvailableSubRanges(50, 200, 200, [[10, 60], [180, 220]])).toStrictEqual([
      [60, 180],
    ]);

    expect(getAvailableSubRanges(50, 200, 50, [[0, 20], [90, 100], [160, 200], [220, 300]])).toStrictEqual([
      [50, 90],
      [100, 150],
      [150, 160],
    ]);

    expect(getAvailableSubRanges(6809737, 9809737, 3000000, [
      [ 6809737, 6814737 ], [ 6814737, 6819737 ], [ 6819737, 6824737 ],
      [ 6824737, 6829737 ], [ 6829737, 6834737 ], [ 6834737, 6839737 ],
      [ 6839737, 6844737 ], [ 6844737, 6849737 ], [ 6849737, 6854737 ],
      [ 6854737, 6859737 ], [ 6859737, 6864737 ], [ 6864737, 6869737 ],
    ])).toStrictEqual([
      [6869737, 9809737],
    ]);
  });

  it.skip('getAvailableLowestDenominatorSubRanges', () => {
    // TODO
  });

  it('mergeRange', () => {
    expect(mergeRanges([[10, 20], [20, 30], [40, 50]])).toStrictEqual([
      [10, 30],
      [40, 50],
    ]);

    expect(mergeRanges([[10, 20], [15, 25], [40, 50]])).toStrictEqual([
      [10, 25],
      [40, 50],
    ]);
  });

  it('isInRange', () => {
    expect(isInRange(10, 10, 20)).toStrictEqual(true);
    expect(isInRange(10, 5, 20)).toStrictEqual(true);
    expect(isInRange(10, 0, 10)).toStrictEqual(true);
    expect(isInRange(10, 11, 20)).toStrictEqual(false);
    expect(isInRange(10, 5, 9)).toStrictEqual(false);
  });
});
