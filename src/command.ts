/**
 * Pattern-based command system for the MUD.
 *
 * Provides a small framework to declare commands with human-readable patterns,
 * parse user input into typed arguments, and execute the matching command.
 *
 * What you get
 * - `Command`: abstract base class with pattern parsing and `execute()` hook
 * - `CommandRegistry`: register commands and execute user input centrally
 * - `ARGUMENT_TYPE`: built-in argument types (text, word, number, object, mob, item, equipment, direction, character)
 * - Types: `CommandContext`, `ParseResult`, `ArgumentConfig`, `CommandOptions`
 *
 * Pattern basics
 * - Placeholders: `<name:type>` (required), `<name:type?>` (optional)
 * - Object sources: `<item:object@room>`, `<item:object@inventory>`, `<item:object@all>`, `<item:object@container>` (references another argument)
 * - Autocomplete: `word~` (matches partial input like "o", "oo", "ooc" for "ooc~")
 * - Common types: `text`, `word`, `number`, `object`, `mob`, `item`, `direction`
 *
 * Quick start
 * ```ts
 * import { Command, CommandRegistry } from "./command.js";
 * import { Mob } from "./mob.js";
 *
 * // Define a simple command: say <message:text>
 * class Say extends Command {
 *   readonly pattern = "say <message:text>";
 *   execute(ctx, args) {
 *     const msg = args.get("message");
 *     ctx.actor.sendLine(msg);
 *   }
 * }
 *
 * // Register and execute
 * CommandRegistry.default.register(new Say());
 * const actor = new Mob();
 * CommandRegistry.default.execute("say Hello there!", { actor, room: actor.location as any });
 * ```
 *
 * Notes
 * - Commands are matched longest pattern first (more specific first) in the registry.
 * - Implement `onError()` to customize parsing failure messages for your command.
 * - You can call `parse()` directly for custom flows, but `CommandRegistry` is preferred.
 *
 * @module command
 */

import { DungeonObject, Item, Room, DIRECTION, text2dir } from "./dungeon.js";
import { Mob, Equipment } from "./dungeon.js";
import { Character, MESSAGE_GROUP } from "./character.js";
import { Game } from "./game.js";
import logger from "./logger.js";

/**
 * Context provided to command execution.
 *
 * This interface encapsulates all the necessary context information needed for
 * a command to execute. It provides access to the actor performing the command
 * and their current location (if any).
 *
 * @property actor - The Mob entity executing the command (typically a player or NPC)
 * @property room - The current room where the actor is located (undefined if not in a room)
 *
 * @example
 * ```typescript
 * const context: CommandContext = {
 *   actor: player,
 *   room: currentRoom
 * };
 * ```
 */
export interface CommandContext {
	actor: Mob;
	room?: Room;
}

/**
 * Result of parsing a command pattern against user input.
 *
 * This interface represents the outcome of attempting to parse user input
 * against a command's pattern. A successful parse produces a map of argument
 * names to their parsed values. A failed parse includes an error message
 * explaining why the input didn't match.
 *
 * @property success - True if the input successfully matched the pattern and all required arguments were parsed
 * @property args - Map of argument names to their parsed values (empty if parsing failed)
 * @property error - Optional error message explaining why parsing failed (only present when success is false)
 *
 * @example
 * Successful parse:
 * ```typescript
 * {
 *   success: true,
 *   args: Map { "message" => "Hello, world!" },
 *   error: undefined
 * }
 * ```
 *
 * @example
 * Failed parse (missing argument):
 * ```typescript
 * {
 *   success: false,
 *   args: Map {},
 *   error: "Missing required argument: message"
 * }
 * ```
 */
export interface ParseResult {
	success: boolean;
	args: Map<string, any>;
	error?: string;
}

/**
 * Supported argument types for command patterns.
 *
 * This enum defines all the valid argument types that can be used in command
 * patterns. Each type has specific parsing logic and validation rules.
 *
 * - TEXT: Captures all remaining input text (greedy). Use for messages, descriptions,
 *         or any freeform text. Should be the final argument in a pattern.
 * - WORD: Captures a single word (non-whitespace). Use for names, identifiers, keywords.
 * - NUMBER: Parses an integer. Returns undefined if input is not a valid integer.
 * - OBJECT: Looks up a DungeonObject by keywords. Respects \@source modifiers.
 * - MOB: Looks up a Mob in the current room by keywords.
 * - ITEM: Looks up an Item by keywords. Respects \@source modifiers.
 * - EQUIPMENT: Looks up an Equipment item by keywords. Respects \@source modifiers.
 * - DIRECTION: Parses direction names/abbreviations into DIRECTION values.
 *
 * @example
 * ```typescript
 * ARGUMENT_TYPE.TEXT       // "hello world" -> "hello world"
 * ARGUMENT_TYPE.WORD       // "hello world" -> "hello", `"north wind"` -> "north wind"
 * ARGUMENT_TYPE.NUMBER     // "42 items" -> 42
 * ARGUMENT_TYPE.OBJECT     // "sword" -> DungeonObject (if found)
 * ARGUMENT_TYPE.MOB        // "bob" -> Mob (if found in room)
 * ARGUMENT_TYPE.ITEM       // "potion" -> Item (if found)
 * ARGUMENT_TYPE.EQUIPMENT  // "helmet" -> Equipment (if found)
 * ARGUMENT_TYPE.DIRECTION  // "north" or "n" -> DIRECTION.NORTH
 * ARGUMENT_TYPE.CHARACTER  // "alice" -> Character (online player)
 * ```
 */
export enum ARGUMENT_TYPE {
	TEXT = "text",
	WORD = "word",
	NUMBER = "number",
	OBJECT = "object",
	MOB = "mob",
	ITEM = "item",
	EQUIPMENT = "equipment",
	DIRECTION = "direction",
	CHARACTER = "character",
}

/**
 * Configuration for a command argument extracted from a pattern.
 *
 * This interface represents the parsed configuration of an argument placeholder
 * from a command pattern. It's extracted by analyzing the pattern string and
 * defines how the argument should be parsed and validated.
 *
 * @property name - The identifier for this argument, used as the key in the args Map.
 *                  Extracted from the pattern placeholder (e.g., "message" from "<message:text>").
 *
 * @property type - The ARGUMENT_TYPE defining how to parse this argument's value.
 *                  Determines validation rules and the type of value returned.
 *
 * @property required - Whether this argument must be provided. Defaults to true unless
 *                      the placeholder includes a "?" suffix (e.g., "<dir:word?>").
 *                      Required arguments cause parsing to fail if missing.
 *
 * @property source - For OBJECT type arguments, specifies where to search for the object.
 *                    Extracted from the @ modifier in the pattern (e.g., "<item:object@inventory>").
 *                    - "room": Search only in the current room's contents
 *                    - "inventory": Search only in the actor's inventory
 *                    - "equipment": Search only in the actor's equipped items
 *                    - "all": Search both room and inventory (default)
 *
 * @example
 * Pattern "get <item:object@room>" produces:
 * ```typescript
 * {
 *   name: "item",
 *   type: ARGUMENT_TYPE.OBJECT,
 *   required: true,
 *   source: "room"
 * }
 * ```
 */
export interface ArgumentConfig {
	name: string;
	type: ARGUMENT_TYPE;
	required?: boolean;
	source?: "room" | "inventory" | "all" | string; // string = argument name reference
}

/**
 * Priority levels for command execution order.
 * Commands with higher priority are tried before commands with lower priority.
 * Within the same priority level, commands are sorted by pattern length (longest first).
 */
export enum PRIORITY {
	LOW = 0,
	NORMAL = 1,
	HIGH = 2,
}

export interface CommandOptions {
	pattern: string;
	aliases?: string[];
	priority?: PRIORITY;
}

