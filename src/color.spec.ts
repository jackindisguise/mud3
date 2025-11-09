import { test, suite } from "node:test";
import assert from "node:assert";
import { colorize, stripColors, visibleLength } from "./color.js";
import { FG, BG, STYLE } from "./telnet.js";

suite("color.ts", () => {
	suite("colorize()", () => {
		test("should convert lowercase color codes to dark colors", () => {
			assert.strictEqual(colorize("{r"), FG.MAROON);
			assert.strictEqual(colorize("{g"), FG.DARK_GREEN);
			assert.strictEqual(colorize("{b"), FG.DARK_BLUE);
			assert.strictEqual(colorize("{y"), FG.OLIVE);
			assert.strictEqual(colorize("{c"), FG.TEAL);
			assert.strictEqual(colorize("{m"), FG.PURPLE);
			assert.strictEqual(colorize("{k"), FG.BLACK);
			assert.strictEqual(colorize("{w"), FG.SILVER);
		});

		test("should convert uppercase color codes to bright colors", () => {
			assert.strictEqual(colorize("{R"), FG.CRIMSON);
			assert.strictEqual(colorize("{G"), FG.LIME);
			assert.strictEqual(colorize("{B"), FG.LIGHT_BLUE);
			assert.strictEqual(colorize("{Y"), FG.YELLOW);
			assert.strictEqual(colorize("{C"), FG.CYAN);
			assert.strictEqual(colorize("{M"), FG.PINK);
			assert.strictEqual(colorize("{K"), FG.GREY);
			assert.strictEqual(colorize("{W"), FG.WHITE);
		});

		test("should convert number codes to background colors", () => {
			assert.strictEqual(colorize("{0"), BG.BLACK);
			assert.strictEqual(colorize("{1"), BG.MAROON);
			assert.strictEqual(colorize("{2"), BG.DARK_GREEN);
			assert.strictEqual(colorize("{3"), BG.OLIVE);
			assert.strictEqual(colorize("{4"), BG.DARK_BLUE);
			assert.strictEqual(colorize("{5"), BG.PURPLE);
			assert.strictEqual(colorize("{6"), BG.TEAL);
			assert.strictEqual(colorize("{7"), BG.SILVER);
		});

		test("should convert style codes", () => {
			assert.strictEqual(colorize("{d"), STYLE.BOLD);
			assert.strictEqual(colorize("{i"), STYLE.ITALIC);
			assert.strictEqual(colorize("{u"), STYLE.UNDERLINE);
			assert.strictEqual(colorize("{f"), STYLE.BLINK);
			assert.strictEqual(colorize("{v"), STYLE.REVERSE);
			assert.strictEqual(colorize("{s"), STYLE.STRIKETHROUGH);
		});

		test("should convert reset codes", () => {
			assert.strictEqual(colorize("{x"), STYLE.RESET);
			assert.strictEqual(colorize("{X"), STYLE.RESET);
		});

		test("should escape {{ to literal {", () => {
			assert.strictEqual(colorize("{{"), "{");
			assert.strictEqual(colorize("{{hello"), "{hello");
			assert.strictEqual(colorize("test{{code"), "test{code");
			assert.strictEqual(colorize("{{{{"), "{{");
		});

		test("should handle mixed text and color codes", () => {
			const input = "{rRed{x normal {Gbright green{X";
			const expected = `${FG.MAROON}Red${STYLE.RESET} normal ${FG.LIME}bright green${STYLE.RESET}`;
			assert.strictEqual(colorize(input), expected);
		});

		test("should handle color codes with escaped braces", () => {
			const input = "{rcolored {{not a code{x";
			const expected = `${FG.MAROON}colored {not a code${STYLE.RESET}`;
			assert.strictEqual(colorize(input), expected);
		});

		test("should consume unknown codes", () => {
			assert.strictEqual(colorize("{z"), "");
			assert.strictEqual(colorize("{9"), "");
			assert.strictEqual(colorize("{*"), "");
			assert.strictEqual(colorize("text{?more"), "textmore");
		});

		test("should handle empty string", () => {
			assert.strictEqual(colorize(""), "");
		});

		test("should handle string with no codes", () => {
			assert.strictEqual(colorize("plain text"), "plain text");
		});

		test("should handle trailing { (no character to consume, left as-is)", () => {
			assert.strictEqual(colorize("test{"), "test{");
		});

		test("should handle complex mixed content", () => {
			const input = "{RBright{x {{escaped}} {1{WWhite on maroon{X normal";
			const expected = `${FG.CRIMSON}Bright${STYLE.RESET} {escaped}} ${BG.MAROON}${FG.WHITE}White on maroon${STYLE.RESET} normal`;
			assert.strictEqual(colorize(input), expected);
		});
	});

	suite("stripColors()", () => {
		test("should remove color codes", () => {
			assert.strictEqual(stripColors("{rRed text{x"), "Red text");
			assert.strictEqual(stripColors("{GGreen{X"), "Green");
		});

		test("should remove all types of codes", () => {
			assert.strictEqual(stripColors("{k{r{g{y{b{m{c{w"), "");
			assert.strictEqual(stripColors("{K{R{G{Y{B{M{C{W"), "");
			assert.strictEqual(stripColors("{0{1{2{3{4{5{6{7"), "");
			assert.strictEqual(stripColors("{d{i{u{f{v{s"), "");
			assert.strictEqual(stripColors("{x{X"), "");
		});

		test("should convert {{ to literal {", () => {
			assert.strictEqual(stripColors("{{"), "{");
			assert.strictEqual(stripColors("{{hello"), "{hello");
			assert.strictEqual(stripColors("test{{code"), "test{code");
		});

		test("should handle mixed text and codes", () => {
			const input = "{rRed{x text {Gbright{X and {{escaped}}";
			const expected = "Red text bright and {escaped}}";
			assert.strictEqual(stripColors(input), expected);
		});

		test("should consume unknown codes", () => {
			assert.strictEqual(stripColors("{z"), "");
			assert.strictEqual(stripColors("text{?more"), "textmore");
		});

		test("should handle empty string", () => {
			assert.strictEqual(stripColors(""), "");
		});

		test("should handle string with no codes", () => {
			assert.strictEqual(stripColors("plain text"), "plain text");
		});

		test("should handle trailing { (no character to consume, left as-is)", () => {
			assert.strictEqual(stripColors("test{"), "test{");
		});

		test("should handle complex content", () => {
			const input = "{R{d{uHello{X {{world}} {gtest{x!";
			const expected = "Hello {world}} test!";
			assert.strictEqual(stripColors(input), expected);
		});
	});

	suite("visibleLength()", () => {
		test("should return length without color codes", () => {
			assert.strictEqual(visibleLength("{rRed{x"), 3);
			assert.strictEqual(visibleLength("{GGreen text{X"), 10);
		});

		test("should count escaped braces as single character", () => {
			assert.strictEqual(visibleLength("{{"), 1);
			assert.strictEqual(visibleLength("{{{{"), 2);
			assert.strictEqual(visibleLength("test{{code"), 9);
		});

		test("should handle mixed content", () => {
			const input = "{rHello{x {{world}} {Gtest{X";
			// "Hello {world}} test" = 19 characters
			assert.strictEqual(visibleLength(input), 19);
		});

		test("should return 0 for empty string", () => {
			assert.strictEqual(visibleLength(""), 0);
		});

		test("should return 0 for string with only codes", () => {
			assert.strictEqual(visibleLength("{r{g{b{X"), 0);
		});

		test("should handle plain text", () => {
			assert.strictEqual(visibleLength("plain text"), 10);
		});

		test("should handle unknown codes (consumed)", () => {
			assert.strictEqual(visibleLength("{zunknown"), 7); // {z is consumed, "unknown" remains
		});
	});

	suite("integration tests", () => {
		test("colorize and stripColors should be inverse operations", () => {
			const inputs = [
				"{rRed{x text",
				"{GGreen{X",
				"{{escaped}}",
				"{r{g{b{X",
				"plain text",
			];

			for (const input of inputs) {
				const colored = colorize(input);
				const stripped = stripColors(input);
				// stripColors should give us the plain text version
				assert.strictEqual(
					visibleLength(input),
					stripped.length,
					`visibleLength failed for: ${input}`
				);
			}
		});

		test("should handle real-world MUD messages", () => {
			const message = "{RYou hit the {gorc{R for {Y10{R damage!{X";
			const colored = colorize(message);
			const plain = stripColors(message);

			assert.strictEqual(plain, "You hit the orc for 10 damage!");
			assert.strictEqual(visibleLength(message), plain.length);
			assert.ok(colored.includes(FG.CRIMSON));
			assert.ok(colored.includes(FG.DARK_GREEN));
			assert.ok(colored.includes(FG.YELLOW));
		});

		test("should handle OOC-style messages", () => {
			const message = '{Yplayer{x OOC: "{{test}} message"';
			const plain = stripColors(message);

			assert.strictEqual(plain, 'player OOC: "{test}} message"');
			assert.strictEqual(visibleLength(message), plain.length);
		});
	});
});
