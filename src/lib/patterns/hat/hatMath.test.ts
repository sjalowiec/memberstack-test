import { describe, it, expect } from 'vitest';
import {
  calculateHatMath,
  validateHatMath,
  type HatMathInput,
  type HatMathResult,
} from './hatMath';

describe('hatMath', () => {
  it('calculates basic placeholder hat math', () => {
    const input: HatMathInput = {
      headCircumference: 22,
      stitchGauge: 5,
      rowGauge: 7,
      finishedLength: 8,
      negativeEase: 2,
      crownStyle: 'gathered',
      crownDepth: 2,
    };
    const result = calculateHatMath(input);
    expect(result.finishedCircumference).toBe(20);
    expect(result.castOnStitches).toBe(100);
    expect(result.totalRows).toBe(56);
    expect(result.crownRows).toBe(14);
    expect(result.crownStartRow).toBe(42);
  });

  it('sets finalTopStitches equal to cast-on stitches for a gathered crown', () => {
    const input: HatMathInput = {
      headCircumference: 22,
      stitchGauge: 5,
      rowGauge: 7,
      finishedLength: 8,
      negativeEase: 2,
      crownStyle: 'gathered',
      crownDepth: 2,
    };
    const result = calculateHatMath(input);
    expect(result.castOnStitches).toBe(100);
    expect(result.finalTopStitches).toBe(100);
  });

  it('calculates crown start row for a typical gathered hat', () => {
    const input: HatMathInput = {
      headCircumference: 21,
      stitchGauge: 5,
      rowGauge: 8,
      finishedLength: 8.5,
      negativeEase: 1,
      crownStyle: 'gathered',
      crownDepth: 2.5,
    };
    const result = calculateHatMath(input);
    expect(result.totalRows).toBe(68);
    expect(result.crownRows).toBe(20);
    expect(result.crownStartRow).toBe(48);
  });

  it('adjusts cast-on stitches to the nearest multiple when castOnMultiple is provided', () => {
    const input: HatMathInput = {
      headCircumference: 22,
      stitchGauge: 5,
      rowGauge: 7,
      finishedLength: 8,
      negativeEase: 1,
      crownStyle: 'gathered',
      crownDepth: 2,
      castOnMultiple: 8,
    };
    const result = calculateHatMath(input);
    expect(result.finishedCircumference).toBe(21);
    // 21 * 5 = 105 rounded → nearest multiple of 8 is 104
    expect(result.castOnStitches).toBe(104);
  });

  it('validates a normal placeholder result as valid', () => {
    const input: HatMathInput = {
      headCircumference: 22,
      stitchGauge: 5,
      rowGauge: 7,
      finishedLength: 8,
      negativeEase: 2,
      crownStyle: 'gathered',
      crownDepth: 2,
    };
    const result = calculateHatMath(input);
    const validation = validateHatMath(result);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('warns when crown rows are zero', () => {
    const input: HatMathInput = {
      headCircumference: 22,
      stitchGauge: 5,
      rowGauge: 7,
      finishedLength: 8,
      negativeEase: 2,
      crownStyle: 'gathered',
      crownDepth: 0,
    };
    const result = calculateHatMath(input);
    const validation = validateHatMath(result);
    expect(validation.isValid).toBe(true);
    expect(validation.warnings).toContain(
      'Crown rows are zero. Check crown depth and row gauge.',
    );
  });

  it('flags an invalid result when total rows are negative', () => {
    const result: HatMathResult = {
      finishedCircumference: 20,
      castOnStitches: 100,
      totalRows: -5,
      crownRows: 14,
      crownStartRow: 0,
      finalTopStitches: 0,
      notes: [],
    };
    const validation = validateHatMath(result);
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Total rows must be greater than 0.');
  });

  it('handles a range of random hat inputs without producing invalid results', () => {
    for (let i = 0; i < 25; i++) {
      const input: HatMathInput = {
        headCircumference: 18 + Math.random() * (25 - 18),
        stitchGauge: 3 + Math.random() * (8 - 3),
        rowGauge: 5 + Math.random() * (12 - 5),
        finishedLength: 7 + Math.random() * (12 - 7),
        negativeEase: Math.random() * 3,
        crownStyle: 'gathered',
        crownDepth: 1.5 + Math.random() * (4 - 1.5),
      };
      const result = calculateHatMath(input);
      const validation = validateHatMath(result);
      expect(
        validation.isValid,
        `Invalid result for input: ${JSON.stringify(input)}; errors: ${validation.errors.join(', ')}`,
      ).toBe(true);
    }
  });
});
