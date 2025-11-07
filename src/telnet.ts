/**
 * Telnet color code utilities for MUD text formatting.
 * Provides ANSI escape sequences for foreground and background colors.
 */

/** ANSI escape sequence prefix */
const ESC = "\x1B[";

/**
 * Telnet foreground color codes
 */
export const FG = {
	/** Reset to default color */
	RESET: `${ESC}0m`,

	// Standard colors
	BLACK: `${ESC}0;30m`,
	RED: `${ESC}0;31m`,
	GREEN: `${ESC}0;32m`,
	YELLOW: `${ESC}0;33m`,
	BLUE: `${ESC}0;34m`,
	MAGENTA: `${ESC}0;35m`,
	CYAN: `${ESC}0;36m`,
	WHITE: `${ESC}0;37m`,

	// Bright colors
	BRIGHT_BLACK: `${ESC}1;30m`,
	BRIGHT_RED: `${ESC}1;31m`,
	BRIGHT_GREEN: `${ESC}1;32m`,
	BRIGHT_YELLOW: `${ESC}1;33m`,
	BRIGHT_BLUE: `${ESC}1;34m`,
	BRIGHT_MAGENTA: `${ESC}1;35m`,
	BRIGHT_CYAN: `${ESC}1;36m`,
	BRIGHT_WHITE: `${ESC}1;37m`,
} as const;

/**
 * Telnet background color codes
 */
export const BG = {
	/** Reset to default background */
	RESET: `${ESC}49m`,

	// Standard colors
	BLACK: `${ESC}40m`,
	RED: `${ESC}41m`,
	GREEN: `${ESC}42m`,
	YELLOW: `${ESC}43m`,
	BLUE: `${ESC}44m`,
	MAGENTA: `${ESC}45m`,
	CYAN: `${ESC}46m`,
	WHITE: `${ESC}47m`,

	// Bright colors
	BRIGHT_BLACK: `${ESC}100m`,
	BRIGHT_RED: `${ESC}101m`,
	BRIGHT_GREEN: `${ESC}102m`,
	BRIGHT_YELLOW: `${ESC}103m`,
	BRIGHT_BLUE: `${ESC}104m`,
	BRIGHT_MAGENTA: `${ESC}105m`,
	BRIGHT_CYAN: `${ESC}106m`,
	BRIGHT_WHITE: `${ESC}107m`,
} as const;

/**
 * Text styling codes
 */
export const STYLE = {
	RESET: `${ESC}0m`,
	BOLD: `${ESC}1m`,
	DIM: `${ESC}2m`,
	ITALIC: `${ESC}3m`,
	UNDERLINE: `${ESC}4m`,
	BLINK: `${ESC}5m`,
	REVERSE: `${ESC}7m`,
	HIDDEN: `${ESC}8m`,
	STRIKETHROUGH: `${ESC}9m`,
} as const;

/**
 * Helper function to wrap text with foreground color
 */
export function colorize(
	text: string,
	fgColor: string,
	bgColor?: string
): string {
	const bg = bgColor || "";
	return `${fgColor}${bg}${text}${FG.RESET}${bgColor ? BG.RESET : ""}`;
}

/**
 * Helper function to create a 256-color foreground code
 */
export function fg256(code: number): string {
	if (code < 0 || code > 255) {
		throw new Error("Color code must be between 0 and 255");
	}
	return `${ESC}38;5;${code}m`;
}

/**
 * Helper function to create a 256-color background code
 */
export function bg256(code: number): string {
	if (code < 0 || code > 255) {
		throw new Error("Color code must be between 0 and 255");
	}
	return `${ESC}48;5;${code}m`;
}

/**
 * Helper function to create an RGB foreground code
 */
export function fgRGB(r: number, g: number, b: number): string {
	if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
		throw new Error("RGB values must be between 0 and 255");
	}
	return `${ESC}38;2;${r};${g};${b}m`;
}

/**
 * Helper function to create an RGB background code
 */
export function bgRGB(r: number, g: number, b: number): string {
	if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
		throw new Error("RGB values must be between 0 and 255");
	}
	return `${ESC}48;2;${r};${g};${b}m`;
}

/**
 * Strip all ANSI color codes from text
 */
export function stripColors(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\x1B\[[0-9;]*m/g, "");
}
