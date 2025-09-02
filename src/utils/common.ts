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
