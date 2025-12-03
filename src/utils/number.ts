/**
 * Number utility functions.
 *
 * Helper functions for formatting and manipulating numbers.
 *
 * @module utils/number
 */

/**
 * Formats a number with comma separators for thousands.
 *
 * @param num - The number to format
 * @returns A string representation of the number with comma separators
 *
 * @example
 * ```typescript
 * formatNumber(1000);      // "1,000"
 * formatNumber(1000000);   // "1,000,000"
 * formatNumber(123);       // "123"
 * formatNumber(1234.56);   // "1,234.56"
 * ```
 */
export function formatNumber(num: number): string {
	return num.toLocaleString("en-US");
}