/**
 * Base class for all commands in the MUD command system.
 *
 * This abstract class provides a powerful pattern-based command parsing system
 * that handles argument extraction, type conversion, and validation. Subclass
 * this to create custom commands with minimal boilerplate.
 *
 * ## Pattern Syntax
 *
 * Command patterns use a special placeholder syntax to define arguments:
 * - `<name:type>` - Required argument
 * - `<name:type?>` - Optional argument (with ? suffix)
 * - `<name:type@source>` - Object/Item argument with search source modifier
 * - `word~` - Literal word with autocomplete (matches partial input)
 *
 * ### Available Argument Types
 * - `text` - Captures all remaining input text (greedy match, should be last argument)
 * - `word` - Captures a single word (stops at first whitespace)
 * - `number` - Parses and validates as an integer
 * - `object` - Finds a DungeonObject by keyword matching
 * - `mob` - Finds a Mob entity by keyword matching in current room
 * - `item` - Finds an Item entity by keyword matching
 * - `equipment` - Finds an Equipment entity by keyword matching
 * - `direction` - Parses direction names/abbreviations into DIRECTION enum values
 * - `character` - Finds an online Character (player) by username or mob keywords
 *
 * ### Source Modifiers (for object, item, and equipment types)
 * - `@room` - Search only in the current room's contents
 * - `@inventory` - Search only in the actor's inventory
 * - `@equipment` - Search only in the actor's equipped items
 * - `@all` - Search both room and inventory (default if not specified)
 *
 * ### Autocomplete Suffix (`~`)
 * - Words followed by `~` can be partially matched from left to right
 * - Example: `"ooc~"` matches `"o"`, `"oo"`, or `"ooc"`
 * - Useful for frequently used commands or commands with long names
 * - Only works on literal words, not on argument placeholders
 *
 * ## Examples
 *
 * ### Simple text command
 * ```typescript
 * class OocCommand extends Command {
 *   pattern = "ooc <message:text>";
 *
 *   execute(context: CommandContext, args: Map<string, any>) {
 *     const message = args.get("message");
 *     console.log(`${context.actor.display} says: ${message}`);
 *   }
 * }
 *
 * // Matches: "say Hello, world!"
 * // Args: { message: "Hello, world!" }
 * ```
 *
 * ### Command with optional argument
 * ```typescript
 * class LookCommand extends Command {
 *   pattern = "look <direction:direction?>";
 *
 *   execute(context: CommandContext, args: Map<string, any>) {
 *     const direction = args.get("direction");
 *     if (direction !== undefined) {
 *       console.log(`You look ${direction}...`);
 *     } else {
 *       console.log("You look around the room...");
 *     }
 *   }
 * }
 *
 * // Matches: "look" or "look north"
 * // Args: {} or { direction: DIRECTION.NORTH }
 * ```
 *
 * ### Object manipulation with source modifiers
 * ```typescript
 * class GetCommand extends Command {
 *   pattern = "get <item:object@room>";
 *
 *   execute(context: CommandContext, args: Map<string, any>) {
 *     const item = args.get("item") as DungeonObject;
 *     context.actor.add(item);
 *     console.log(`You pick up the ${item.display}.`);
 *   }
 * }
 *
 * // Matches: "get sword" (searches only in room)
 * // Args: { item: <DungeonObject> }
 * ```
 *
 * ### Multiple arguments with different sources
 * ```typescript
 * class PutCommand extends Command {
 *   pattern = "put <item:object@inventory> in <container:object@room>";
 *
 *   execute(context: CommandContext, args: Map<string, any>) {
 *     const item = args.get("item") as DungeonObject;
 *     const container = args.get("container") as DungeonObject;
 *     container.add(item);
 *     console.log(`You put the ${item.display} in the ${container.display}.`);
 *   }
 * }
 *
 * // Matches: "put coin in bag"
 * // Args: { item: <coin from inventory>, container: <bag from room> }
 * ```
 *
 * ### Autocomplete matching
 * ```typescript
 * class OocCommand extends Command {
 *   pattern = "ooc~ <message:text>";
 *
 *   execute(context: CommandContext, args: Map<string, any>) {
 *     const message = args.get("message");
 *     console.log(`[OOC] ${context.actor.display}: ${message}`);
 *   }
 * }
 *
 * // Matches: "o hello", "oo hello", or "ooc hello"
 * // All produce: { message: "hello" }
 * ```
 *
 * ### Mob targeting
 * ```typescript
 * class TellCommand extends Command {
 *   pattern = "tell <target:mob> <message:text>";
 *   aliases = ["whisper <target:mob> <message:text>", "t <target:mob> <message:text>"];
 *
 *   execute(context: CommandContext, args: Map<string, any>) {
 *     const target = args.get("target") as Mob;
 *     const message = args.get("message");
 *     console.log(`You tell ${target.display}: ${message}`);
 *   }
 * }
 *
 * // Matches: "tell bob hello", "whisper bob hello", or "t bob hello"
 * // Args: { target: <Mob>, message: "hello" }
 * ```
 *
 * ### Number arguments
 * ```typescript
 * class DropCommand extends Command {
 *   pattern = "drop <quantity:number> <item:item@inventory>";
 *
 *   execute(context: CommandContext, args: Map<string, any>) {
 *     const quantity = args.get("quantity");
 *     const item = args.get("item") as Item;
 *     console.log(`You drop ${quantity} ${item.display}(s).`);
 *   }
 * }
 *
 * // Matches: "drop 5 coins"
 * // Args: { quantity: 5, item: <Item> }
 * ```
 *
 * ## Error Handling
 *
 * The parsing system provides detailed error messages:
 * - "Missing required argument: <name>" - Required argument not provided
 * - "Could not parse argument: <name>" - Argument value invalid for its type
 * - "Input does not match command pattern" - No pattern matched the input
 *
 * Implement the optional `onError()` method to provide custom error handling
 * and user guidance when parsing fails.
 *
 * ## Command Execution Flow
 *
 * 1. Input is matched against the command pattern and aliases
 * 2. Arguments are extracted from regex capture groups
 * 3. Each argument is parsed and validated based on its type
 * 4. If parsing succeeds, `execute()` is called with the parsed arguments
 * 5. If parsing fails, `onError()` is called if implemented
 *
 * @abstract
 * @class
 */
export abstract class Command {
	/**
	 * The command pattern using placeholder syntax.
	 *
	 * Define the structure of your command using literal text and argument
	 * placeholders. The pattern is case-insensitive when matching input.
	 *
	 * Placeholders:
	 * - `<name:type>` - Required argument
	 * - `<name:type?>` - Optional argument (with ? suffix)
	 * - `<name:type@source>` - Object/Item/Mob argument with search source modifier
	 * - `word~` - Literal word with autocomplete (matches partial input)
	 *
	 * Examples:
	 * - `"say <message:text>"` - Simple command with one required text argument
	 * - `"tell <target:mob> <message:text>"` - Two required arguments
	 * - `"get <item:object>"` - Object argument (searches room and inventory)
	 * - `"get <item:object@room>"` - Object argument (searches only room)
	 * - `"put <item:object@inventory> in <container:object@room>"` - Multiple object arguments with different sources
	 * - `"look <direction:direction?>"` - Optional direction argument
	 * - `"drop <quantity:number> <item:item@inventory>"` - Number and item arguments
	 * - `"ooc~ <message:text>"` - Autocomplete: matches "o", "oo", or "ooc"
	 */
	readonly pattern!: string;

	/**
	 * Optional aliases for the command.
	 *
	 * Aliases are alternative patterns that trigger the same command execution.
	 * Each alias follows the same pattern syntax as the main pattern and can
	 * have different structures. When input is parsed, all patterns (main + aliases)
	 * are tried in order until one matches.
	 *
	 * This is useful for:
	 * - Providing abbreviations ("l" as an alias for "look")
	 * - Supporting alternate phrasings ("whisper" as an alias for "tell")
	 * - Backwards compatibility when changing command syntax
	 *
	 * @example
	 * ```typescript
	 * class TellCommand extends Command {
	 *   constructor() {
	 *     super("tell <target:mob> <message:text>", [
	 *       "whisper <target:mob> <message:text>",
	 *       "t <target:mob> <message:text>"
	 *     ]);
	 *   }
	 *   // ... execute implementation
	 * }
	 * // Now "tell bob hi", "whisper bob hi", and "t bob hi" all work
	 * ```
	 */
	readonly aliases?: string[];

	/**
	 * Priority level for this command.
	 * Commands with higher priority are tried before commands with lower priority.
	 * Defaults to PRIORITY.NORMAL.
	 */
	readonly priority: PRIORITY = PRIORITY.NORMAL;

	/**
	 * Cached pattern information for efficient parsing.
	 * Built once during construction to avoid rebuilding regex patterns on every parse.
	 * @private
	 */
	private patternCache: Array<{
		pattern: string;
		regex: RegExp;
		argConfigs: ArgumentConfig[];
	}> = [];

