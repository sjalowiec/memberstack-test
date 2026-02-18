/**
 * Unit Conversion and Formatting Utilities for Pattern Wizards
 * Provides consistent handling of inches/cm conversion and display formatting
 */

export type Unit = 'inches' | 'cm';

/**
 * Conversion factor: 1 inch = 2.54 cm
 */
const INCH_TO_CM = 2.54;

/**
 * Convert a length value between units
 * @param value - The numeric value to convert
 * @param fromUnit - The source unit
 * @param toUnit - The target unit
 * @returns The converted value
 */
export function convertLength(value: number, fromUnit: Unit, toUnit: Unit): number {
  if (fromUnit === toUnit) return value;
  
  if (fromUnit === 'inches' && toUnit === 'cm') {
    return value * INCH_TO_CM;
  }
  
  if (fromUnit === 'cm' && toUnit === 'inches') {
    return value / INCH_TO_CM;
  }
  
  return value;
}

/**
 * Format a length value with appropriate decimal places based on unit
 * - Inches: 1 decimal place (e.g., "18.5")
 * - Cm: Rounded to whole number (e.g., "47")
 * @param value - The numeric value to format
 * @param unit - The unit of measurement
 * @returns Formatted string
 */
export function formatLength(value: number, unit: Unit): string {
  if (unit === 'inches') {
    return value.toFixed(1);
  } else {
    return Math.round(value).toString();
  }
}

/**
 * Format a length value with unit symbol
 * @param value - The numeric value to format
 * @param unit - The unit of measurement
 * @returns Formatted string with unit (e.g., "18.5\"" or "47cm")
 */
export function formatLengthWithUnit(value: number, unit: Unit): string {
  const formatted = formatLength(value, unit);
  const symbol = unit === 'inches' ? '"' : 'cm';
  return `${formatted}${symbol}`;
}

/**
 * Convert gauge from input reference to per-unit basis
 * Input is typically "per 4 inches" or "per 10cm"
 * Output is normalized to per-inch or per-cm
 * 
 * @param gauge - The gauge value (e.g., stitches or rows)
 * @param inputUnit - The unit system ('inches' expects gauge per 4", 'cm' expects gauge per 10cm)
 * @returns Gauge normalized to per-inch or per-cm
 */
export function gaugeToPerUnit(gauge: number, inputUnit: Unit): number {
  if (inputUnit === 'inches') {
    // Input is per 4", convert to per 1"
    return gauge / 4;
  } else {
    // Input is per 10cm, convert to per 1cm
    return gauge / 10;
  }
}

/**
 * Convert gauge between unit systems
 * @param gauge - The gauge value in the source unit
 * @param fromUnit - Source unit ('inches' = per 4", 'cm' = per 10cm)
 * @param toUnit - Target unit ('inches' = per 4", 'cm' = per 10cm)
 * @returns Converted gauge value
 */
export function convertGauge(gauge: number, fromUnit: Unit, toUnit: Unit): number {
  if (fromUnit === toUnit) return gauge;
  
  // First normalize to per-unit
  const perUnit = gaugeToPerUnit(gauge, fromUnit);
  
  // Convert between per-inch and per-cm
  const convertedPerUnit = convertLength(perUnit, fromUnit, toUnit);
  
  // Scale back to reference size
  if (toUnit === 'inches') {
    return convertedPerUnit * 4; // per 4"
  } else {
    return convertedPerUnit * 10; // per 10cm
  }
}

/**
 * Get gauge reference size label
 * @param unit - The unit system
 * @returns The reference size string (e.g., "4\"" or "10cm")
 */
export function getGaugeReference(unit: Unit): string {
  return unit === 'inches' ? '4"' : '10cm';
}

/**
 * Create a unit preference store with localStorage persistence
 * @param storageKey - The localStorage key (e.g., 'hat-unit', 'blanket-unit')
 * @param defaultUnit - Default unit if none stored (default: 'inches')
 * @returns Object with get/set methods and update callbacks
 */
export function createUnitStore(storageKey: string, defaultUnit: Unit = 'inches') {
  let currentUnit: Unit = defaultUnit;
  const listeners: Array<(unit: Unit) => void> = [];
  
  // Initialize from localStorage if available
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(storageKey) as Unit | null;
    if (stored === 'inches' || stored === 'cm') {
      currentUnit = stored;
    }
  }
  
  return {
    /**
     * Get current unit
     */
    get(): Unit {
      return currentUnit;
    },
    
    /**
     * Set unit and persist to localStorage
     */
    set(unit: Unit): void {
      currentUnit = unit;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, unit);
      }
      // Notify listeners
      listeners.forEach(callback => callback(unit));
    },
    
    /**
     * Subscribe to unit changes
     */
    onChange(callback: (unit: Unit) => void): void {
      listeners.push(callback);
    }
  };
}

/**
 * Update placeholder text based on unit
 * @param unit - Current unit
 * @returns Object with common placeholder strings
 */
export function getPlaceholders(unit: Unit) {
  const gaugeRef = getGaugeReference(unit);
  
  return {
    stitchGauge: `Stitches per ${gaugeRef}`,
    rowGauge: `Rows per ${gaugeRef}`,
    circumference: `Enter circumference (${unit === 'inches' ? 'inches' : 'cm'})`,
    width: `Width (${unit === 'inches' ? 'inches' : 'cm'})`,
    height: `Height (${unit === 'inches' ? 'inches' : 'cm'})`,
    length: `Length (${unit === 'inches' ? 'inches' : 'cm'})`
  };
}
