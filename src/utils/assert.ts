/**
 * Extended assertion utilities with comparison operators.
 * Provides detailed error messages similar to assert.equal.
 *
 * @module utils/assert
 */

import assert from "node:assert";

/**
 * Asserts that actual is greater than expected.
 * Throws an AssertionError with a detailed message if the assertion fails.
 *
 * @param actual The actual value to test
 * @param expected The expected value that actual should be greater than
 * @param message Optional custom error message
 * @throws {AssertionError} If actual is not greater than expected
 *
 * @example
 * ```typescript
 * import { greaterThan } from "./utils/assert.js";
 *
 * greaterThan(10, 5); // Passes
 * greaterThan(5, 10); // Throws: "5 is not greater than 10"
 * ```
 */
export function greaterThan(
	actual: number,
	expected: number,
	message?: string
): void {
	if (actual > expected) {
		return;
	}
	const defaultMessage = `${actual} is not greater than ${expected}`;
	throw new assert.AssertionError({
		message: message || defaultMessage,
		actual,
		expected: `> ${expected}`,
		operator: ">",
		stackStartFn: greaterThan,
	});
}

/**
 * Asserts that actual is greater than or equal to expected.
 * Throws an AssertionError with a detailed message if the assertion fails.
 *
 * @param actual The actual value to test
 * @param expected The expected value that actual should be greater than or equal to
 * @param message Optional custom error message
 * @throws {AssertionError} If actual is not greater than or equal to expected
 *
 * @example
 * ```typescript
 * import { greaterThanOrEqual } from "./utils/assert.js";
 *
 * greaterThanOrEqual(10, 10); // Passes
 * greaterThanOrEqual(10, 5); // Passes
 * greaterThanOrEqual(5, 10); // Throws: "5 is not greater than or equal to 10"
 * ```
 */
export function greaterThanOrEqual(
	actual: number,
	expected: number,
	message?: string
): void {
	if (actual >= expected) {
		return;
	}
	const defaultMessage = `${actual} is not greater than or equal to ${expected}`;
	throw new assert.AssertionError({
		message: message || defaultMessage,
		actual,
		expected: `>= ${expected}`,
		operator: ">=",
		stackStartFn: greaterThanOrEqual,
	});
}

/**
 * Asserts that actual is less than expected.
 * Throws an AssertionError with a detailed message if the assertion fails.
 *
 * @param actual The actual value to test
 * @param expected The expected value that actual should be less than
 * @param message Optional custom error message
 * @throws {AssertionError} If actual is not less than expected
 *
 * @example
 * ```typescript
 * import { lessThan } from "./utils/assert.js";
 *
 * lessThan(5, 10); // Passes
 * lessThan(10, 5); // Throws: "10 is not less than 5"
 * ```
 */
export function lessThan(
	actual: number,
	expected: number,
	message?: string
): void {
	if (actual < expected) {
		return;
	}
	const defaultMessage = `${actual} is not less than ${expected}`;
	throw new assert.AssertionError({
		message: message || defaultMessage,
		actual,
		expected: `< ${expected}`,
		operator: "<",
		stackStartFn: lessThan,
	});
}

/**
 * Alias for lessThan. Asserts that actual is lower than expected.
 * Throws an AssertionError with a detailed message if the assertion fails.
 *
 * @param actual The actual value to test
 * @param expected The expected value that actual should be lower than
 * @param message Optional custom error message
 * @throws {AssertionError} If actual is not lower than expected
 *
 * @example
 * ```typescript
 * import { lowerThan } from "./utils/assert.js";
 *
 * lowerThan(5, 10); // Passes
 * lowerThan(10, 5); // Throws: "10 is not lower than 5"
 * ```
 */
export function lowerThan(
	actual: number,
	expected: number,
	message?: string
): void {
	if (actual < expected) {
		return;
	}
	const defaultMessage = `${actual} is not lower than ${expected}`;
	throw new assert.AssertionError({
		message: message || defaultMessage,
		actual,
		expected: `< ${expected}`,
		operator: "<",
		stackStartFn: lowerThan,
	});
}

/**
 * Asserts that actual is less than or equal to expected.
 * Throws an AssertionError with a detailed message if the assertion fails.
 *
 * @param actual The actual value to test
 * @param expected The expected value that actual should be less than or equal to
 * @param message Optional custom error message
 * @throws {AssertionError} If actual is not less than or equal to expected
 *
 * @example
 * ```typescript
 * import { lessThanOrEqual } from "./utils/assert.js";
 *
 * lessThanOrEqual(10, 10); // Passes
 * lessThanOrEqual(5, 10); // Passes
 * lessThanOrEqual(10, 5); // Throws: "10 is not less than or equal to 5"
 * ```
 */
export function lessThanOrEqual(
	actual: number,
	expected: number,
	message?: string
): void {
	if (actual <= expected) {
		return;
	}
	const defaultMessage = `${actual} is not less than or equal to ${expected}`;
	throw new assert.AssertionError({
		message: message || defaultMessage,
		actual,
		expected: `<= ${expected}`,
		operator: "<=",
		stackStartFn: lessThanOrEqual,
	});
}

/**
 * Alias for lessThanOrEqual. Asserts that actual is lower than or equal to expected.
 * Throws an AssertionError with a detailed message if the assertion fails.
 *
 * @param actual The actual value to test
 * @param expected The expected value that actual should be lower than or equal to
 * @param message Optional custom error message
 * @throws {AssertionError} If actual is not lower than or equal to expected
 *
 * @example
 * ```typescript
 * import { lowerThanOrEqual } from "./utils/assert.js";
 *
 * lowerThanOrEqual(10, 10); // Passes
 * lowerThanOrEqual(5, 10); // Passes
 * lowerThanOrEqual(10, 5); // Throws: "10 is not lower than or equal to 5"
 * ```
 */
export function lowerThanOrEqual(
	actual: number,
	expected: number,
	message?: string
): void {
	if (actual <= expected) {
		return;
	}
	const defaultMessage = `${actual} is not lower than or equal to ${expected}`;
	throw new assert.AssertionError({
		message: message || defaultMessage,
		actual,
		expected: `<= ${expected}`,
		operator: "<=",
		stackStartFn: lowerThanOrEqual,
	});
}
