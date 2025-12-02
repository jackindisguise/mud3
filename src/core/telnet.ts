/**
 * Core telnet module.
 *
 * Telnet color code utilities for MUD text formatting.
 * Provides ANSI escape sequences for foreground and background colors.
 *
 * @module core/telnet
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
	// Standard Telnet Options (RFC 854 and related)
	BINARY = 0, // Binary Transmission
	ECHO = 1, // Echo
	RECONNECTION = 2, // Reconnection
	SGA = 3, // Suppress Go Ahead
	APPROX_MESSAGE_SIZE = 4, // Approximate Message Size Negotiation
	STATUS = 5, // Status
	TIMING_MARK = 6, // Timing Mark
	RCTE = 7, // Remote Controlled Transmit and Echo
	OUTPUT_LINE_WIDTH = 8, // Output Line Width
	OUTPUT_PAGE_SIZE = 9, // Output Page Size
	OUTPUT_CR_DISPOSITION = 10, // Output Carriage-Return Disposition
	OUTPUT_HORIZONTAL_TAB_STOPS = 11, // Output Horizontal Tab Stops
	OUTPUT_HORIZONTAL_TAB_DISPOSITION = 12, // Output Horizontal Tab Disposition
	OUTPUT_FORMFEED_DISPOSITION = 13, // Output Formfeed Disposition
	OUTPUT_VERTICAL_TAB_STOPS = 14, // Output Vertical Tab Stops
	OUTPUT_VERTICAL_TAB_DISPOSITION = 15, // Output Vertical Tab Disposition
	OUTPUT_LINEFEED_DISPOSITION = 16, // Output Linefeed Disposition
	EXTENDED_ASCII = 17, // Extended ASCII
	LOGOUT = 18, // Logout
	BYTE_MACRO = 19, // Byte Macro
	DET = 20, // Data Entry Terminal
	SUPDUP = 21, // SUPDUP
	SUPDUP_OUTPUT = 22, // SUPDUP Output
	SEND_LOCATION = 23, // Send Location
	TTYPE = 24, // Terminal Type
	END_OF_RECORD = 25, // End of Record
	TUID = 26, // TUID
	OUTPUT_MARKING = 27, // Output Marking
	TERMINAL_LOCATION_NUMBER = 28, // Terminal Location Number
	TELNET_3270_REGIME = 29, // Telnet 3270 Regime
	X3_PAD = 30, // X.3 PAD
	NAWS = 31, // Negotiate About Window Size
	TERMINAL_SPEED = 32, // Terminal Speed
	REMOTE_FLOW_CONTROL = 33, // Remote Flow Control
	LINEMODE = 34, // Linemode
	X_DISPLAY_LOCATION = 35, // X Display Location
	ENVIRONMENT = 36, // Environment Variables
	AUTHENTICATION = 37, // Authentication Option
	ENCRYPT = 38, // Encryption Option
	NEW_ENVIRONMENT = 39, // New Environment Option
	TN3270E = 40, // TN3270E
	XAUTH = 41, // XAUTH
	CHARSET = 42, // Charset
	RSP = 43, // Remote Serial Port
	COM_PORT_OPTION = 44, // COM Port Control Option
	SLE = 45, // Suppress Local Echo
	START_TLS = 46, // Start TLS
	KERMIT = 47, // KERMIT
	SEND_URL = 48, // Send URL
	FORWARD_X = 49, // Forward X
	PRAGMA_LOGON = 138, // Pragma Logon
	SSPI_LOGON = 139, // SSPI Logon
	PRAGMA_HEARTBEAT = 140, // Pragma Heartbeat
	EXOPL = 255, // Extended-Options-List

	// Mud Client Compression Protocol (MCCP) - MUD-specific
	MCCP1 = 85, // Mud Client Compression Protocol v1 (deprecated)
	MCCP2 = 86, // Mud Client Compression Protocol v2
	MCCP3 = 87, // Mud Client Compression Protocol v3

	// Other MUD-specific protocols
	MSSP = 70, // Mud Server Status Protocol
	MSP = 90, // Mud Sound Protocol
	MXP = 91, // Mud eXtension Protocol
	GMCP = 201, // Generic Mud Communication Protocol
}

/**
 * Map of telnet option codes to their human-readable names
 */