	/**
	 * Initialize the command and build cached regex patterns.
	 * Builds the pattern cache immediately using the provided options (if any)
	 * or the subclass's own `pattern`/`aliases` fields.
	 *
	 * @param options - Optional CommandOptions: `{ pattern, aliases }`
	 *
	 * @example
	 * ```typescript
	 * // Define pattern via subclass fields
	 * class Say extends Command {
	 *   readonly pattern = "say <message:text>";
	 *   constructor() { super(); }
	 *   execute(ctx: CommandContext, args: Map<string, any>) { // ... }
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Define pattern via options
	 * class Tell extends Command {
	 *   constructor() {
	 *     super({
	 *       pattern: "tell <target:mob> <message:text>",
	 *       aliases: ["whisper <target:mob> <message:text>"]
	 *     });
	 *   }
	 *   execute(ctx: CommandContext, args: Map<string, any>) { // ... }
	 * }
	 * ```
	 */
	constructor(options?: CommandOptions) {
		if (options) {
			if (options.pattern) this.pattern = options.pattern;
			if (options.aliases) this.aliases = options.aliases;
			if (options.priority !== undefined) this.priority = options.priority;
		}
		this.buildPatternCache();
	}

	/**
	 * Build cached regex patterns for efficient parsing.
	 * This is called once during construction.
	 * @private
	 */
	private buildPatternCache(): void {
		const patterns = [this.pattern, ...(this.aliases || [])];

		for (const pattern of patterns) {
			this.patternCache.push({
				pattern,
				regex: this.buildRegex(pattern),
				argConfigs: this.extractArgumentConfigs(pattern),
			});
		}
	}

	/**
	 * Execute the command with parsed arguments.
	 *
	 * This method is called after the input has been successfully parsed and
	 * all arguments have been extracted and validated. Implement this method
	 * to define what your command actually does.
	 *
	 * The args Map contains all successfully parsed arguments, keyed by their
	 * names from the pattern. Optional arguments may not be present in the map
	 * if they weren't provided in the input.
	 *
	 * @param context - The execution context containing the actor and their location
	 * @param args - Map of argument names to their parsed values
	 *
	 * @example
	 * ```typescript
	 * execute(context: CommandContext, args: Map<string, any>) {
	 *   const item = args.get("item") as DungeonObject;
	 *   const quantity = args.get("quantity") ?? 1; // Default if optional
	 *
	 *   if (!item) {
	 *     console.log("You don't have that item.");
	 *     return;
	 *   }
	 *
	 *   console.log(`You use ${quantity} ${item.display}(s).`);
	 * }
	 * ```
	 *
	 * @abstract
	 * @returns {void}
	 */
	abstract execute(context: CommandContext, args: Map<string, any>): void;

	/**
	 * Optional cooldown (in milliseconds) for action commands.
	 *
	 * Override this to opt-in to the action queue system. Return a positive
	 * number to mark the command as an action that should respect cooldowns
	 * and queue subsequent action inputs until the cooldown elapses.
	 *
	 * Returning 0 or undefined means the command executes immediately without
	 * entering the action queue.
	 */
	getActionCooldownMs(
		_context: CommandContext,
		_args: Map<string, any>
	): number | undefined {
		return undefined;
	}

	/**
	 * Handle parsing errors with custom messaging.
	 *
	 * This optional method is called when the command pattern matches but
	 * parsing fails (missing required arguments, invalid argument values, etc.).
	 * Override this to provide custom error messages and usage information
	 * specific to your command.
	 *
	 * If not implemented, the default error message from the ParseResult is used.
	 *
	 * Common use cases:
	 * - Show usage examples for your command
	 * - Provide context-specific help
	 * - Guide users on correct syntax
	 * - Explain why their input was invalid
	 *
	 * @param context - The execution context
	 * @param result - The failed parse result containing the error message
	 * @returns {void}
	 *
	 * @example
	 * ```typescript
	 * onError(context: CommandContext, result: ParseResult) {
	 *   console.log(`Usage: ${this.pattern}`);
	 *   console.log(`Error: ${result.error}`);
	 *   console.log(`Example: tell bob Hello, how are you?`);
	 * }
	 * ```
	 *
	 * @example
	 * More detailed error handling:
	 * ```typescript
	 * onError(context: CommandContext, result: ParseResult) {
	 *   if (result.error?.includes("Missing required argument: message")) {
	 *     console.log("You need to provide a message to say!");
	 *     console.log("Usage: say <message>");
	 *     console.log('Example: say Hello, everyone!');
	 *   } else if (result.error?.includes("Could not parse argument: player")) {
	 *     console.log("That player is not here.");
	 *     console.log("Try 'look' to see who's around.");
	 *   } else {
	 *     console.log(`Error: ${result.error}`);
	 *   }
	 * }
	 * ```
	 */
	onError?(context: CommandContext, result: ParseResult): void;
	/**
	 * Parse the input against this command's pattern.
	 *
	 * This is the main entry point for command parsing. It attempts to match
	 * the input against the command's pattern and all aliases, parsing arguments
	 * and performing validation. The first pattern that successfully matches is used.
	 *
	 * The parsing process:
	 * 1. Try the main pattern, then each alias in order
	 * 2. For each pattern, use the cached regex and attempt to match the input
	 * 3. Extract argument values from the regex capture groups
	 * 4. Parse and validate each argument based on its type
	 * 5. Return success with parsed args, or failure with an error message
	 *
	 * Error messages are specific when possible:
	 * - "Missing required argument: <name>" when a required arg isn't provided
	 * - "Could not parse argument: <name>" when parsing/finding fails
	 * - "Input does not match command pattern" for general mismatches
	 *
	 * @param input - The raw input string from the user (typically lowercase)
	 * @param context - The execution context for finding objects/players
	 * @returns {ParseResult} Result containing success status, parsed args, and optional error
	 *
	 * @example
	 * ```typescript
	 * const command = new GetCommand();
	 * const result = command.parse("get sword", context);
	 *
	 * if (result.success) {
	 *   const item = result.args.get("item");
	 *   command.execute(context, result.args);
	 * } else {
	 *   console.log(result.error);
	 * }
	 * ```
	 */
	parse(input: string, context: CommandContext): ParseResult {
		let lastError = "Input does not match command pattern";

		for (const cachedPattern of this.patternCache) {
			const result = this.parseWithCachedPattern(cachedPattern, input, context);
			if (result.success) return result;
			// Keep the most specific error message
			if (result.error && result.error !== "Input does not match pattern") {
				lastError = result.error;
			}
		}

		return {
			success: false,
			args: new Map(),
			error: lastError,
		};
	}

	/**
	 * Parse input against a cached pattern.
	 *
	 * This internal method handles the parsing logic using pre-built regex patterns
	 * and argument configurations. It matches the input against the cached regex,
	 * extracts argument values from capture groups, and validates/parses each argument.
	 *
	 * @private
	 * @param cachedPattern - The cached pattern with regex and argument configs
	 * @param input - The user's input string
	 * @param context - The execution context for object/player lookups
	 * @returns {ParseResult} Success with args, or failure with specific error message
	 */
	private parseWithCachedPattern(
		cachedPattern: {
			pattern: string;
			regex: RegExp;
			argConfigs: ArgumentConfig[];
		},
		input: string,
		context: CommandContext
	): ParseResult {
		const args = new Map<string, any>();
		const { regex, argConfigs } = cachedPattern;

		const match = input.match(regex);
		if (!match) {
			return {
				success: false,
				args,
				error: "Input does not match pattern",
			};
		}

		// First pass: parse all arguments without resolving argument-based sources
		const tempArgs = new Map<string, any>();
		for (let i = 0; i < argConfigs.length; i++) {
			const config = argConfigs[i];
			const rawValue = match[i + 1];

			// Handle undefined or empty values
			if (!rawValue || rawValue.trim() === "") {
				if (config.required !== false) {
					return {
						success: false,
						args,
						error: `Missing required argument: ${config.name}`,
					};
				}
				// Skip optional arguments that aren't provided
				continue;
			}

			// Check if this argument's source references another argument
			const needsDeferredResolution =
				config.source &&
				config.source !== "room" &&
				config.source !== "inventory" &&
				config.source !== "all" &&
				!tempArgs.has(config.source);

			if (needsDeferredResolution) {
				// Store raw value for deferred parsing
				tempArgs.set(config.name, { rawValue: rawValue.trim(), config });
			} else {
				const parsedValue = this.parseArgument(
					rawValue.trim(),
					config,
					context,
					tempArgs
				);
				if (parsedValue === undefined && config.required !== false) {
					return {
						success: false,
						args,
						error: `Could not parse argument: ${config.name}`,
					};
				}

				if (parsedValue !== undefined) {
					tempArgs.set(config.name, parsedValue);
				}
			}
		}

		// Second pass: resolve deferred arguments that reference other arguments
		for (const [name, value] of tempArgs.entries()) {
			if (value && typeof value === "object" && value.rawValue !== undefined) {
				const deferred = value as { rawValue: string; config: ArgumentConfig };
				const parsedValue = this.parseArgument(
					deferred.rawValue,
					deferred.config,
					context,
					tempArgs
				);
				if (parsedValue === undefined && deferred.config.required !== false) {
					return {
						success: false,
						args,
						error: `Could not parse argument: ${name}`,
					};
				}

				if (parsedValue !== undefined) {
					tempArgs.set(name, parsedValue);
				}
			}
		}

		// Copy all parsed arguments to the final args map
		for (const [name, value] of tempArgs.entries()) {
			if (
				!(value && typeof value === "object" && value.rawValue !== undefined)
			) {
				args.set(name, value);
			}
		}

		return { success: true, args };
	}

