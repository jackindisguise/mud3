import { test, suite } from "node:test";
import assert from "node:assert";
import { capitalizeFirst } from "./string.js";
import { COLOR_ESCAPE } from "../core/color.js";

suite("utils/string.ts", () => {
	suite("capitalizeFirst()", () => {
		test("should capitalize first letter of plain text", () => {
			assert.strictEqual(capitalizeFirst("a sword"), "A sword");
			assert.strictEqual(capitalizeFirst("the bag"), "The bag");
			assert.strictEqual(capitalizeFirst("goblin"), "Goblin");
		});

		test("should preserve already capitalized first letter", () => {
			assert.strictEqual(capitalizeFirst("A sword"), "A sword");
			assert.strictEqual(capitalizeFirst("The bag"), "The bag");
			assert.strictEqual(capitalizeFirst("Goblin"), "Goblin");
		});

		test("should handle empty string", () => {
			assert.strictEqual(capitalizeFirst(""), "");
		});

		test("should capitalize first letter after color codes", () => {
			assert.strictEqual(capitalizeFirst("{ra red sword{x"), "{rA red sword{x");
			assert.strictEqual(capitalizeFirst("{ga green bag{x"), "{gA green bag{x");
			assert.strictEqual(
				capitalizeFirst("{ba blue potion{x"),
				"{bA blue potion{x"
			);
		});

		test("should handle uppercase color codes", () => {
			assert.strictEqual(capitalizeFirst("{Ra red sword{x"), "{RA red sword{x");
			assert.strictEqual(capitalizeFirst("{Ga green bag{x"), "{GA green bag{x");
			assert.strictEqual(
				capitalizeFirst("{Ba blue potion{x"),
				"{BA blue potion{x"
			);
		});

		test("should handle multiple color codes before first character", () => {
			assert.strictEqual(
				capitalizeFirst("{r{Rbright red{x sword"),
				"{r{RBright red{x sword"
			);
			assert.strictEqual(
				capitalizeFirst("{g{G{Yyellow-green{x item"),
				"{g{G{YYellow-green{x item"
			);
		});

		test("should preserve escaped braces ({{) and capitalize first letter after", () => {
			assert.strictEqual(capitalizeFirst("{{not a code}"), "{{Not a code}");
			assert.strictEqual(capitalizeFirst("{{{{test"), "{{{{Test");
			assert.strictEqual(capitalizeFirst("{{hello world"), "{{Hello world");
		});

		test("should handle escaped braces before actual text", () => {
			assert.strictEqual(
				capitalizeFirst("{{a literal brace"),
				"{{A literal brace"
			);
			assert.strictEqual(capitalizeFirst("{{{{text"), "{{{{Text");
		});

		test("should handle mixed escaped braces and color codes", () => {
			assert.strictEqual(
				capitalizeFirst("{{not code{rcolored{x"),
				"{{Not code{rcolored{x"
			);
			assert.strictEqual(
				capitalizeFirst("{r{{literal{x text"),
				"{r{{Literal{x text"
			);
		});

		test("should return as-is if string only contains color codes", () => {
			assert.strictEqual(capitalizeFirst("{r{x"), "{r{x");
			assert.strictEqual(capitalizeFirst("{R{G{B{x"), "{R{G{B{x");
		});

		test("should capitalize literal text even if preceded by color codes and escaped braces", () => {
			assert.strictEqual(capitalizeFirst("{r{{literal{x"), "{r{{Literal{x");
		});

		test("should handle strings starting with numbers and special characters", () => {
			assert.strictEqual(capitalizeFirst("123 items"), "123 items");
			assert.strictEqual(capitalizeFirst("!warning"), "!warning");
			assert.strictEqual(capitalizeFirst("@mention"), "@mention");
			assert.strictEqual(capitalizeFirst("_private"), "_private");
		});

		test("should handle color codes with numbers (background colors)", () => {
			assert.strictEqual(
				capitalizeFirst("{0black bg{x item"),
				"{0Black bg{x item"
			);
			assert.strictEqual(capitalizeFirst("{1{Rred{x text"), "{1{RRed{x text");
		});

		test("should handle single character strings", () => {
			assert.strictEqual(capitalizeFirst("a"), "A");
			assert.strictEqual(capitalizeFirst("A"), "A");
			assert.strictEqual(capitalizeFirst("1"), "1");
			assert.strictEqual(capitalizeFirst("{ra{x"), "{rA{x");
		});

		test("should handle color code followed immediately by character", () => {
			assert.strictEqual(capitalizeFirst("{rs"), "{rS");
			assert.strictEqual(capitalizeFirst("{Rs"), "{RS");
			assert.strictEqual(capitalizeFirst("{1t"), "{1T");
		});

		test("should handle reset codes", () => {
			assert.strictEqual(capitalizeFirst("{xreset"), "{xReset");
			assert.strictEqual(capitalizeFirst("{Xreset"), "{XReset");
			assert.strictEqual(
				capitalizeFirst("{rcolored{xreset{x"),
				"{rColored{xreset{x"
			);
		});
	});
});
