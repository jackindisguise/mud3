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
import {
	COLOR,
	COLOR_NAMES,
	COLORS,
	color,
	nameToColor,
	SIZER,
} from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { string } from "mud-ext";

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

type Actor = CommandContext["actor"];
type PlayerCharacter = NonNullable<Actor["character"]>;
type BooleanSettingHandler = (
	actor: Actor,
	character: PlayerCharacter,
	isOn: boolean
) => void;

type UsageHelper = (prefix?: number) => string[];

const prefixSpaces = (prefix: number = 0): string => " ".repeat(prefix);

const createToggleUsage = (command: string, prefix: number = 0): string[] => {
	const _prefix = prefixSpaces(prefix);
	return [
		`${_prefix}${color(
			"Usage:",
			COLOR.GREY
		)} config ${command} on | config ${command} off`,
	];
};

const getColorUsage: UsageHelper = (prefix = 0) => {
	const _prefix = prefixSpaces(prefix);
	const availableColors = COLORS.map((_color) => {
		let __color = findColorByName(_color) as COLOR;
		if (__color === COLOR.BLACK) __color = COLOR.GREY;
		return color(_color, __color);
	});
	const wrappedColors = string.wrap({
		string: `${color("Available colors", COLOR.GREY)}: ${availableColors.join(
			", "
		)}`,
		width: 50,
		sizer: SIZER,
		prefix: prefixSpaces(prefix + "Available colors: ".length),
	});
	return [
		`${_prefix}${color(
			"Usage:",
			COLOR.GREY
		)} config color <color> | config color off`,
		`${_prefix}${wrappedColors.join(LINEBREAK)}`,
	];
};

const getEchoModeUsage: UsageHelper = (prefix = 0) => {
	const _prefix = prefixSpaces(prefix);
	return [
		`${_prefix}${color(
			"Usage:",
			COLOR.GREY
		)} config echomode <client|server|off>`,
		`${_prefix}${color(
			"Notes:",
			COLOR.GREY
		)} client = your telnet client echoes locally, server = game echoes input back, off = no echo`,
	];
};

const getPromptUsage: UsageHelper = (prefix = 0) => {
	const lines: string[] = [];
	const _prefix = prefixSpaces(prefix);
	lines.push(`${_prefix}${color("Usage:", COLOR.GREY)} config prompt "<text>"`);
	lines.push(`${_prefix}${color("Placeholders:", COLOR.GREY)}`);
	const health = color("%hh (health)", COLOR.CRIMSON);
	const mana = color("%mm (mana)".padEnd(10), COLOR.CYAN);
	const exhaustion = color("%ee (exhaustion)".padEnd(10), COLOR.LIME);
	const maxHealth = color("%HH (max health)".padEnd(10), COLOR.CRIMSON);
	const maxMana = color("%MM (max mana)".padEnd(10), COLOR.CYAN);
	const xp = color("%xp (XP)".padEnd(10), COLOR.YELLOW);
	const xpToLevel = color("%XX (XP to level)".padEnd(10), COLOR.YELLOW);
	lines.push(`${_prefix}  ${health} ${mana} ${exhaustion}`);
	lines.push(`${_prefix}  ${maxHealth} ${maxMana}`);
	lines.push(`${_prefix}  ${xp} ${xpToLevel}`);
	return lines;
};

const getAutolookUsage: UsageHelper = (prefix = 0) =>
	createToggleUsage("autolook", prefix);

const getVerboseUsage: UsageHelper = (prefix = 0) =>
	createToggleUsage("verbose", prefix);

const getBriefUsage: UsageHelper = (prefix = 0) =>
	createToggleUsage("brief", prefix);

const getColorEnabledUsage: UsageHelper = (prefix = 0) =>
	createToggleUsage("colorEnabled", prefix);