	/**
	 * Extract argument configurations from a pattern string.
	 *
	 * This method analyzes a pattern string and extracts all argument placeholders,
	 * converting them into ArgumentConfig objects that define how each argument
	 * should be parsed and validated.
	 *
	 * Placeholder syntax:
	 * - `<name:type>` - Required argument
	 * - `<name:type?>` - Optional argument (? suffix)
	 * - `<name:type@source>` - Object argument with source modifier
	 *   - Literal sources: `@room`, `@inventory`, `@equipment`, `@all`
	 *   - Argument reference: `@container` (references another argument named "container")
	 *
	 * The extraction process:
	 * 1. Find all `<...>` placeholders using regex
	 * 2. Split each placeholder into name, type, and optional flag
	 * 3. Extract source modifier from type (if present)
	 * 4. Build ArgumentConfig object with parsed information
	 *
	 * @private
	 * @param pattern - The pattern string to analyze
	 * @returns {ArgumentConfig[]} Array of argument configurations in order of appearance
	 *
	 * @example
	 * Pattern: "get <item:object@room> from <container:object?>"
	 * Returns:
	 * ```typescript
	 * [
	 *   { name: "item", type: ARGUMENT_TYPE.OBJECT, required: true, source: "room" },
	 *   { name: "container", type: ARGUMENT_TYPE.OBJECT, required: false, source: "all" }
	 * ]
	 * ```
	 *
	 * @example
	 * Pattern: "get <item:item@container> from <container:object>"
	 * Returns:
	 * ```typescript
	 * [
	 *   { name: "item", type: ARGUMENT_TYPE.ITEM, required: true, source: "container" },
	 *   { name: "container", type: ARGUMENT_TYPE.OBJECT, required: true, source: "all" }
	 * ]
	 * ```
	 * The "item" argument will search inside the "container" argument's contents.
	 */
	private extractArgumentConfigs(pattern: string): ArgumentConfig[] {
		const configs: ArgumentConfig[] = [];
		const argRegex = /<([^:>]+):([^>]+?)(\?)?>/g;
		let match;

		while ((match = argRegex.exec(pattern)) !== null) {
			const [, name, typeStr, optional] = match;
			const parts = typeStr.split("@");
			const type = parts[0] as ARGUMENT_TYPE;
			const sourceStr = parts[1];

			// Determine if source is a literal or an argument reference
			let source: "room" | "inventory" | "all" | string | undefined;
			if (sourceStr) {
				// Check if it's a literal source value
				if (
					sourceStr === "room" ||
					sourceStr === "inventory" ||
					sourceStr === "all"
				) {
					source = sourceStr;
				} else {
					// Otherwise, treat it as an argument name reference
					source = sourceStr;
				}
			}

			configs.push({
				name,
				type,
				required: !optional,
				source: source || "all",
			});
		}

		return configs;
	}

	/**
	 * Build a regex pattern from a command pattern string.
	 *
	 * This method converts a command pattern with placeholders into a regular
	 * expression that can match user input. The regex is designed to:
	 * 1. Match the literal parts of the pattern exactly (case-insensitive)
	 * 2. Capture argument values in groups for extraction
	 * 3. Make all arguments optional so missing required args can be detected
	 * 4. Support autocomplete matching with `~` suffix on literal words
	 *
	 * The conversion process:
	 * 1. Replace all argument placeholders with temporary markers
	 * 2. Escape special regex characters in literal text
	 * 3. Replace markers with appropriate regex patterns
	 *    - Handles preceding spaces to avoid requiring double spaces
	 *    - Uses non-capturing groups for optional arguments
	 *
	 * All arguments are made optional in the regex (using `?` quantifier) so that
	 * we can provide better error messages by detecting which specific argument
	 * is missing, rather than just failing to match entirely.
	 *
	 * Autocomplete suffix (`~`):
	 * - Words followed by `~` can be partially matched
	 * - Example: "ooc~" matches "o", "oo", or "ooc"
	 * - Useful for commands with long names or frequently used shortcuts
	 *
	 * @private
	 * @param pattern - The command pattern with placeholders
	 * @returns {RegExp} Case-insensitive regex for matching input
	 *
	 * @example
	 * Pattern: "say <message:text>"
	 * Regex: /^say(?: (.+))?$/i
	 * Matches: "say" (message=undefined) or "say hello" (message="hello")
	 *
	 * @example
	 * Pattern: "get <item:object> from <container:object>"
	 * Regex: /^get(?: (.+?))? from(?: (.+?))?$/i
	 *
	 * @example
	 * Pattern: "ooc~ <message:text>"
	 * Regex: /^o(?:o(?:c)?)?(?: (.+))?$/i
	 * Matches: "o hello", "oo hello", or "ooc hello"
	 */
	private buildRegex(pattern: string): RegExp {
		let regexStr = pattern;

		// Replace optional patterns first (with ? suffix) - use placeholders to avoid escaping
		regexStr = regexStr
			.replace(/<[^:>]+:text\?>/g, "___OPTIONAL_TEXT___")
			.replace(/<[^:>]+:word\?>/g, "___OPTIONAL_WORD___")
			.replace(/<[^:>]+:number\?>/g, "___OPTIONAL_NUMBER___")
			.replace(/<[^:>]+:[^>]+\?>/g, "___OPTIONAL_GENERIC___");

		// Replace required patterns (no ? suffix) - but make them optional in regex for better errors
		regexStr = regexStr
			.replace(/<[^:>]+:text>/g, "___OPTIONAL_TEXT___")
			.replace(/<[^:>]+:word>/g, "___OPTIONAL_WORD___")
			.replace(/<[^:>]+:number>/g, "___OPTIONAL_NUMBER___")
			.replace(/<[^:>]+:[^>]+>/g, "___OPTIONAL_GENERIC___");

		// Escape special regex characters in the literal parts
		regexStr = regexStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

		// Handle autocomplete suffix (~) for literal words
		// Convert "word~" into a pattern that matches partial input
		// Example: "ooc~" becomes "o(?:o(?:c)?)?" which matches "o", "oo", or "ooc"
		regexStr = regexStr.replace(/([a-z]+)~/gi, (match, word) => {
			// Build nested optional groups for each character after the first
			let autocompletePattern = word[0];
			for (let i = 1; i < word.length; i++) {
				autocompletePattern += `(?:${word[i]}`;
			}
			// Close all the optional groups
			autocompletePattern += ")?".repeat(word.length - 1);
			return autocompletePattern;
		});

		// Now replace the placeholders with actual regex patterns
		// For arguments with a preceding space, the space is required but the argument is optional
		const wordTokenPattern = `(?:"[^"]+"|'[^']+'|\\S+)`;

		regexStr = regexStr
			.replace(/ ___OPTIONAL_TEXT___/g, "(?: (.+))?")
			.replace(/ ___OPTIONAL_WORD___/g, `(?: (${wordTokenPattern}))?`)
			.replace(/ ___OPTIONAL_NUMBER___/g, "(?: (\\d+))?")
			.replace(/ ___OPTIONAL_GENERIC___/g, "(?: (.+?))?")
			// Handle any remaining placeholders without preceding spaces
			// No space required, argument can immediately follow the previous literal
			.replace(/___OPTIONAL_TEXT___/g, "(?:(.+))?")
			.replace(/___OPTIONAL_WORD___/g, `(?:(${wordTokenPattern}))?`)
			.replace(/___OPTIONAL_NUMBER___/g, "(?:(\\d+))?")
			.replace(/___OPTIONAL_GENERIC___/g, "(?:(.+?))?");

		const regex = new RegExp(`^${regexStr}$`, "i");
		//logger.debug(`> ${this.pattern}: '${regex}'`);
		return regex;
	}

