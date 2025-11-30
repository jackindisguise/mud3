import { test, suite } from "node:test";
import assert from "node:assert";
import {
	greaterThan,
	greaterThanOrEqual,
	lessThan,
	lessThanOrEqual,
	lowerThan,
	lowerThanOrEqual,
} from "./assert.js";

suite("utils/assert.ts", () => {
	suite("greaterThan", () => {
		test("should pass when actual is greater than expected", () => {
			greaterThan(10, 5);
			greaterThan(100, 1);
			greaterThan(-1, -10);
		});

		test("should throw when actual is not greater than expected", () => {
			assert.throws(
				() => greaterThan(5, 10),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "5 is not greater than 10");
					assert.strictEqual(error.actual, 5);
					assert.strictEqual(error.expected, "> 10");
					return true;
				}
			);
		});

		test("should throw when actual equals expected", () => {
			assert.throws(
				() => greaterThan(10, 10),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "10 is not greater than 10");
					return true;
				}
			);
		});

		test("should use custom message when provided", () => {
			assert.throws(
				() => greaterThan(5, 10, "Custom error message"),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "Custom error message");
					return true;
				}
			);
		});
	});

	suite("greaterThanOrEqual", () => {
		test("should pass when actual is greater than expected", () => {
			greaterThanOrEqual(10, 5);
			greaterThanOrEqual(100, 1);
		});

		test("should pass when actual equals expected", () => {
			greaterThanOrEqual(10, 10);
			greaterThanOrEqual(0, 0);
			greaterThanOrEqual(-5, -5);
		});

		test("should throw when actual is less than expected", () => {
			assert.throws(
				() => greaterThanOrEqual(5, 10),
				(error: assert.AssertionError) => {
					assert.strictEqual(
						error.message,
						"5 is not greater than or equal to 10"
					);
					assert.strictEqual(error.actual, 5);
					assert.strictEqual(error.expected, ">= 10");
					return true;
				}
			);
		});

		test("should use custom message when provided", () => {
			assert.throws(
				() => greaterThanOrEqual(5, 10, "Custom error message"),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "Custom error message");
					return true;
				}
			);
		});
	});

	suite("lessThan", () => {
		test("should pass when actual is less than expected", () => {
			lessThan(5, 10);
			lessThan(1, 100);
			lessThan(-10, -1);
		});

		test("should throw when actual is not less than expected", () => {
			assert.throws(
				() => lessThan(10, 5),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "10 is not less than 5");
					assert.strictEqual(error.actual, 10);
					assert.strictEqual(error.expected, "< 5");
					return true;
				}
			);
		});

		test("should throw when actual equals expected", () => {
			assert.throws(
				() => lessThan(10, 10),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "10 is not less than 10");
					return true;
				}
			);
		});

		test("should use custom message when provided", () => {
			assert.throws(
				() => lessThan(10, 5, "Custom error message"),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "Custom error message");
					return true;
				}
			);
		});
	});

	suite("lessThanOrEqual", () => {
		test("should pass when actual is less than expected", () => {
			lessThanOrEqual(5, 10);
			lessThanOrEqual(1, 100);
		});

		test("should pass when actual equals expected", () => {
			lessThanOrEqual(10, 10);
			lessThanOrEqual(0, 0);
			lessThanOrEqual(-5, -5);
		});

		test("should throw when actual is greater than expected", () => {
			assert.throws(
				() => lessThanOrEqual(10, 5),
				(error: assert.AssertionError) => {
					assert.strictEqual(
						error.message,
						"10 is not less than or equal to 5"
					);
					assert.strictEqual(error.actual, 10);
					assert.strictEqual(error.expected, "<= 5");
					return true;
				}
			);
		});

		test("should use custom message when provided", () => {
			assert.throws(
				() => lessThanOrEqual(10, 5, "Custom error message"),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "Custom error message");
					return true;
				}
			);
		});
	});

	suite("lowerThan (alias for lessThan)", () => {
		test("should pass when actual is lower than expected", () => {
			lowerThan(5, 10);
			lowerThan(1, 100);
		});

		test("should throw with 'lower than' message", () => {
			assert.throws(
				() => lowerThan(10, 5),
				(error: assert.AssertionError) => {
					assert.strictEqual(error.message, "10 is not lower than 5");
					return true;
				}
			);
		});
	});

	suite("lowerThanOrEqual (alias for lessThanOrEqual)", () => {
		test("should pass when actual is lower than or equal to expected", () => {
			lowerThanOrEqual(5, 10);
			lowerThanOrEqual(10, 10);
		});

		test("should throw with 'lower than or equal' message", () => {
			assert.throws(
				() => lowerThanOrEqual(10, 5),
				(error: assert.AssertionError) => {
					assert.strictEqual(
						error.message,
						"10 is not lower than or equal to 5"
					);
					return true;
				}
			);
		});
	});
});
