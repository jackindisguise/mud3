/**
 * Registry: command - centralized command registry
 *
 * Provides a centralized registry and executor for game commands.
 * Manages command registration, execution, and action queuing with cooldowns.
 *
 * @module registry/command
 */

import {
	Command,
	CommandContext,
	AbilityCommand,
	ActionQueueEntry,
	ActionState,
} from "../core/command.js";
import { Character } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { MESSAGE_GROUP } from "../core/character.js";
import logger from "../utils/logger.js";

/** Registered commands */
const commands: Command[] = [];

/**
 * Register a command in the registry.
 *
 * Adds a command instance to the command registry. Once registered,
 * the command will be considered when executeCommand() is called with user input.
 *
 * Commands are automatically sorted by priority first (higher priority first),
 * then by pattern length (longest first) to ensure more specific commands are
 * tried before more general ones.
 *
 * @param command - The Command instance to register
 *
 * @example
 * ```typescript
 * registerCommand(new SayCommand());
 * registerCommand(new GetFromContainerCommand()); // Longer pattern
 * registerCommand(new GetCommand()); // Shorter pattern
 * // GetFromContainerCommand will be tried first automatically
 * ```
 */
export function registerCommand(command: Command): void {
	commands.push(command);
	// Sort by priority first (higher priority first), then by pattern length (longest first)
	commands.sort((a, b) => {
		if (a.priority !== b.priority) {
			return b.priority - a.priority; // Higher priority first
		}
		return b.pattern.length - a.pattern.length; // Longer pattern first
	});
}

/**
 * Unregister a command from the registry.
 *
 * Removes a previously registered command instance from the registry.
 * After unregistering, the command will no longer be considered for
 * execution when executeCommand() is called.
 *
 * If the command is not currently registered, this function does nothing.
 * Uses reference equality to find the command, so you must pass the
 * exact same instance that was registered.
 *
 * @param command - The Command instance to unregister (must be same instance)
 *
 * @example
 * ```typescript
 * const sayCommand = new SayCommand();
 * registerCommand(sayCommand);
 * // ... later
 * unregisterCommand(sayCommand); // Removes the command
 * ```
 */
export function unregisterCommand(command: Command): void {
	const index = commands.indexOf(command);
	if (index !== -1) {
		commands.splice(index, 1);
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
 * 3. Try each registered command's parse() method in order (sorted by priority and pattern length)
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
 * const executed = executeCommand("say hello world", context);
 * if (executed) {
 *   // Command was found (executed successfully or onError was called)
 * } else {
 *   // No command matched
 *   console.log("Huh? Type 'help' for a list of commands.");
 * }
 * ```
 */
export function executeCommand(
	input: string,
	context: CommandContext
): boolean {
	input = input.trim();
	if (!input) return false;

	const actor = context.actor;
	const character = actor.character;

	// Commands are already sorted by priority and pattern length
	for (const command of commands) {
		// Skip admin-only commands for non-admin characters
		if (command.adminOnly) {
			if (!character || !character.isAdmin()) {
				continue;
			}
		}

		// Skip ability commands if the actor doesn't know the ability
		if (command instanceof AbilityCommand) {
			if (!actor.knowsAbilityById(command.abilityId)) {
				continue;
			}
		}

		const result = command.parse(input, context);
		if (result.success) {
			// Check if there's an active cooldown - if so, queue commands with cooldowns
			if (character && command.canCooldown()) {
				const state = getActionState(character);
				if (
					state.cooldownTimer ||
					state.isProcessing ||
					state.queue.length > 0
				) {
					// There's an active cooldown or queue, queue this command immediately
					// Don't check if it will succeed - just queue it
					const entry: ActionQueueEntry = {
						input,
						command,
						enqueuedAt: Date.now(),
					};
					state.queue.push(entry);
					notifyQueued(actor, state);
					return true;
				}
			}

			// No active cooldown, or command has no cooldown - execute normally
			if (command.canCooldown()) {
				const cooldownMs =
					command.getActionCooldownMs(context, result.args) ?? 0;
				handleActionCommand(input, command, context, result.args, cooldownMs);
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
			// Check if command has a meaningful error handler
			if (command.onError) {
				command.onError(context, result);
				return true;
			}
			// If onError is not implemented, continue searching other commands
			continue;
		}
	}

	return false;
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
 * The commands are returned in their sorted order (priority and pattern length),
 * which is also the order they'll be tried during execution.
 *
 * @returns {Command[]} A copy of the commands array
 *
 * @example
 * ```typescript
 * // Display all available commands
 * const allCommands = getCommands();
 * console.log("Available commands:");
 * for (const command of allCommands) {
 *   console.log(`  ${command.pattern}`);
 *   if (command.aliases) {
 *     console.log(`    Aliases: ${command.aliases.join(", ")}`);
 *   }
 * }
 * ```
 */
export function getCommands(): Command[] {
	return [...commands];
}

// Private helper functions for action queue management

function handleActionCommand(
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

	const state = getActionState(character);
	const wasQueued =
		state.queue.length > 0 || state.isProcessing || !!state.cooldownTimer;

	const entry: ActionQueueEntry = {
		input,
		command,
		enqueuedAt: Date.now(),
	};

	state.queue.push(entry);
	tryProcessActionQueue(actor, character, state, context);

	if (wasQueued) {
		notifyQueued(actor, state);
	}
}

function getActionState(character: Character): ActionState {
	if (!character.actionState) {
		character.actionState = {
			queue: [],
			isProcessing: false,
		};
	}
	return character.actionState;
}

function tryProcessActionQueue(
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
	const executionContext = contextOverride ?? buildContextFromActor(actor);

	// Re-parse the input to get fresh args and re-evaluate cooldown
	// This ensures the cooldown reflects the current game state
	const parseResult = nextEntry.command.parse(
		nextEntry.input,
		executionContext
	);

	let cooldownMs = 0;
	if (parseResult.success) {
		// Re-evaluate cooldown with current context and fresh args
		cooldownMs =
			nextEntry.command.getActionCooldownMs(
				executionContext,
				parseResult.args
			) ?? 0;

		try {
			nextEntry.command.execute(executionContext, parseResult.args);
		} catch (error) {
			logger.error(
				`Failed to execute action command "${nextEntry.command.pattern}" for ${actor.display}: ${error}`
			);
			// If execution fails, don't apply cooldown
			cooldownMs = 0;
		}
	} else {
		// If parsing fails (e.g., target no longer exists), call onError if available
		if (nextEntry.command.onError) {
			nextEntry.command.onError(executionContext, parseResult);
		}
		// Don't apply cooldown if command can't be parsed/executed
		cooldownMs = 0;
	}

	state.isProcessing = false;
	beginCooldown(actor, character, state, cooldownMs == 0 ? 100 : cooldownMs);

	if (!contextOverride) {
		character.showPrompt();
	}
}

function beginCooldown(
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
		tryProcessActionQueue(actor, character, state);
		return;
	}

	state.cooldownExpiresAt = Date.now() + cooldownMs;
	state.cooldownTimer = setTimeout(() => {
		state.cooldownTimer = undefined;
		state.cooldownExpiresAt = undefined;
		tryProcessActionQueue(actor, character, state);
	}, cooldownMs);
}

function notifyQueued(actor: Mob, state: ActionState): void {
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

function buildContextFromActor(actor: Mob): CommandContext {
	return {
		actor,
		room: actor.location instanceof Room ? (actor.location as Room) : undefined,
	};
}