	/**
	 * Parse a raw string value into the appropriate type.
	 *
	 * This method handles type-specific parsing and validation for argument values.
	 * Each ArgumentType has its own parsing logic and validation rules.
	 *
	 * Type-specific behaviors:
	 * - TEXT: Returns the value as-is (no parsing)
	 * - WORD: Extracts a single token, honoring quoted phrases
	 * - NUMBER: Parses as integer, returns undefined if invalid
	 * - OBJECT: Searches for matching DungeonObject in specified source
	 * - MOB: Searches for matching Mob in current room
	 * - ITEM: Searches for matching Item in specified source
	 * - DIRECTION: Maps direction name/abbreviation to DIRECTION enum value
	 *
	 * Returns undefined if:
	 * - NUMBER: Value is not a valid integer
	 * - OBJECT: No matching object found in search locations
	 * - MOB: No matching mob found in room
	 * - ITEM: No matching item found in search locations
	 * - DIRECTION: Direction name not recognized
	 *
	 * @private
	 * @param value - The raw string value extracted from input
	 * @param config - The argument configuration defining type and source
	 * @param context - The execution context for object/mob/item lookups
	 * @returns {any} The parsed value, or undefined if parsing fails
	 *
	 * @example
	 * parseArgument("5", { type: ARGUMENT_TYPE.NUMBER }, context)
	 * // Returns: 5
	 *
	 * @example
	 * parseArgument("sword", { type: ARGUMENT_TYPE.OBJECT, source: "room" }, context)
	 * // Returns: <DungeonObject> or undefined
	 *
	 * @example
	 * parseArgument("bob", { type: ARGUMENT_TYPE.MOB }, context)
	 * // Returns: <Mob> or undefined
	 */
	private parseArgument(
		value: string,
		config: ArgumentConfig,
		context: CommandContext,
		parsedArgs: Map<string, any>
	): any {
		switch (config.type) {
			case ARGUMENT_TYPE.TEXT:
				return value;

			case ARGUMENT_TYPE.WORD: {
				const trimmed = value.trim();
				if (!trimmed) return trimmed;
				const startsWithQuote =
					(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
					(trimmed.startsWith("'") && trimmed.endsWith("'"));
				if (startsWithQuote && trimmed.length >= 2) {
					return trimmed.substring(1, trimmed.length - 1);
				}
				return trimmed.split(/\s+/)[0];
			}

			case ARGUMENT_TYPE.NUMBER:
				const num = parseInt(value, 10);
				return isNaN(num) ? undefined : num;

			case ARGUMENT_TYPE.OBJECT:
				return this.findObject(
					value,
					config.source || "all",
					context,
					parsedArgs
				);

			case ARGUMENT_TYPE.MOB:
				return this.findMob(value, context);

			case ARGUMENT_TYPE.ITEM:
				return this.findItem(
					value,
					config.source || "all",
					context,
					parsedArgs
				);

			case ARGUMENT_TYPE.EQUIPMENT:
				return this.findEquipment(
					value,
					config.source || "all",
					context,
					parsedArgs
				);

			case ARGUMENT_TYPE.DIRECTION:
				return this.parseDirection(value);

			case ARGUMENT_TYPE.CHARACTER:
				return this.findCharacter(value, context);

			default:
				return value;
		}
	}

	/**
	 * Parse a number prefix from keywords (e.g., "2.sword" -> { index: 1, keywords: "sword" }).
	 * Returns undefined for index if no number prefix is found.
	 */
	private parseNumberPrefix(keywords: string): {
		index: number | undefined;
		keywords: string;
	} {
		const match = keywords.match(/^(\d+)\.(.+)$/);
		if (match) {
			const index = parseInt(match[1], 10) - 1; // Convert to 0-based index
			return { index, keywords: match[2] };
		}
		return { index: undefined, keywords };
	}

	/**
	 * Generic helper to find objects by keywords with source resolution and number prefix support.
	 *
	 * @param keywords - The keywords to search for (may include number prefix like "2.sword")
	 * @param source - Where to search: "room", "inventory", "all", "equipment", or container argument name
	 * @param context - The execution context providing room and actor
	 * @param parsedArgs - Map of already parsed arguments (for argument-based sources)
	 * @param predicate - Function to filter objects (e.g., `obj => obj instanceof Item && obj.match(keywords)`)
	 * @returns Matching object at specified index, or undefined if none found
	 */
	private findObjectsBySource<T extends DungeonObject>(
		keywords: string,
		source: "room" | "inventory" | "all" | "equipment" | string,
		context: CommandContext,
		parsedArgs: Map<string, any>,
		predicate: (obj: DungeonObject, searchKeywords: string) => obj is T
	): T | undefined {
		const { index, keywords: searchKeywords } =
			this.parseNumberPrefix(keywords);
		const searchLocations: DungeonObject[] = [];

		// Resolve argument-based source
		let resolvedSource = source;
		if (
			source !== "room" &&
			source !== "inventory" &&
			source !== "all" &&
			source !== "equipment" &&
			source !== undefined
		) {
			// Check if source refers to another argument (container)
			const containerArg = parsedArgs.get(source);
			if (containerArg instanceof DungeonObject) {
				// Search inside the specified container
				searchLocations.push(...containerArg.contents);
				const matches = searchLocations.filter((obj) =>
					predicate(obj, searchKeywords)
				);
				return index !== undefined ? matches[index] : matches[0];
			}
			// If argument not found or not a DungeonObject, fall back to "all"
			resolvedSource = "all";
		}

		// Handle equipment source
		if (resolvedSource === "equipment") {
			if (context.actor instanceof Mob) {
				const allEquipped = context.actor.getAllEquipped();
				for (const equipment of allEquipped) {
					searchLocations.push(equipment);
				}
				const matches = searchLocations.filter((obj) =>
					predicate(obj, searchKeywords)
				);
				return index !== undefined ? matches[index] : matches[0];
			}
			return undefined;
		}

		// Add room contents if needed
		if (
			(resolvedSource === "room" || resolvedSource === "all") &&
			context.room
		) {
			searchLocations.push(...context.room.contents);
		}

		// Add inventory if needed
		if (resolvedSource === "inventory" || resolvedSource === "all") {
			searchLocations.push(...context.actor.contents);
		}

		const matches = searchLocations.filter((obj) =>
			predicate(obj, searchKeywords)
		);
		return index !== undefined ? matches[index] : matches[0];
	}

	/**
	 * Find an object by keywords in the specified source.
	 *
	 * This method searches for a DungeonObject that matches the given keywords,
	 * respecting the source modifier to determine where to search.
	 *
	 * Search locations by source:
	 * - "room": Current room contents + objects inside room containers
	 * - "inventory": Actor's inventory contents only
	 * - "equipment": Actor's equipped items only
	 * - "all": Both room and inventory (default)
	 *
	 * The search uses the DungeonObject's keyword matching system, which supports
	 * partial matches and handles multiple keywords. Supports number prefixes
	 * like "2.sword" to select the 2nd matching object (1-based).
	 *
	 * Nested container support: When searching in the room, this method also
	 * searches inside containers (objects with contents), allowing commands like
	 * "get coin from chest" to work properly.
	 *
	 * @private
	 * @param keywords - The keywords to search for (from user input, may include number prefix like "2.sword")
	 * @param source - Where to search: "room", "inventory", or "all"
	 * @param context - The execution context providing room and actor
	 * @returns {DungeonObject | undefined} Matching object at specified index, or undefined if none found
	 *
	 * @example
	 * // Search for "sword" in room only
	 * findObject("sword", "room", context)
	 * // Returns: <DungeonObject with keywords "sword"> or undefined
	 *
	 * @example
	 * // Search for 2nd "coin" in actor's inventory
	 * findObject("2.coin", "inventory", context)
	 * // Returns: 2nd <DungeonObject> from actor.contents or undefined
	 */
	private findObject(
		keywords: string,
		source: "room" | "inventory" | "all" | string,
		context: CommandContext,
		parsedArgs: Map<string, any>
	): DungeonObject | undefined {
		return this.findObjectsBySource(
			keywords,
			source,
			context,
			parsedArgs,
			(obj, searchKeywords): obj is DungeonObject => obj.match(searchKeywords)
		);
	}

	/**
	 * Find a mob by keywords.
	 *
	 * This method searches for a Mob entity (player or NPC) in the current
	 * room that matches the given keywords. Only searches the room's contents
	 * for Mob objects.
	 *
	 * Unlike findObject, this method only searches Mob entities because
	 * mob-targeting commands (tell, attack, give, etc.) should only target
	 * entities that can act, not inanimate objects or generic items.
	 *
	 * Supports number prefixes like "2.bob" to select the 2nd matching mob (1-based).
	 *
	 * Returns undefined if:
	 * - The actor is not in a room (context.room is undefined)
	 * - No Mob entity in the room matches the keywords
	 * - The specified index is out of range
	 *
	 * @private
	 * @param keywords - The keywords to search for (typically a name, may include number prefix like "2.bob")
	 * @param context - The execution context providing the room
	 * @returns {Mob | undefined} Matching Mob at specified index, or undefined if none found
	 *
	 * @example
	 * // Search for "bob" in current room
	 * findMob("bob", context)
	 * // Returns: <Mob with keywords "bob"> or undefined
	 *
	 * @example
	 * // Search for 2nd "goblin" in current room
	 * findMob("2.goblin", context)
	 * // Returns: 2nd <Mob> matching "goblin" or undefined
	 */
	private findMob(keywords: string, context: CommandContext): Mob | undefined {
		if (!context.room) return undefined;

		const { index, keywords: searchKeywords } =
			this.parseNumberPrefix(keywords);
		const matches = context.room.contents.filter(
			(obj) => obj instanceof Mob && obj.match(searchKeywords)
		) as Mob[];
		return index !== undefined ? matches[index] : matches[0];
	}

	/**
	 * Find a character (player) by username or mob keywords.
	 *
	 * This method searches for an online Character (player) by matching against
	 * their username or their mob's keywords. It searches all currently connected
	 * players using the Game instance.
	 *
	 * The search is case-insensitive for usernames and uses the mob's keyword
	 * matching system which supports partial matches. Supports number prefixes
	 * like "2.alice" to select the 2nd matching character (1-based).
	 *
	 * Returns undefined if:
	 * - No Game instance is available (Game.game is undefined)
	 * - No online character matches the provided username/keywords
	 * - The specified index is out of range
	 *
	 * @private
	 * @param keywords - The username or keywords to search for (may include number prefix like "2.alice")
	 * @param context - The execution context (unused but kept for consistency)
	 * @returns {Character | undefined} Matching Character at specified index, or undefined if none found
	 *
	 * @example
	 * // Search for character by username
	 * findCharacter("alice", context)
	 * // Returns: <Character with username "alice"> or undefined
	 *
	 * @example
	 * // Search for 2nd character by mob keywords
	 * findCharacter("2.ali", context)
	 * // Returns: 2nd <Character> whose mob matches "ali"> or undefined
	 */
	private findCharacter(
		keywords: string,
		context: CommandContext
	): Character | undefined {
		if (!Game.game) return undefined;

		const { index, keywords: searchKeywords } =
			this.parseNumberPrefix(keywords);
		const matches: Character[] = [];

		Game.game.forEachCharacter((char: Character) => {
			// Check username match (case-insensitive)
			if (
				char.credentials.username.toLowerCase() === searchKeywords.toLowerCase()
			) {
				matches.push(char);
				return;
			}

			// Check mob keyword match
			if (char.mob && char.mob.match(searchKeywords)) {
				matches.push(char);
				return;
			}
		});

		return index !== undefined ? matches[index] : matches[0];
	}

	/**
	 * Find an item by keywords in the specified source.
	 *
	 * This method searches for an Item entity that matches the given keywords,
	 * respecting the source modifier to determine where to search.
	 *
	 * Search locations by source:
	 * - "room": Current room contents + items inside room containers
	 * - "inventory": Actor's inventory contents only
	 * - "equipment": Actor's equipped items only
	 * - "all": Both room and inventory (default)
	 *
	 * The search uses the Item's keyword matching system, which supports
	 * partial matches and handles multiple keywords. Supports number prefixes
	 * like "2.potion" to select the 2nd matching item (1-based).
	 *
	 * Nested container support: When searching in the room, this method also
	 * searches inside containers (objects with contents), allowing commands like
	 * "get potion from bag" to work properly.
	 *
	 * @private
	 * @param keywords - The keywords to search for (from user input, may include number prefix like "2.potion")
	 * @param source - Where to search: "room", "inventory", or "all"
	 * @param context - The execution context providing room and actor
	 * @returns {Item | undefined} Matching item at specified index, or undefined if none found
	 *
	 * @example
	 * // Search for "potion" in room only
	 * findItem("potion", "room", context)
	 * // Returns: <Item with "potion" keywords> or undefined
	 *
	 * @example
	 * // Search for 2nd "coin" in inventory
	 * findItem("2.coin", "inventory", context)
	 * // Returns: 2nd <Item> matching "coin" or undefined
	 */
	private findItem(
		keywords: string,
		source: "room" | "inventory" | "all" | string,
		context: CommandContext,
		parsedArgs: Map<string, any>
	): Item | undefined {
		return this.findObjectsBySource(
			keywords,
			source,
			context,
			parsedArgs,
			(obj, searchKeywords): obj is Item =>
				obj instanceof Item && obj.match(searchKeywords)
		);
	}

	/**
	 * Find an equipment item by keywords in the specified source.
	 *
	 * This method searches for an Equipment entity that matches the given keywords,
	 * respecting the source modifier to determine where to search.
	 *
	 * Search locations by source:
	 * - "room": Current room contents + items inside room containers
	 * - "inventory": Actor's inventory contents only
	 * - "equipment": Actor's equipped items only
	 * - "all": Both room and inventory (default)
	 *
	 * The search uses the Equipment's keyword matching system, which supports
	 * partial matches and handles multiple keywords. Supports number prefixes
	 * like "2.helmet" to select the 2nd matching equipment (1-based).
	 *
	 * Nested container support: When searching in the room, this method also
	 * searches inside containers (objects with contents), allowing commands like
	 * "wear helmet from chest" to work properly.
	 *
	 * @private
	 * @param keywords - The keywords to search for (from user input, may include number prefix like "2.helmet")
	 * @param source - Where to search: "room", "inventory", "equipment", or "all"
	 * @param context - The execution context providing room and actor
	 * @param parsedArgs - Map of already parsed arguments (for argument-based sources)
	 * @returns {Equipment | undefined} Matching equipment at specified index, or undefined if none found
	 *
	 * @example
	 * // Search for "helmet" in inventory only
	 * findEquipment("helmet", "inventory", context, parsedArgs)
	 * // Returns: <Equipment with "helmet" keywords> or undefined
	 *
	 * @example
	 * // Search for 2nd "ring" in equipment
	 * findEquipment("2.ring", "equipment", context, parsedArgs)
	 * // Returns: 2nd <Equipment> matching "ring" or undefined
	 */
	private findEquipment(
		keywords: string,
		source: "room" | "inventory" | "all" | "equipment" | string,
		context: CommandContext,
		parsedArgs: Map<string, any>
	): Equipment | undefined {
		return this.findObjectsBySource(
			keywords,
			source,
			context,
			parsedArgs,
			(obj, searchKeywords): obj is Equipment =>
				obj instanceof Equipment && obj.match(searchKeywords)
		);
	}

	/**
	 * Parse a direction string into a DIRECTION enum value.
	 *
	 * This method converts user-friendly direction names and abbreviations into
	 * the numeric DIRECTION enum values used internally by the dungeon system.
	 * The matching is case-insensitive.
	 *
	 * Supported directions:
	 * - Cardinal: north/n, south/s, east/e, west/w
	 * - Vertical: up/u, down/d
	 * - Diagonal: northeast/ne, northwest/nw, southeast/se, southwest/sw
	 *
	 * @private
	 * @param value - The direction string from user input
	 * @returns {DIRECTION | undefined} DIRECTION enum, or undefined if not recognized
	 *
	 * @example
	 * parseDirection("north") // Returns: DIRECTION.NORTH
	 * parseDirection("n")     // Returns: DIRECTION.NORTH
	 * parseDirection("ne")    // Returns: DIRECTION.NORTHEAST
	 * parseDirection("xyz")   // Returns: undefined
	 */
	private parseDirection(value: string): DIRECTION | undefined {
		const dirMap: { [key: string]: DIRECTION } = {
			north: DIRECTION.NORTH,
			n: DIRECTION.NORTH,
			south: DIRECTION.SOUTH,
			s: DIRECTION.SOUTH,
			east: DIRECTION.EAST,
			e: DIRECTION.EAST,
			west: DIRECTION.WEST,
			w: DIRECTION.WEST,
			northeast: DIRECTION.NORTHEAST,
			ne: DIRECTION.NORTHEAST,
			northwest: DIRECTION.NORTHWEST,
			nw: DIRECTION.NORTHWEST,
			southeast: DIRECTION.SOUTHEAST,
			se: DIRECTION.SOUTHEAST,
			southwest: DIRECTION.SOUTHWEST,
			sw: DIRECTION.SOUTHWEST,
			up: DIRECTION.UP,
			u: DIRECTION.UP,
			down: DIRECTION.DOWN,
			d: DIRECTION.DOWN,
		};

		return dirMap[value.toLowerCase()];
	}
}

export interface ActionQueueEntry {
	input: string;
	command: Command;
	args: Map<string, any>;
	cooldownMs: number;
	enqueuedAt: number;
}

export interface ActionState {
	queue: ActionQueueEntry[];
	cooldownTimer?: NodeJS.Timeout;
	cooldownExpiresAt?: number;
	isProcessing: boolean;
}

/**
 * Registry and executor for commands.
 *
 * CommandRegistry manages a collection of Command instances and provides
 * centralized command execution. It attempts to parse user input against
 * all registered commands in order, executing the first command that
 * successfully matches.
 *
 * Commands that declare a positive cooldown via {@link Command.getActionCooldownMs}
 * are automatically tracked with a per-actor action queue to ensure only one
 * action command is processed per cooldown window.
 *
 * This class can be instantiated to create separate command registries
 * (e.g., for skill commands, admin commands, etc.), or you can use the
 * default static instance for general commands.
 *
 * ## Usage Pattern
 *
 * ```typescript
 * // Using the default registry
 * CommandRegistry.default.register(new SayCommand());
 * CommandRegistry.default.register(new GetCommand());
 * CommandRegistry.default.register(new LookCommand());
 *
 * // Runtime: Process user input
 * const context: CommandContext = {
 *   actor: currentPlayer,
 *   room: currentRoom
 * };
 *
 * const executed = CommandRegistry.default.execute(userInput, context);
 * if (!executed) {
 *   console.log("Unknown command. Type 'help' for assistance.");
 * }
 * ```
 *
 * ## Multiple Registries
 *
 * ```typescript
 * // Create separate registries for different command types
 * const skillRegistry = new CommandRegistry();
 * const adminRegistry = new CommandRegistry();
 *
 * skillRegistry.register(new FireballCommand());
 * adminRegistry.register(new BanCommand());
 *
 * // Check skill commands first, then regular commands
 * if (!skillRegistry.execute(input, context)) {
 *   if (!CommandRegistry.default.execute(input, context)) {
 *     console.log("Unknown command.");
 *   }
 * }
 * ```
 *
 * ## Command Priority
 *
 * Commands are automatically sorted by pattern length (longest first) and tried
 * in that order. This ensures more specific commands are matched before general ones:
 *
 * ```typescript
 * // These will be automatically ordered correctly regardless of registration order
 * registry.register(new GetCommand());           // "get <item:object>"
 * registry.register(new GetFromCommand());       // "get <item:object> from <container:object>"
 * // GetFromCommand will be tried first due to longer pattern
 * ```
 *
 * ## Best Practices
 *
 * 1. Register all commands once at application startup
 * 2. Use command aliases for alternate phrasings, not separate commands
 * 3. Handle "command not found" case after execute() returns false
 * 4. Implement onError() methods for user-friendly error messages
 * 5. Use specific source modifiers (@room, @inventory) to avoid ambiguity
 *
 * @class
 */

/**
 * Command class for abilities that require the actor to know the ability.
 *
 * Ability commands are only matched if the actor knows the associated ability.
 * This prevents players from using commands for abilities they haven't learned.
 *
 * @example
 * ```typescript
 * const command = new AbilityCommand(
 *   "whirlwind",
 *   {
 *     pattern: "whirlwind",
 *     execute: (ctx, args) => {
 *       // Execute ability logic
 *     }
 *   }
 * );
 * ```
 */
export class AbilityCommand extends Command {
	readonly abilityId: string;

