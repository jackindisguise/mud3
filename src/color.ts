/**
 * Color encoding module for MUD text.
 * Uses {letter} syntax for color codes, where {{ escapes to a literal {.
 */

import { FG, BG, STYLE } from "./telnet.js";

/**
 * Available foreground colors for text styling.
 */
export enum COLOR {
	// Dark colors (lowercase)
	BLACK,
	MAROON,
	DARK_GREEN,
	OLIVE,
	DARK_BLUE,
	PURPLE,
	TEAL,
	SILVER,

	// Bright colors (uppercase)
	GREY,
	CRIMSON,
	LIME,
	YELLOW,
	LIGHT_BLUE,
	PINK,
	CYAN,
	WHITE,
}

export const COLOR_NAMES: Record<COLOR, string> = {
	// Dark colors
	[COLOR.BLACK]: "black",
	[COLOR.MAROON]: "maroon",
	[COLOR.DARK_GREEN]: "dark green",
	[COLOR.OLIVE]: "olive",
	[COLOR.DARK_BLUE]: "dark blue",
	[COLOR.PURPLE]: "purple",
	[COLOR.TEAL]: "teal",
	[COLOR.SILVER]: "silver",

	// Bright colors
	[COLOR.GREY]: "grey",
	[COLOR.CRIMSON]: "crimson",
	[COLOR.LIME]: "lime",
	[COLOR.YELLOW]: "yellow",
	[COLOR.LIGHT_BLUE]: "light blue",
	[COLOR.PINK]: "pink",
	[COLOR.CYAN]: "cyan",
	[COLOR.WHITE]: "white",
} as const;

export const COLORS: string[] = [
	COLOR_NAMES[COLOR.BLACK],
	COLOR_NAMES[COLOR.MAROON],
	COLOR_NAMES[COLOR.DARK_GREEN],
	COLOR_NAMES[COLOR.OLIVE],
	COLOR_NAMES[COLOR.DARK_BLUE],
	COLOR_NAMES[COLOR.PURPLE],
	COLOR_NAMES[COLOR.TEAL],
	COLOR_NAMES[COLOR.SILVER],
	COLOR_NAMES[COLOR.GREY],
	COLOR_NAMES[COLOR.CRIMSON],
	COLOR_NAMES[COLOR.LIME],
	COLOR_NAMES[COLOR.YELLOW],
	COLOR_NAMES[COLOR.LIGHT_BLUE],
	COLOR_NAMES[COLOR.PINK],
	COLOR_NAMES[COLOR.CYAN],
	COLOR_NAMES[COLOR.WHITE],
] as const;

/**
 * Available background colors.
 */
export enum BG_COLOR {
	BLACK,
	MAROON,
	DARK_GREEN,
	OLIVE,
	DARK_BLUE,
	PURPLE,
	TEAL,
	SILVER,
}

/**
 * Available text styles.
 */
export enum TEXT_STYLE {
	BOLD,
	ITALIC,
	UNDERLINE,
	BLINK,
	REVERSE,
	STRIKETHROUGH,
	RESET_FG,
	RESET_ALL,
}

/**
 * Color tag letter codes for foreground colors.
 */
export const COLOR_TAG = {
	// Dark colors (lowercase)
	[COLOR.BLACK]: "k",
	[COLOR.MAROON]: "r",
	[COLOR.DARK_GREEN]: "g",
	[COLOR.OLIVE]: "y",
	[COLOR.DARK_BLUE]: "b",
	[COLOR.PURPLE]: "m",
	[COLOR.TEAL]: "c",
	[COLOR.SILVER]: "w",

	// Bright colors (uppercase)
	[COLOR.GREY]: "K",
	[COLOR.CRIMSON]: "R",
	[COLOR.LIME]: "G",
	[COLOR.YELLOW]: "Y",
	[COLOR.LIGHT_BLUE]: "B",
	[COLOR.PINK]: "M",
	[COLOR.CYAN]: "C",
	[COLOR.WHITE]: "W",
} as const;

/**
 * Background color tag codes (numbers).
 */