function showSettingsOverview(actor: Actor, character: PlayerCharacter): void {
	const lines: string[] = [];
	lines.push(color("Current Settings:", COLOR.YELLOW));
	lines.push("");

	lines.push(
		`  ${color("Default Color", COLOR.TEAL).padEnd(20)} ${formatColor(
			character.settings.defaultColor
		)}`
	);
	lines.push(...getColorUsage(4));
	lines.push("");

	lines.push(
		`  ${color("Auto-look", COLOR.TEAL).padEnd(20)} ${formatBoolean(
			character.settings.autoLook,
			true
		)}`
	);
	lines.push(...getAutolookUsage(4));
	lines.push("");

	lines.push(
		`  ${color("Verbose", COLOR.TEAL).padEnd(20)} ${formatBoolean(
			character.settings.verboseMode,
			true
		)}`
	);
	lines.push(...getVerboseUsage(4));
	lines.push("");

	lines.push(
		`  ${color("Brief", COLOR.TEAL).padEnd(20)} ${formatBoolean(
			character.settings.briefMode,
			false
		)}`
	);
	lines.push(...getBriefUsage(4));
	lines.push("");

	lines.push(
		`  ${color("Color Enabled", COLOR.TEAL).padEnd(20)} ${formatBoolean(
			character.settings.colorEnabled,
			true
		)}`
	);
	lines.push(...getColorEnabledUsage(4));
	lines.push("");

	lines.push(
		`  ${color("Echo Mode", COLOR.TEAL).padEnd(20)} ${formatEchoMode(
			character.settings.echoMode
		)}`
	);
	lines.push(...getEchoModeUsage(4));
	lines.push("");

	const currentPrompt = character.settings.prompt ?? "> ";
	const promptPlaceholders = getPromptUsage(4);
	lines.push(
		`  ${color("Prompt", COLOR.TEAL).padEnd(20)} ${color(
			`"${currentPrompt.replace(/\{/g, "{{")}"`,
			COLOR.CYAN
		)}`
	);
	lines.push(...promptPlaceholders);
	lines.push("");

	lines.push(
		color("Type 'config <setting> <value>' to change a setting.", COLOR.GREY)
	);

	actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}

function setDefaultColor(
	actor: Actor,
	character: PlayerCharacter,
	value: string | undefined
): void {
	if (!value) {
		const lines: string[] = [];
		lines.push(
			`Current default color: ${formatColor(character.settings.defaultColor)}`
		);
		lines.push(...getColorUsage());
		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
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
}

function setEchoMode(
	actor: Actor,
	character: PlayerCharacter,
	value: string | undefined
): void {
	if (!value) {
		const lines: string[] = [];
		lines.push(
			`Current echo mode: ${formatEchoMode(character.settings.echoMode)}`
		);
		lines.push(...getEchoModeUsage());
		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
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
}

function setPrompt(
	actor: Actor,
	character: PlayerCharacter,
	value: string | undefined
): void {
	if (!value) {
		const currentPrompt = character.settings.prompt ?? "> ";
		const lines: string[] = [];
		lines.push(`Current prompt: "${currentPrompt.replace(/\{/g, "{{")}"`);
		lines.push(...getPromptUsage(1));
		lines.push("");
		lines.push(`Example: config prompt "[%hh/%HH HP] [%xp XP] > "`);
		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
		return;
	}

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
}

function parseBooleanFlag(value: string): boolean | undefined {
	const normalizedValue = value.toLowerCase().trim();
	if (
		normalizedValue === "on" ||
		normalizedValue === "true" ||
		normalizedValue === "1" ||
		normalizedValue === "yes"
	) {
		return true;
	}

	if (
		normalizedValue === "off" ||
		normalizedValue === "false" ||
		normalizedValue === "0" ||
		normalizedValue === "no"
	) {
		return false;
	}
}

function setAutoLook(
	actor: Actor,
	character: PlayerCharacter,
	isOn: boolean
): void {
	character.updateSettings({ autoLook: isOn });
	actor.sendMessage(
		`Auto-look ${isOn ? "enabled" : "disabled"}.`,
		MESSAGE_GROUP.COMMAND_RESPONSE
	);
}

function setVerboseMode(
	actor: Actor,
	character: PlayerCharacter,
	isOn: boolean
): void {
	character.updateSettings({ verboseMode: isOn });
	actor.sendMessage(
		`Verbose mode ${isOn ? "enabled" : "disabled"}.`,
		MESSAGE_GROUP.COMMAND_RESPONSE
	);
}

function setBriefMode(
	actor: Actor,
	character: PlayerCharacter,
	isOn: boolean
): void {
	character.updateSettings({ briefMode: isOn });
	actor.sendMessage(
		`Brief mode ${isOn ? "enabled" : "disabled"}.`,
		MESSAGE_GROUP.COMMAND_RESPONSE
	);
}

function setColorEnabled(
	actor: Actor,
	character: PlayerCharacter,
	isOn: boolean
): void {
	character.updateSettings({ colorEnabled: isOn });
	actor.sendMessage(
		`Color display ${isOn ? "enabled" : "disabled"}.`,
		MESSAGE_GROUP.COMMAND_RESPONSE
	);
}

const BOOLEAN_SETTING_HANDLERS: Record<string, BooleanSettingHandler> = {
	autolook: setAutoLook,
	"auto-look": setAutoLook,
	verbose: setVerboseMode,
	verbosemode: setVerboseMode,
	brief: setBriefMode,
	briefmode: setBriefMode,
	colorenabled: setColorEnabled,
	"color-enabled": setColorEnabled,
	colors: setColorEnabled,
};

const BOOLEAN_USAGE_HELPERS: Record<string, UsageHelper> = {
	autolook: getAutolookUsage,
	"auto-look": getAutolookUsage,
	verbose: getVerboseUsage,
	verbosemode: getVerboseUsage,
	brief: getBriefUsage,
	briefmode: getBriefUsage,
	colorenabled: getColorEnabledUsage,
	"color-enabled": getColorEnabledUsage,
	colors: getColorEnabledUsage,
};

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
			showSettingsOverview(actor, character);
			return;
		}

		const normalizedSetting = setting.toLowerCase();
		if (normalizedSetting === "color") {
			setDefaultColor(actor, character, value);
			return;
		}

		if (normalizedSetting === "echomode" || normalizedSetting === "echo") {
			setEchoMode(actor, character, value);
			return;
		}

		if (normalizedSetting === "prompt") {
			setPrompt(actor, character, value);
			return;
		}

		const booleanHandler = BOOLEAN_SETTING_HANDLERS[normalizedSetting];
		if (booleanHandler) {
			if (!value) {
				const usageHelper = BOOLEAN_USAGE_HELPERS[normalizedSetting];
				const usageLines = usageHelper();
				actor.sendMessage(
					usageLines.join(LINEBREAK),
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			const parsedValue = parseBooleanFlag(value);
			if (parsedValue === undefined) {
				actor.sendMessage(
					`Invalid value "${value}". Use "on" or "off".`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			booleanHandler(actor, character, parsedValue);
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