	constructor(
		abilityId: string,
		commandObj: {
			pattern: string;
			aliases?: string[];
			priority?: PRIORITY;
			execute: (context: CommandContext, args: Map<string, any>) => void;
			onError?: (context: CommandContext, result: ParseResult) => void;
			cooldown?:
				| number
				| ((
						context: CommandContext,
						args: Map<string, any>
				  ) => number | undefined);
		}
	) {
		super({
			pattern: commandObj.pattern,
			aliases: commandObj.aliases,
			priority: commandObj.priority,
		});
		this.abilityId = abilityId;
		this.executeFunction = commandObj.execute;
		this.errorFunction = commandObj.onError;
		if (typeof commandObj.cooldown === "function") {
			this.cooldownResolver = commandObj.cooldown;
		} else if (typeof commandObj.cooldown === "number") {
			const value = commandObj.cooldown;
			this.cooldownResolver = () => value;
		}
	}

	private executeFunction: (
		context: CommandContext,
		args: Map<string, any>
	) => void;
	private errorFunction?: (
		context: CommandContext,
		result: ParseResult
	) => void;
	private cooldownResolver?: (
		context: CommandContext,
		args: Map<string, any>
	) => number | undefined;

	execute(context: CommandContext, args: Map<string, any>): void {
		this.executeFunction(context, args);
	}

