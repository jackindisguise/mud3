/**
 * Telnet color code utilities for MUD text formatting.
 * Provides ANSI escape sequences for foreground and background colors.
 */

import { isAscii } from "buffer";

/** ANSI escape sequence prefix */
const ESC = "\x1B[";

/** Telnet line break (CR+LF) */
export const LINEBREAK = "\r\n";

/**
 * Telnet foreground color codes
 */
export const FG = {
	// Standard colors
	BLACK: `${ESC}0;30m`,
	MAROON: `${ESC}0;31m`,
	DARK_GREEN: `${ESC}0;32m`,
	OLIVE: `${ESC}0;33m`,
	DARK_BLUE: `${ESC}0;34m`,
	PURPLE: `${ESC}0;35m`,
	TEAL: `${ESC}0;36m`,
	SILVER: `${ESC}0;37m`,

	// Bright colors
	GREY: `${ESC}1;30m`,
	CRIMSON: `${ESC}1;31m`,
	LIME: `${ESC}1;32m`,
	YELLOW: `${ESC}1;33m`,
	LIGHT_BLUE: `${ESC}1;34m`,
	PINK: `${ESC}1;35m`,
	CYAN: `${ESC}1;36m`,
	WHITE: `${ESC}1;37m`,
} as const;

/**
 * Telnet background color codes
 */
export const BG = {
	/** Reset to default background */
	RESET: `${ESC}49m`,

	// Standard colors
	BLACK: `${ESC}40m`,
	MAROON: `${ESC}41m`,
	DARK_GREEN: `${ESC}42m`,
	OLIVE: `${ESC}43m`,
	DARK_BLUE: `${ESC}44m`,
	PURPLE: `${ESC}45m`,
	TEAL: `${ESC}46m`,
	SILVER: `${ESC}47m`,
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

export enum IAC {
	IAC = 255,
	WILL = 251,
	WONT = 252,
	DO = 253,
	DONT = 254,
	GA = 249,
	SB = 250, // Subnegotiation Begin
	SE = 240, // Subnegotiation End
	SEND = 1, // SEND command (used in subnegotiations like TTYPE)
}

export enum TELNET_OPTION {
	NAWS = 31,
	TTYPE = 24,
	MCCP1 = 85, // Mud Client Compression Protocol v1 (deprecated)
	MCCP2 = 86, // Mud Client Compression Protocol v2
	MCCP3 = 87, // Mud Client Compression Protocol v3
	SGA = 3,
}

export function buildIACCommand(iac: IAC, option: number): Buffer {
	return Buffer.from([IAC.IAC, iac, option]);
}
