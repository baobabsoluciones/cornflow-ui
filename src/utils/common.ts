/**
 * Common utility functions
 */

/**
 * Parse boolean values from various formats (environment variables, JSON, etc.)
 * @param value - The value to parse as boolean
 * @returns boolean | null - The parsed boolean value or null if invalid
 */
export function parseBoolean(value: any): boolean | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  // Handle string values
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'true' || lowerValue === '1') return true;
    if (lowerValue === 'false' || lowerValue === '0') return false;
    return null;
  }
  
  // Handle number values
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  
  // Handle boolean values
  if (typeof value === 'boolean') {
    return value;
  }

  return null;
}

/**
 * Parse a list of names given as an array (JSON) or as a comma-separated string (environment
 * variables). Blank entries and repeats are dropped; order is kept.
 * @param value - The list to parse
 * @returns string[] - The names, or an empty list if there are none
 */
export function parseNameList(value: unknown): string[] {
  let items: unknown[] = []
  if (Array.isArray(value)) items = value
  else if (typeof value === 'string') items = value.split(',')
  const names = items
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item !== '')
  return [...new Set(names)]
}
