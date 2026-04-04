/**
 * Wizard Behavior Utilities
 * Common interactive patterns for pattern wizards
 */

/**
 * Configuration for wizard behavior initialization
 */
export interface WizardConfig {
  /** Selector for the results container */
  resultsSelector: string;
  /** Selector for the action bar */
  actionBarSelector?: string;
  /** Selector for the print button */
  printButtonSelector?: string;
  /** Selector for the start over button */
  startOverSelector?: string;
  /** Selector for the print footer */
  printFooterSelector?: string;
  /** Callback when start over is clicked */
  onStartOver?: () => void;
  /** Callback before printing */
  onBeforePrint?: () => void;
}

/**
 * Show results section and action bar
 */
export function showResults(config: WizardConfig): void {
  const results = document.querySelector(config.resultsSelector) as HTMLElement;
  if (results) {
    results.style.display = 'block';
  }
  
  if (config.actionBarSelector) {
    const actionBar = document.querySelector(config.actionBarSelector) as HTMLElement;
    if (actionBar) {
      actionBar.style.display = 'flex';
    }
  }
  
  if (config.printButtonSelector) {
    const printBtn = document.querySelector(config.printButtonSelector) as HTMLElement;
    if (printBtn) {
      printBtn.style.display = 'block';
    }
  }
  
  if (config.printFooterSelector) {
    const printFooter = document.querySelector(config.printFooterSelector) as HTMLElement;
    if (printFooter) {
      printFooter.style.display = 'block';
    }
  }
}

/**
 * Hide results section and action bar
 */
export function hideResults(config: WizardConfig): void {
  const results = document.querySelector(config.resultsSelector) as HTMLElement;
  if (results) {
    results.style.display = 'none';
  }
  
  if (config.actionBarSelector) {
    const actionBar = document.querySelector(config.actionBarSelector) as HTMLElement;
    if (actionBar) {
      actionBar.style.display = 'none';
    }
  }
}

/**
 * Initialize action bar buttons (Print and Start Over)
 */
export function initializeActionBar(config: WizardConfig): void {
  // Print button
  if (config.printButtonSelector) {
    const printBtn = document.querySelector(config.printButtonSelector);
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        if (config.onBeforePrint) {
          config.onBeforePrint();
        }
        window.print();
      });
    }
  }
  
  // Start Over button
  if (config.startOverSelector) {
    const startOverBtn = document.querySelector(config.startOverSelector);
    if (startOverBtn) {
      startOverBtn.addEventListener('click', () => {
        if (config.onStartOver) {
          config.onStartOver();
        }
        hideResults(config);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }
}

/**
 * Setup auto-calculate on input change
 * @param inputs - Array of input elements or selectors
 * @param calculateFn - Function to call when inputs change
 */
export function setupAutoCalculate(
  inputs: (HTMLElement | string)[],
  calculateFn: () => void
): void {
  inputs.forEach(input => {
    const element = typeof input === 'string' 
      ? document.querySelector(input) as HTMLElement
      : input;
    
    if (element) {
      element.addEventListener('change', calculateFn);
      element.addEventListener('input', calculateFn);
    }
  });
}

/**
 * Validate that required inputs have values
 * @param inputs - Object mapping input selectors to their labels
 * @returns Object with isValid boolean and array of missing field labels
 */
export function validateInputs(inputs: Record<string, string>): {
  isValid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  
  Object.entries(inputs).forEach(([selector, label]) => {
    const element = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
    if (element) {
      const value = element.value.trim();
      if (!value || value === '' || (element.type === 'number' && parseFloat(value) <= 0)) {
        missing.push(label);
      }
    }
  });
  
  return {
    isValid: missing.length === 0,
    missing
  };
}

/**
 * Reset form inputs to their default values
 * @param inputs - Array of input element selectors and their default values
 */
export function resetInputs(inputs: Array<{ selector: string; defaultValue: string | number | boolean }>): void {
  inputs.forEach(({ selector, defaultValue }) => {
    const element = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
    if (element) {
      if (element.type === 'checkbox') {
        (element as HTMLInputElement).checked = defaultValue as boolean;
      } else {
        element.value = String(defaultValue);
      }
    }
  });
}

/**
 * Scroll to an element smoothly
 * @param selector - Element selector
 * @param block - Scroll position ('start', 'center', 'end', 'nearest')
 * @param delay - Delay before scrolling (ms)
 */
export function scrollToElement(
  selector: string, 
  block: ScrollLogicalPosition = 'nearest',
  delay: number = 100
): void {
  setTimeout(() => {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block });
    }
  }, delay);
}

/**
 * Toggle visibility of an element
 * @param selector - Element selector
 * @param show - Whether to show (true) or hide (false)
 */
export function toggleElement(selector: string, show: boolean): void {
  const element = document.querySelector(selector) as HTMLElement;
  if (element) {
    element.style.display = show ? 'block' : 'none';
  }
}

/**
 * Get numeric input value with fallback
 * @param selector - Input selector
 * @param fallback - Default value if input is empty or invalid
 * @returns Parsed number or fallback
 */
export function getNumericInput(selector: string, fallback: number = 0): number {
  const element = document.querySelector(selector) as HTMLInputElement;
  if (!element) return fallback;
  
  const value = parseFloat(element.value);
  return isNaN(value) ? fallback : value;
}

/**
 * Get select input value
 * @param selector - Select selector
 * @param fallback - Default value if select is not found
 * @returns Selected value or fallback
 */
export function getSelectValue(selector: string, fallback: string = ''): string {
  const element = document.querySelector(selector) as HTMLSelectElement;
  return element ? element.value : fallback;
}

/**
 * Update element text content
 * @param selector - Element selector
 * @param content - Text content to set
 */
export function updateText(selector: string, content: string): void {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = content;
  }
}

/**
 * Update element HTML content
 * @param selector - Element selector
 * @param html - HTML content to set
 */
export function updateHTML(selector: string, html: string): void {
  const element = document.querySelector(selector);
  if (element) {
    element.innerHTML = html;
  }
}