export const BG_COLOR_TAG = {
	[BG_COLOR.BLACK]: "0",
	[BG_COLOR.MAROON]: "1",
	[BG_COLOR.DARK_GREEN]: "2",
	[BG_COLOR.OLIVE]: "3",
	[BG_COLOR.DARK_BLUE]: "4",
	[BG_COLOR.PURPLE]: "5",
	[BG_COLOR.TEAL]: "6",
	[BG_COLOR.SILVER]: "7",
} as const;

/**
 * Text style tag codes (letters).
 */
export const TEXT_STYLE_TAG = {
	[TEXT_STYLE.BOLD]: "d",
	[TEXT_STYLE.ITALIC]: "i",
	[TEXT_STYLE.UNDERLINE]: "u",
	[TEXT_STYLE.BLINK]: "f",
	[TEXT_STYLE.REVERSE]: "v",
	[TEXT_STYLE.STRIKETHROUGH]: "s",
	[TEXT_STYLE.RESET_FG]: "x",
	[TEXT_STYLE.RESET_ALL]: "X",
} as const;

/**
 * Color code mapping from letters to ANSI codes
 */
const COLOR_MAP: Record<string, string> = {
	// Foreground - lowercase for dark colors
	[COLOR_TAG[COLOR.BLACK]]: FG.BLACK,
	[COLOR_TAG[COLOR.MAROON]]: FG.MAROON,
	[COLOR_TAG[COLOR.DARK_GREEN]]: FG.DARK_GREEN,
	[COLOR_TAG[COLOR.OLIVE]]: FG.OLIVE,
	[COLOR_TAG[COLOR.DARK_BLUE]]: FG.DARK_BLUE,
	[COLOR_TAG[COLOR.PURPLE]]: FG.PURPLE,
	[COLOR_TAG[COLOR.TEAL]]: FG.TEAL,
	[COLOR_TAG[COLOR.SILVER]]: FG.SILVER,

	// Foreground - uppercase for bright colors
	[COLOR_TAG[COLOR.GREY]]: FG.GREY,
	[COLOR_TAG[COLOR.CRIMSON]]: FG.CRIMSON,
	[COLOR_TAG[COLOR.LIME]]: FG.LIME,
	[COLOR_TAG[COLOR.YELLOW]]: FG.YELLOW,
	[COLOR_TAG[COLOR.LIGHT_BLUE]]: FG.LIGHT_BLUE,
	[COLOR_TAG[COLOR.PINK]]: FG.PINK,
	[COLOR_TAG[COLOR.CYAN]]: FG.CYAN,
	[COLOR_TAG[COLOR.WHITE]]: FG.WHITE,

	// Background colors - using numbers
	[BG_COLOR_TAG[BG_COLOR.BLACK]]: BG.BLACK,
	[BG_COLOR_TAG[BG_COLOR.MAROON]]: BG.MAROON,
	[BG_COLOR_TAG[BG_COLOR.DARK_GREEN]]: BG.DARK_GREEN,
	[BG_COLOR_TAG[BG_COLOR.OLIVE]]: BG.OLIVE,
	[BG_COLOR_TAG[BG_COLOR.DARK_BLUE]]: BG.DARK_BLUE,
	[BG_COLOR_TAG[BG_COLOR.PURPLE]]: BG.PURPLE,
	[BG_COLOR_TAG[BG_COLOR.TEAL]]: BG.TEAL,
	[BG_COLOR_TAG[BG_COLOR.SILVER]]: BG.SILVER,

	// Styles
	[TEXT_STYLE_TAG[TEXT_STYLE.BOLD]]: STYLE.BOLD,
	[TEXT_STYLE_TAG[TEXT_STYLE.ITALIC]]: STYLE.ITALIC,
	[TEXT_STYLE_TAG[TEXT_STYLE.UNDERLINE]]: STYLE.UNDERLINE,
	[TEXT_STYLE_TAG[TEXT_STYLE.BLINK]]: STYLE.BLINK,
	[TEXT_STYLE_TAG[TEXT_STYLE.REVERSE]]: STYLE.REVERSE,
	[TEXT_STYLE_TAG[TEXT_STYLE.STRIKETHROUGH]]: STYLE.STRIKETHROUGH,

	// Reset
	[TEXT_STYLE_TAG[TEXT_STYLE.RESET_FG]]: STYLE.RESET,
	[TEXT_STYLE_TAG[TEXT_STYLE.RESET_ALL]]: STYLE.RESET,
} as const;