	onError(context: CommandContext, result: ParseResult): void {
		if (this.errorFunction) {
			this.errorFunction(context, result);
		} else {
			logger.error(`Command error: ${result.error}`);
		}
	}

	override getActionCooldownMs(
		context: CommandContext,
		args: Map<string, any>
	): number | undefined {
		if (!this.cooldownResolver) return undefined;
		const value = this.cooldownResolver(context, args);
		return typeof value === "number" ? value : undefined;
	}
}

export class CommandRegistry {
	/**
	 * Default global command registry instance.
	 * Use this for general commands that are always available.
	 */
	static readonly default = new CommandRegistry();

	private commands: Command[] = [];

	/**
	 * Register a command in this registry.
	 *
	 * Adds a command instance to the command registry. Once registered,
	 * the command will be considered when execute() is called with user input.
	 *
	 * Commands are automatically sorted by pattern length (longest first) to ensure
	 * more specific commands are tried before more general ones. This means you can
	 * register commands in any order without worrying about matching priority.
	 *
	 * For example, if you register:
	 * - "get <item:object@room>" (26 chars)
	 * - "get <item:object@inventory> from <container:object@room>" (58 chars)
	 *
	 * They will automatically be ordered with the longer, more specific pattern first,
	 * regardless of registration order.
	 *
	 * The same command instance can only be registered once. If you need
	 * multiple instances of a command (e.g., for different contexts), create
	 * separate instances.
	 *
	 * @param command - The Command instance to register
	 *
	 * @example
	 * ```typescript
	 * CommandRegistry.default.register(new SayCommand());
	 * CommandRegistry.default.register(new GetFromContainerCommand()); // Longer pattern
	 * CommandRegistry.default.register(new GetCommand()); // Shorter pattern
	 * // GetFromContainerCommand will be tried first automatically
	 * ```
	 */
	register(command: Command) {
		this.commands.push(command);
		// Sort by priority first (higher priority first), then by pattern length (longest first)
		this.commands.sort((a, b) => {
			if (a.priority !== b.priority) {
				return b.priority - a.priority; // Higher priority first
			}
			return b.pattern.length - a.pattern.length; // Longer pattern first
		});
	}

