/**
 * Wizard Foundation Utilities (Client-Side)
 * Shared JavaScript utilities for all pattern wizards
 * Loaded as a public script to ensure browser compatibility
 */

// ========== UNIT CONVERSION UTILITIES ==========

const INCH_TO_CM = 2.54;

window.WizardUtils = {
  // Unit conversion
  convertLength: function(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'inches' && toUnit === 'cm') return value * INCH_TO_CM;
    if (fromUnit === 'cm' && toUnit === 'inches') return value / INCH_TO_CM;
    return value;
  },
  
  formatLength: function(value, unit) {
    return unit === 'inches' ? value.toFixed(1) : Math.round(value).toString();
  },
  
  formatLengthWithUnit: function(value, unit) {
    const formatted = unit === 'inches' ? value.toFixed(1) : Math.round(value).toString();
    const symbol = unit === 'inches' ? '"' : 'cm';
    return `${formatted}${symbol}`;
  },
  
  // Convert gauge (per 4" or per 10cm) to per-inch (always returns per-inch for calculations)
  // Note: 4" and 10cm are treated as equivalent for knitting gauge purposes
  gaugeToPerUnit: function(gauge, inputUnit) {
    // Both 4" and 10cm are treated as equivalent standard gauge measurements
    // Divide by 4 in both cases to get per-inch value
    return gauge / 4;
  },
  
  getPlaceholders: function(unit) {
    const gaugeRef = unit === 'inches' ? '4"' : '10cm';
    return {
      stitchGauge: `Stitches per ${gaugeRef}`,
      rowGauge: `Rows per ${gaugeRef}`,
      circumference: `Enter circumference (${unit === 'inches' ? 'inches' : 'cm'})`,
      width: `Width (${unit === 'inches' ? 'inches' : 'cm'})`,
      height: `Height (${unit === 'inches' ? 'inches' : 'cm'})`,
      length: `Length (${unit === 'inches' ? 'inches' : 'cm'})`
    };
  },
  
  createUnitStore: function(storageKey, defaultUnit = 'inches') {
    let currentUnit = defaultUnit;
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'inches' || stored === 'cm') {
        currentUnit = stored;
      }
    }
    return {
      get: () => currentUnit,
      set: (unit) => {
        currentUnit = unit;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(storageKey, unit);
        }
      }
    };
  },
  
  // ========== WIZARD BEHAVIOR UTILITIES ==========
  
  showResults: function(config) {
    const results = document.querySelector(config.resultsSelector);
    if (results) results.style.display = 'block';
    
    if (config.actionBarSelector) {
      const actionBar = document.querySelector(config.actionBarSelector);
      if (actionBar) actionBar.style.display = 'flex';
    }
    
    if (config.printButtonSelector) {
      const printBtn = document.querySelector(config.printButtonSelector);
      if (printBtn) printBtn.style.display = 'block';
    }
    
    if (config.printFooterSelector) {
      const printFooter = document.querySelector(config.printFooterSelector);
      if (printFooter) printFooter.style.display = 'block';
    }
  },
  
  hideResults: function(config) {
    const results = document.querySelector(config.resultsSelector);
    if (results) results.style.display = 'none';
    
    if (config.actionBarSelector) {
      const actionBar = document.querySelector(config.actionBarSelector);
      if (actionBar) actionBar.style.display = 'none';
    }
  },
  
  setupAutoCalculate: function(inputs, calculateFn) {
    inputs.forEach(input => {
      if (input) {
        input.addEventListener('change', calculateFn);
        input.addEventListener('input', calculateFn);
      }
    });
  },
  
  updateHTML: function(selector, html) {
    const element = document.querySelector(selector);
    if (element) element.innerHTML = html;
  },
  
  updateText: function(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  },
  
  toggleElement: function(selector, show) {
    const element = document.querySelector(selector);
    if (element) {
      element.style.display = show ? 'block' : 'none';
    }
  },
  
  getNumericInput: function(selector, fallback = 0) {
    const element = document.querySelector(selector);
    if (!element) return fallback;
    
    const value = parseFloat(element.value);
    return isNaN(value) ? fallback : value;
  },
  
  getSelectValue: function(selector, fallback = '') {
    const element = document.querySelector(selector);
    return element ? element.value : fallback;
  }
};

// Shorthand for convenience
window.WU = window.WizardUtils;