export const TELNET_OPTION_NAMES: Record<TELNET_OPTION, string> = {
	[TELNET_OPTION.BINARY]: "BINARY",
	[TELNET_OPTION.ECHO]: "ECHO",
	[TELNET_OPTION.RECONNECTION]: "RECONNECTION",
	[TELNET_OPTION.SGA]: "SGA",
	[TELNET_OPTION.APPROX_MESSAGE_SIZE]: "APPROX_MESSAGE_SIZE",
	[TELNET_OPTION.STATUS]: "STATUS",
	[TELNET_OPTION.TIMING_MARK]: "TIMING_MARK",
	[TELNET_OPTION.RCTE]: "RCTE",
	[TELNET_OPTION.OUTPUT_LINE_WIDTH]: "OUTPUT_LINE_WIDTH",
	[TELNET_OPTION.OUTPUT_PAGE_SIZE]: "OUTPUT_PAGE_SIZE",
	[TELNET_OPTION.OUTPUT_CR_DISPOSITION]: "OUTPUT_CR_DISPOSITION",
	[TELNET_OPTION.OUTPUT_HORIZONTAL_TAB_STOPS]: "OUTPUT_HORIZONTAL_TAB_STOPS",
	[TELNET_OPTION.OUTPUT_HORIZONTAL_TAB_DISPOSITION]:
		"OUTPUT_HORIZONTAL_TAB_DISPOSITION",
	[TELNET_OPTION.OUTPUT_FORMFEED_DISPOSITION]: "OUTPUT_FORMFEED_DISPOSITION",
	[TELNET_OPTION.OUTPUT_VERTICAL_TAB_STOPS]: "OUTPUT_VERTICAL_TAB_STOPS",
	[TELNET_OPTION.OUTPUT_VERTICAL_TAB_DISPOSITION]:
		"OUTPUT_VERTICAL_TAB_DISPOSITION",
	[TELNET_OPTION.OUTPUT_LINEFEED_DISPOSITION]: "OUTPUT_LINEFEED_DISPOSITION",
	[TELNET_OPTION.EXTENDED_ASCII]: "EXTENDED_ASCII",
	[TELNET_OPTION.LOGOUT]: "LOGOUT",
	[TELNET_OPTION.BYTE_MACRO]: "BYTE_MACRO",
	[TELNET_OPTION.DET]: "DET",
	[TELNET_OPTION.SUPDUP]: "SUPDUP",
	[TELNET_OPTION.SUPDUP_OUTPUT]: "SUPDUP_OUTPUT",
	[TELNET_OPTION.SEND_LOCATION]: "SEND_LOCATION",
	[TELNET_OPTION.TTYPE]: "TTYPE",
	[TELNET_OPTION.END_OF_RECORD]: "END_OF_RECORD",
	[TELNET_OPTION.TUID]: "TUID",
	[TELNET_OPTION.OUTPUT_MARKING]: "OUTPUT_MARKING",
	[TELNET_OPTION.TERMINAL_LOCATION_NUMBER]: "TERMINAL_LOCATION_NUMBER",
	[TELNET_OPTION.TELNET_3270_REGIME]: "TELNET_3270_REGIME",
	[TELNET_OPTION.X3_PAD]: "X3_PAD",
	[TELNET_OPTION.NAWS]: "NAWS",
	[TELNET_OPTION.TERMINAL_SPEED]: "TERMINAL_SPEED",
	[TELNET_OPTION.REMOTE_FLOW_CONTROL]: "REMOTE_FLOW_CONTROL",
	[TELNET_OPTION.LINEMODE]: "LINEMODE",
	[TELNET_OPTION.X_DISPLAY_LOCATION]: "X_DISPLAY_LOCATION",
	[TELNET_OPTION.ENVIRONMENT]: "ENVIRONMENT",
	[TELNET_OPTION.AUTHENTICATION]: "AUTHENTICATION",
	[TELNET_OPTION.ENCRYPT]: "ENCRYPT",
	[TELNET_OPTION.NEW_ENVIRONMENT]: "NEW_ENVIRONMENT",
	[TELNET_OPTION.TN3270E]: "TN3270E",
	[TELNET_OPTION.XAUTH]: "XAUTH",
	[TELNET_OPTION.CHARSET]: "CHARSET",
	[TELNET_OPTION.RSP]: "RSP",
	[TELNET_OPTION.COM_PORT_OPTION]: "COM_PORT_OPTION",
	[TELNET_OPTION.SLE]: "SLE",
	[TELNET_OPTION.START_TLS]: "START_TLS",
	[TELNET_OPTION.KERMIT]: "KERMIT",
	[TELNET_OPTION.SEND_URL]: "SEND_URL",
	[TELNET_OPTION.FORWARD_X]: "FORWARD_X",
	[TELNET_OPTION.PRAGMA_LOGON]: "PRAGMA_LOGON",
	[TELNET_OPTION.SSPI_LOGON]: "SSPI_LOGON",
	[TELNET_OPTION.PRAGMA_HEARTBEAT]: "PRAGMA_HEARTBEAT",
	[TELNET_OPTION.EXOPL]: "EXOPL",
	[TELNET_OPTION.MSSP]: "MSSP",
	[TELNET_OPTION.MCCP1]: "MCCP1",
	[TELNET_OPTION.MCCP2]: "MCCP2",
	[TELNET_OPTION.MCCP3]: "MCCP3",
	[TELNET_OPTION.MSP]: "MSP",
	[TELNET_OPTION.MXP]: "MXP",
	[TELNET_OPTION.GMCP]: "GMCP",
};

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

/**
 * Get the human-readable name for a telnet option code
 * @param option The telnet option code
 * @returns The protocol name, or "UNKNOWN" if not found
 */
export function getProtocolName(option: number): string {
	return TELNET_OPTION_NAMES[option as TELNET_OPTION] ?? `UNKNOWN(${option})`;
}

export function buildIACCommand(iac: IAC, option: number): Buffer {
	return Buffer.from([IAC.IAC, iac, option]);
}