	/**
	 * Unregister a command from this registry.
	 *
	 * Removes a previously registered command instance from the registry.
	 * After unregistering, the command will no longer be considered for
	 * execution when execute() is called.
	 *
	 * If the command is not currently registered, this method does nothing.
	 * Uses reference equality to find the command, so you must pass the
	 * exact same instance that was registered.
	 *
	 * The remaining commands will stay in their sorted order (by pattern length).
	 *
	 * This is useful for:
	 * - Temporarily disabling commands
	 * - Context-sensitive command availability (e.g., combat vs non-combat)
	 * - Dynamic command loading/unloading
	 * - Plugin systems that add/remove commands
	 *
	 * @param command - The Command instance to unregister (must be same instance)
	 *
	 * @example
	 * ```typescript
	 * const sayCommand = new SayCommand();
	 * CommandRegistry.default.register(sayCommand);
	 * // ... later
	 * CommandRegistry.default.unregister(sayCommand); // Removes the command
	 * ```
	 */
	unregister(command: Command): void {
		const index = this.commands.indexOf(command);
		if (index !== -1) {
			this.commands.splice(index, 1);
		}
	}

	/**
	 * Execute a command string for the given context.
	 *
	 * This is the main entry point for command execution. It attempts to parse
	 * the input against all registered commands in order, and executes the first
	 * command that successfully matches.
	 *
	 * The execution process:
	 * 1. Trim whitespace from input
	 * 2. Return false immediately if input is empty
	 * 3. Try each registered command's parse() method in order (longest patterns first)
	 * 4. On successful parse, call that command's execute() method
	 * 5. On failed parse, call the command's onError() method if implemented
	 * 6. Return true if a command was matched (even if parsing failed), false if none matched
	 *
	 * The return value indicates whether a command pattern was matched, not whether
	 * the command fully succeeded. Commands handle their own success/failure messaging,
	 * and parsing errors are handled by the command's onError() method if implemented.
	 *
	 * When a command pattern matches but parsing fails (e.g., missing required argument),
	 * the command's onError() method is called to let the command provide custom error
	 * messages and usage information. If onError() is not implemented, no error message
	 * is displayed (you should implement onError() to guide users).
	 *
	 * Empty input is handled gracefully and returns false without trying
	 * any commands, allowing you to distinguish between "no input" and
	 * "invalid command".
	 *
	 * @param input - The user's input string (will be trimmed)
	 * @param context - The execution context with actor and room
	 * @returns {boolean} True if a command pattern was matched, false if no command matched
	 *
	 * @example
	 * ```typescript
	 * const executed = CommandRegistry.default.execute("say hello world", context);
	 * if (executed) {
	 *   // Command was found (executed successfully or onError was called)
	 * } else {
	 *   // No command matched
	 *   console.log("Huh? Type 'help' for a list of commands.");
	 * }
	 * ```
	 *
	 * @example
	 * Handle empty input:
	 * ```typescript
	 * const input = userInput.trim();
	 * if (!input) {
	 *   // Don't bother calling execute for empty input
	 *   return;
	 * }
	 *
	 * const executed = CommandRegistry.default.execute(input, context);
	 * // ...
	 * ```
	 */

	execute(input: string, context: CommandContext): boolean {
		input = input.trim();
		if (!input) return false;

		// Commands are already sorted by priority and pattern length
		for (const command of this.commands) {
			// Skip ability commands if the actor doesn't know the ability
			if (command instanceof AbilityCommand) {
				if (!context.actor.knowsAbilityById(command.abilityId)) {
					continue;
				}
			}
			const result = command.parse(input, context);
			if (result.success) {
				const cooldownMs =
					command.getActionCooldownMs(context, result.args) ?? 0;
				if (cooldownMs > 0) {
					this.handleActionCommand(
						input,
						command,
						context,
						result.args,
						cooldownMs
					);
				} else {
					command.execute(context, result.args);
				}
				return true;
			}
			// If pattern matched but parsing failed, call onError if implemented
			if (
				result.error &&
				result.error !== "Input does not match pattern" &&
				result.error !== "Input does not match command pattern"
			) {
				if (command.onError) {
					command.onError(context, result);
				}
				return true;
			}
		}

		return false;
	}

	private handleActionCommand(
		input: string,
		command: Command,
		context: CommandContext,
		args: Map<string, any>,
		cooldownMs: number
	): void {
		const actor = context.actor;
		const character = actor.character;

		if (!character) {
			command.execute(context, args);
			return;
		}

		const state = this.getActionState(character);
		const wasQueued =
			state.queue.length > 0 || state.isProcessing || !!state.cooldownTimer;

		const entry: ActionQueueEntry = {
			input,
			command,
			args: new Map(args),
			cooldownMs,
			enqueuedAt: Date.now(),
		};

		state.queue.push(entry);
		this.tryProcessActionQueue(actor, character, state, context);

		if (wasQueued) {
			this.notifyQueued(actor, state);
		}
	}

	private getActionState(character: Character): ActionState {
		if (!character.actionState) {
			character.actionState = {
				queue: [],
				isProcessing: false,
			};
		}
		return character.actionState;
	}

	private tryProcessActionQueue(
		actor: Mob,
		character: Character,
		state: ActionState,
		contextOverride?: CommandContext
	): void {
		if (state.isProcessing || state.cooldownTimer) {
			return;
		}

		const nextEntry = state.queue.shift();
		if (!nextEntry) {
			return;
		}

		state.isProcessing = true;
		const executionContext =
			contextOverride ?? this.buildContextFromActor(actor);

		try {
			nextEntry.command.execute(executionContext, nextEntry.args);
		} catch (error) {
			logger.error(
				`Failed to execute action command "${nextEntry.command.pattern}" for ${actor.display}: ${error}`
			);
		} finally {
			state.isProcessing = false;
		}

		this.beginCooldown(actor, character, state, nextEntry.cooldownMs);

		if (!contextOverride) {
			character.showPrompt();
		}
	}

	private beginCooldown(
		actor: Mob,
		character: Character,
		state: ActionState,
		cooldownMs: number
	): void {
		if (state.cooldownTimer) {
			clearTimeout(state.cooldownTimer);
			state.cooldownTimer = undefined;
		}

		if (cooldownMs <= 0) {
			this.tryProcessActionQueue(actor, character, state);
			return;
		}

		state.cooldownExpiresAt = Date.now() + cooldownMs;
		state.cooldownTimer = setTimeout(() => {
			state.cooldownTimer = undefined;
			state.cooldownExpiresAt = undefined;
			this.tryProcessActionQueue(actor, character, state);
		}, cooldownMs);
	}

	private notifyQueued(actor: Mob, state: ActionState): void {
		const position = state.queue.length;
		if (position <= 0) return;

		const remainingMs =
			state.cooldownExpiresAt !== undefined
				? Math.max(0, state.cooldownExpiresAt - Date.now())
				: undefined;
		const timeFragment =
			remainingMs && remainingMs > 0
				? ` (~${Math.ceil(remainingMs / 1000)}s)`
				: "";

		actor.sendMessage(`Action queued...`, MESSAGE_GROUP.COMMAND_RESPONSE);
	}

	private buildContextFromActor(actor: Mob): CommandContext {
		return {
			actor,
			room:
				actor.location instanceof Room ? (actor.location as Room) : undefined,
		};
	}

	/**
	 * Get all registered commands.
	 *
	 * Returns a shallow copy of the internal commands array. The returned
	 * array can be modified without affecting the registry, but the Command
	 * instances themselves are the same references.
	 *
	 * This is useful for:
	 * - Debugging and introspection
	 * - Building dynamic help systems
	 * - Displaying available commands to users
	 * - Testing and validation
	 *
	 * The commands are returned in their sorted order (longest patterns first),
	 * which is also the order they'll be tried during execution.
	 *
	 * @returns {Command[]} A copy of the commands array
	 *
	 * @example
	 * ```typescript
	 * // Display all available commands
	 * const commands = CommandRegistry.default.getCommands();
	 * console.log("Available commands:");
	 * for (const command of commands) {
	 *   console.log(`  ${command.pattern}`);
	 *   if (command.aliases) {
	 *     console.log(`    Aliases: ${command.aliases.join(", ")}`);
	 *   }
	 * }
	 * ```
	 *
	 * @example
	 * Check if a specific command is registered:
	 * ```typescript
	 * const hasSayCommand = CommandRegistry.default.getCommands()
	 *   .some(cmd => cmd instanceof SayCommand);
	 * ```
	 */
	getCommands(): Command[] {
		return [...this.commands];
	}
}
