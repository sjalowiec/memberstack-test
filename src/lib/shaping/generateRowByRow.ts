/**
 * Row-by-Row Shaping Generator
 * 
 * A reusable "lego block" utility for generating row-by-row shaping instructions.
 * Can be used across the entire Knit by Machine site:
 * - Shaping Formula tools
 * - Patterns
 * - Skill builders
 * - Any shaping calculator or practice worksheet
 */

/**
 * A single shaping step definition.
 * This represents one instruction like "decrease 1 stitch every 4 rows, 5 times"
 */
export interface ShapingStep {
  sts: number;    // Number of stitches to increase/decrease per action
  rows: number;   // Interval between shaping actions (every N rows)
  times: number;  // How many times to repeat this shaping action
}

/**
 * A single row entry in the breakdown table.
 * Represents one shaping action at a specific row.
 */
export interface RowEntry {
  rowNumber: number;       // The row where shaping occurs
  action: string;          // e.g., "Decrease 1 stitch" or "Increase 1 stitch"
  location: string;        // "Both sides" | "One side only"
  stitchesAfter: number;   // Total stitches AFTER this shaping action
}

/**
 * Configuration options for the row-by-row generator
 */
export interface GenerateRowByRowOptions {
  startingStitches: number;           // Initial stitch count before any shaping
  steps: ShapingStep[];               // Array of shaping steps in order
  shapingMode: 'both' | 'one';        // Whether shaping occurs on both sides or one side
  direction?: 'decrease' | 'increase'; // Default: 'decrease'
}

/**
 * Generates a row-by-row breakdown of shaping actions.
 * 
 * This function takes shaping instructions in the form of steps (sts/rows/times)
 * and expands them into a complete row-by-row breakdown showing exactly when
 * each shaping action occurs and the running stitch total.
 * 
 * @param options - Configuration for generating the breakdown
 * @returns Array of RowEntry objects representing each shaping action
 * 
 * @example
 * ```ts
 * const breakdown = generateRowByRow({
 *   startingStitches: 100,
 *   steps: [
 *     { sts: 1, rows: 4, times: 5 },  // dec 1 st every 4 rows, 5 times
 *     { sts: 1, rows: 6, times: 3 },  // dec 1 st every 6 rows, 3 times
 *   ],
 *   shapingMode: 'both',
 *   direction: 'decrease'
 * });
 * // Returns 8 entries showing rows 4, 8, 12, 16, 20, 26, 32, 38
 * // with running stitch totals: 98, 96, 94, 92, 90, 88, 86, 84
 * ```
 */
export function generateRowByRow(options: GenerateRowByRowOptions): RowEntry[] {
  const {
    startingStitches,
    steps,
    shapingMode,
    direction = 'decrease'
  } = options;

  const entries: RowEntry[] = [];
  
  // Track the current stitch count as we process each shaping action
  // This represents the TOTAL number of stitches on the needles
  let currentStitches = startingStitches;
  
  // Track the current row number as we progress through the piece
  // Shaping typically starts at row 2 (row 1 is the setup row with no shaping)
  let currentRow = 0;

  // Determine the stitch change per action based on shaping mode:
  // - "both" mode: Each action affects BOTH edges, so we add/remove 2x the sts value
  //   Example: "decrease 1 stitch each side" removes 2 total stitches (1 left + 1 right)
  // - "one" mode: Each action affects only ONE edge, so we add/remove exactly sts value
  //   Example: "decrease 1 stitch on right side only" removes 1 total stitch
  const stitchMultiplier = shapingMode === 'both' ? 2 : 1;
  
  // Format the location text for display
  const locationText = shapingMode === 'both' ? 'Both sides' : 'One side only';

  // Process each shaping step in order
  for (const step of steps) {
    const { sts, rows: interval, times } = step;
    
    // Format the action text (e.g., "Decrease 1 stitch" or "Increase 2 stitches")
    const actionVerb = direction === 'decrease' ? 'Decrease' : 'Increase';
    const stitchWord = sts === 1 ? 'stitch' : 'stitches';
    const actionText = `${actionVerb} ${sts} ${stitchWord}`;

    // Repeat this step the specified number of times
    for (let i = 0; i < times; i++) {
      // Advance to the next shaping row
      // The interval represents how many rows between each shaping action
      currentRow += interval;

      // Update the stitch count based on direction and mode
      // - For decreases: subtract stitches
      // - For increases: add stitches
      // The multiplier accounts for whether we're shaping one or both sides
      if (direction === 'decrease') {
        currentStitches -= sts * stitchMultiplier;
      } else {
        currentStitches += sts * stitchMultiplier;
      }

      // Record this shaping action
      // stitchesAfter reflects the TOTAL needles in work AFTER this shaping action completes
      // This is the count a knitter would have if they stopped and counted their stitches
      entries.push({
        rowNumber: currentRow,
        action: actionText,
        location: locationText,
        stitchesAfter: currentStitches,
      });
    }
  }

  return entries;
}

/**
 * Convenience function for generating a decrease breakdown
 */
export function generateDecreaseBreakdown(
  startingStitches: number,
  steps: ShapingStep[],
  shapingMode: 'both' | 'one'
): RowEntry[] {
  return generateRowByRow({
    startingStitches,
    steps,
    shapingMode,
    direction: 'decrease'
  });
}

/**
 * Convenience function for generating an increase breakdown
 */
export function generateIncreaseBreakdown(
  startingStitches: number,
  steps: ShapingStep[],
  shapingMode: 'both' | 'one'
): RowEntry[] {
  return generateRowByRow({
    startingStitches,
    steps,
    shapingMode,
    direction: 'increase'
  });
}
