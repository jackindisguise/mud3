/**
 * Config command for managing character settings.
 *
 * Allows players to view and modify their character settings such as color,
 * autolook, verbose mode, brief mode, prompt, and more.
 *
 * @example
 * ```
 * config                    // List all current settings
 * config color cyan         // Set default terminal color to cyan
 * config color off          // Clear default terminal color
 * config autolook on        // Enable auto-look after movement
 * config autolook off       // Disable auto-look after movement
 * config verbose on         // Enable verbose mode
 * config brief on           // Enable brief mode
 * config prompt "> "        // Set custom prompt
 * ```
 *
 * **Pattern:** `config~ <setting:word?> <value:text?>`
 * @module commands/config
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP, EchoMode } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { COLOR, COLOR_NAMES, COLORS, color, nameToColor } from "../color.js";
import { LINEBREAK } from "../telnet.js";

/**
 * Helper function to find a COLOR enum value by name (case-insensitive)
 * Supports exact matches and partial matches for better user experience
 */
function findColorByName(name: string): COLOR | null {
	const normalized = name.toLowerCase().trim();

	// Try exact match first using the built-in function
	const exactMatch = nameToColor(normalized);
	if (exactMatch !== undefined) {
		return exactMatch;
	}

	// Try partial match for user convenience
	for (const [colorEnum, colorName] of Object.entries(COLOR_NAMES)) {
		if (colorName.toLowerCase().startsWith(normalized)) {
			return parseInt(colorEnum) as COLOR;
		}
	}

	return null;
}

/**
 * Format a boolean value for display
 */
function formatBoolean(
	value: boolean | undefined,
	defaultValue: boolean
): string {
	if (value === undefined) {
		return color(`(default: ${defaultValue ? "on" : "off"})`, COLOR.GREY);
	}
	return value ? color("on", COLOR.LIME) : color("off", COLOR.CRIMSON);
}

/**
 * Format a color value for display
 */
function formatColor(value: COLOR | undefined): string {
	if (value === undefined) {
		return color("(not set)", COLOR.GREY);
	}
	return color(COLOR_NAMES[value], COLOR.CYAN);
}

const VALID_ECHO_MODES: EchoMode[] = ["client", "server", "off"];

function formatEchoMode(value: EchoMode | undefined): string {
	const mode = value ?? "client";
	const label =
		mode === "client"
			? "client (local echo)"
			: mode === "server"
			? "server (manual echo)"
			: "off";
	return color(label, COLOR.CYAN);
}

