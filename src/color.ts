/**
 * Color encoding module for MUD text.
 * Uses {letter} syntax for color codes, where {{ escapes to a literal {.
 */

import { FG, BG, STYLE } from "./telnet.js";

/**
 * Color code mapping from letters to ANSI codes
 */
const COLOR_MAP: Record<string, string> = {
	// Foreground - lowercase for dark colors
	k: FG.BLACK,
	r: FG.MAROON,
	g: FG.DARK_GREEN,
	y: FG.OLIVE,
	b: FG.DARK_BLUE,
	m: FG.PURPLE,
	c: FG.TEAL,
	w: FG.SILVER,

	// Foreground - uppercase for bright colors
	K: FG.GREY,
	R: FG.CRIMSON,
	G: FG.LIME,
	Y: FG.YELLOW,
	B: FG.LIGHT_BLUE,
	M: FG.PINK,
	C: FG.CYAN,
	W: FG.WHITE,

	// Background colors - using numbers
	"0": BG.BLACK,
	"1": BG.MAROON,
	"2": BG.DARK_GREEN,
	"3": BG.OLIVE,
	"4": BG.DARK_BLUE,
	"5": BG.PURPLE,
	"6": BG.TEAL,
	"7": BG.SILVER,

	// Styles
	d: STYLE.BOLD, // bold (dark/dim would conflict, using bold)
	i: STYLE.ITALIC,
	u: STYLE.UNDERLINE,
	f: STYLE.BLINK, // flash
	v: STYLE.REVERSE, // reverse video
	s: STYLE.STRIKETHROUGH,

	// Reset
	x: STYLE.RESET, // reset foreground
	X: STYLE.RESET, // reset all
};

/**
 * Colorize a string by replacing {letter} codes with ANSI escape sequences.
 * {{ is escaped to a literal {.
 *
 * @param text - The text containing color codes
 * @returns The text with ANSI color codes applied
 *
 * @example
 * colorize("{rRed text{x and {Gbright green{X")
 * // Returns text with red and bright green ANSI codes
 *
 * @example
 * colorize("{{not a color code}}")
 * // Returns "{not a color code}}"
 */
export function colorize(text: string): string {
	return text.replace(/\{(\{|.)/g, (match, code) => {
		// {{ becomes a literal {
		if (code === "{") return "{";

		// {letter} becomes the color code if it exists
		const colorCode = COLOR_MAP[code];
		return colorCode !== undefined ? colorCode : match;
	});
}

/**
 * Remove all color codes from a string, leaving only the plain text.
 * This removes both the {letter} codes and converts {{ to {.
 *
 * @param text - The text containing color codes
 * @returns The plain text without color codes
 *
 * @example
 * stripColors("{rRed text{x and {Gbright green{X")
 * // Returns "Red text and bright green"
 *
 * @example
 * stripColors("{{not a color code}}")
 * // Returns "{not a color code}"
 */
export function stripColors(text: string): string {
	return text.replace(/\{(\{|.)/g, (match, code) => {
		// {{ becomes a literal {
		if (code === "{") return "{";

		// {letter} is removed if it's a valid color code
		return COLOR_MAP[code] !== undefined ? "" : match;
	});
}

/**
 * Get the visible length of a string (excluding color codes).
 * Useful for calculating display width.
 *
 * @param text - The text containing color codes
 * @returns The visible length
 */
export function visibleLength(text: string): number {
	return stripColors(text).length;
}