/**
 * Reverse mapping from lowercase color names to COLOR enum values.
 * Built at module load time for O(1) lookups.
 */
const NAME_TO_COLOR_MAP = new Map<string, COLOR>(
	Object.entries(COLOR_NAMES).map(([key, value]) => [
		value.toLowerCase(),
		Number(key) as COLOR,
	])
);

/**
 * Converts a color name string to its COLOR enum value.
 * @param name The color name (case-insensitive)
 * @returns The COLOR enum value, or undefined if not found
 *
 * @example
 * nameToColor("crimson") // returns COLOR.CRIMSON
 * nameToColor("light blue") // returns COLOR.LIGHT_BLUE
 * nameToColor("CYAN") // returns COLOR.CYAN
 */
export function nameToColor(name: string): COLOR | undefined {
	return NAME_TO_COLOR_MAP.get(name.toLowerCase());
}

/**
 * Converts a COLOR enum value to its color tag string.
 * @param color The COLOR enum value
 * @returns The color tag (e.g., "{R" for CRIMSON)
 *
 * @example
 * colorToTag(COLOR.CRIMSON) // returns "{R"
 * colorToTag(COLOR.CYAN) // returns "{C"
 */
export function colorToTag(color: COLOR): string {
	return `{${COLOR_TAG[color]}`;
}

/**
 * Converts a BG_COLOR enum value to its background color tag string.
 * @param color The BG_COLOR enum value
 * @returns The background color tag (e.g., "{1" for MAROON)
 *
 * @example
 * bgColorToTag(BG_COLOR.MAROON) // returns "{1"
 * bgColorToTag(BG_COLOR.DARK_BLUE) // returns "{4"
 */
export function bgColorToTag(color: BG_COLOR): string {
	return `{${BG_COLOR_TAG[color]}`;
}

/**
 * Converts a TEXT_STYLE enum value to its style tag string.
 * @param style The TEXT_STYLE enum value
 * @returns The style tag (e.g., "{d" for BOLD)
 *
 * @example
 * textStyleToTag(TEXT_STYLE.BOLD) // returns "{d"
 * textStyleToTag(TEXT_STYLE.ITALIC) // returns "{i"
 */
export function textStyleToTag(style: TEXT_STYLE): string {
	return `{${TEXT_STYLE_TAG[style]}`;
}

/**
 * Applies a single color to a string, wrapping it with the appropriate color tag and reset.
 * This is a simple wrapper that adds color codes without modifying existing codes in the text.
 *
 * @param text - The text to color
 * @param color - The COLOR enum value to apply
 * @returns The text wrapped with color tags
 *
 * @example
 * color("Hello world", COLOR.CRIMSON)
 * // Returns "{RHello world{x"
 *
 * @example
 * color("Already {Ggreen{x text", COLOR.CYAN)
 * // Returns "{CAlready {Ggreen{x text{x"
 */
export function color(text: string, color: COLOR): string {
	const colorTag = colorToTag(color);
	const resetTag = textStyleToTag(TEXT_STYLE.RESET_ALL);
	return `${colorTag}${text}${resetTag}`;
}

/**
 * Colors a string with a specific color, replacing all reset tags with that color
 * and adding a final reset at the end. Useful for ensuring colored sections maintain
 * their base color even when internal color codes reset.
 *
 * @param text - The text to color
 * @param color - The COLOR enum value to apply
 * @returns The colored text with reset tags replaced and final reset added
 *
 * @example
 * colorString("Hello {Rworld{x!", COLOR.CYAN)
 * // Returns "{CHello {Rworld{C!{x" (cyan base, red "world", back to cyan, final reset)
 *
 * @example
 * colorString("Plain text", COLOR.LIME)
 * // Returns "{GPlain text{x"
 */
export function stickyColor(text: string, color: COLOR): string {
	const colorTag = colorToTag(color);
	// Replace reset tags ({x or {X) with the base color tag
	const replaced = text.replace(/\{[xX]/g, colorTag);
	// Add color at start and reset at end
	return `${colorTag}${replaced}{x`;
}

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