export default {
	pattern: "config~ <setting:word?> <value:text?>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const setting = args.get("setting") as string | undefined;
		const value = args.get("value") as string | undefined;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can modify settings.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// If no setting provided, show all current settings
		if (!setting) {
			const lines: string[] = [];
			lines.push(color("Current Settings:", COLOR.YELLOW));
			lines.push("");

			// Color setting
			lines.push(
				`  ${color("Color", COLOR.TEAL).padEnd(20)} ${formatColor(
					character.settings.defaultColor
				)}`
			);
			lines.push(
				`    ${color(
					"Usage:",
					COLOR.GREY
				)} config color <color> | config color off`
			);
			lines.push(
				`    ${color("Available colors:", COLOR.GREY)} ${COLORS.join(", ")}`
			);
			lines.push("");

			// Auto-look setting
			lines.push(
				`  ${color("Auto-look", COLOR.TEAL).padEnd(20)} ${formatBoolean(
					character.settings.autoLook,
					true
				)}`
			);
			lines.push(
				`    ${color(
					"Usage:",
					COLOR.GREY
				)} config autolook on | config autolook off`
			);
			lines.push("");

			// Verbose mode setting
			lines.push(
				`  ${color("Verbose", COLOR.TEAL).padEnd(20)} ${formatBoolean(
					character.settings.verboseMode,
					true
				)}`
			);
			lines.push(
				`    ${color(
					"Usage:",
					COLOR.GREY
				)} config verbose on | config verbose off`
			);
			lines.push("");

			// Brief mode setting
			lines.push(
				`  ${color("Brief", COLOR.TEAL).padEnd(20)} ${formatBoolean(
					character.settings.briefMode,
					false
				)}`
			);
			lines.push(
				`    ${color("Usage:", COLOR.GREY)} config brief on | config brief off`
			);
			lines.push("");

			// Color enabled setting
			lines.push(
				`  ${color("Color Enabled", COLOR.TEAL).padEnd(20)} ${formatBoolean(
					character.settings.colorEnabled,
					true
				)}`
			);
			lines.push(
				`    ${color(
					"Usage:",
					COLOR.GREY
				)} config colorEnabled on | config colorEnabled off`
			);
			lines.push("");

			// Echo mode setting
			lines.push(
				`  ${color("Echo Mode", COLOR.TEAL).padEnd(20)} ${formatEchoMode(
					character.settings.echoMode
				)}`
			);
			lines.push(
				`    ${color("Usage:", COLOR.GREY)} config echomode <client|server|off>`
			);
			lines.push(
				`    ${color(
					"Notes:",
					COLOR.GREY
				)} client = your telnet client echoes, server = game echoes, off = no echo`
			);
			lines.push("");

			// Prompt setting
			const currentPrompt = character.settings.prompt ?? "> ";
			lines.push(
				`  ${color("Prompt", COLOR.TEAL).padEnd(20)} ${color(
					`"${currentPrompt.replace(/\{/g, "{{")}"`,
					COLOR.CYAN
				)}`
			);
			lines.push(`    ${color("Usage:", COLOR.GREY)} config prompt "<text>"`);
			lines.push(
				`    ${color(
					"Placeholders:",
					COLOR.GREY
				)} %hh (health), %mm (mana), %ee (exhaustion), %HH (max health), %MM (max mana), %xp (XP), %XX (XP to level)`
			);
			lines.push("");

			lines.push(
				color(
					"Type 'config <setting> <value>' to change a setting.",
					COLOR.GREY
				)
			);

			actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
			return;
		}

		const normalizedSetting = setting.toLowerCase();

		// Handle color setting
		if (normalizedSetting === "color") {
			if (!value) {
				const lines: string[] = [];
				lines.push(
					`Current default color: ${formatColor(
						character.settings.defaultColor
					)}`
				);
				lines.push(`Usage: config color <color> | config color off`);
				lines.push(`Available colors: ${COLORS.join(", ")}`);
				actor.sendMessage(
					lines.join(LINEBREAK),
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			const normalizedValue = value.toLowerCase().trim();
			if (
				normalizedValue === "off" ||
				normalizedValue === "none" ||
				normalizedValue === "clear"
			) {
				character.updateSettings({ defaultColor: undefined });
				actor.sendMessage(
					"Default terminal color cleared.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			const colorEnum = findColorByName(normalizedValue);
			if (colorEnum === null) {
				actor.sendMessage(
					`Unknown color "${value}". Available colors: ${COLORS.join(", ")}`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			character.updateSettings({ defaultColor: colorEnum });
			actor.sendMessage(
				`Default terminal color set to ${color(
					COLOR_NAMES[colorEnum],
					COLOR.CYAN
				)}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle echo mode setting
		if (normalizedSetting === "echomode" || normalizedSetting === "echo") {
			if (!value) {
				const lines: string[] = [];
				lines.push(
					`Current echo mode: ${formatEchoMode(character.settings.echoMode)}`
				);
				lines.push(`Usage: config echomode <client|server|off>`);
				lines.push(
					`client = your telnet client echoes locally, server = game echoes input back, off = no echo`
				);
				actor.sendMessage(
					lines.join(LINEBREAK),
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			const normalizedValue = value.toLowerCase().trim();
			if (!VALID_ECHO_MODES.includes(normalizedValue as EchoMode)) {
				actor.sendMessage(
					`Invalid echo mode "${value}". Use client, server, or off.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			character.updateSettings({ echoMode: normalizedValue as EchoMode });
			actor.sendMessage(
				`Echo mode set to ${normalizedValue}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle prompt setting (string value, not boolean)
		if (normalizedSetting === "prompt") {
			if (!value) {
				const currentPrompt = character.settings.prompt ?? "> ";
				const lines: string[] = [];
				lines.push(`Current prompt: "${currentPrompt.replace(/\{/g, "{{")}"`);
				lines.push(`Usage: config prompt "<text>"`);
				lines.push(
					`Placeholders: %hh (health), %mm (mana), %ee (exhaustion), %HH (max health), %MM (max mana), %xp (XP), %XX (XP to level)`
				);
				lines.push(`Example: config prompt "[%hh/%HH HP] [%xp XP] > "`);
				actor.sendMessage(
					lines.join(LINEBREAK),
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Remove quotes if present
			let promptValue = value.trim();
			if (
				(promptValue.startsWith('"') && promptValue.endsWith('"')) ||
				(promptValue.startsWith("'") && promptValue.endsWith("'"))
			) {
				promptValue = promptValue.slice(1, -1);
			}

			character.updateSettings({ prompt: promptValue });
			actor.sendMessage(
				`Prompt set to "${promptValue}".`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle boolean settings
		if (!value) {
			actor.sendMessage(
				`Usage: config ${setting} on | config ${setting} off`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const normalizedValue = value.toLowerCase().trim();
		const isOn =
			normalizedValue === "on" ||
			normalizedValue === "true" ||
			normalizedValue === "1" ||
			normalizedValue === "yes";
		const isOff =
			normalizedValue === "off" ||
			normalizedValue === "false" ||
			normalizedValue === "0" ||
			normalizedValue === "no";

		if (!isOn && !isOff) {
			actor.sendMessage(
				`Invalid value "${value}". Use "on" or "off".`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle autolook setting
		if (normalizedSetting === "autolook" || normalizedSetting === "auto-look") {
			character.updateSettings({ autoLook: isOn });
			actor.sendMessage(
				`Auto-look ${isOn ? "enabled" : "disabled"}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle verbose setting
		if (
			normalizedSetting === "verbose" ||
			normalizedSetting === "verbosemode"
		) {
			character.updateSettings({ verboseMode: isOn });
			actor.sendMessage(
				`Verbose mode ${isOn ? "enabled" : "disabled"}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle brief setting
		if (normalizedSetting === "brief" || normalizedSetting === "briefmode") {
			character.updateSettings({ briefMode: isOn });
			actor.sendMessage(
				`Brief mode ${isOn ? "enabled" : "disabled"}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle colorEnabled setting
		if (
			normalizedSetting === "colorenabled" ||
			normalizedSetting === "color-enabled" ||
			normalizedSetting === "colors"
		) {
			character.updateSettings({ colorEnabled: isOn });
			actor.sendMessage(
				`Color display ${isOn ? "enabled" : "disabled"}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Unknown setting
		actor.sendMessage(
			`Unknown setting "${setting}". Available settings: color, autolook, verbose, brief, colorEnabled, prompt, echomode`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		context.actor.sendMessage(
			`Error: ${result.error}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;
