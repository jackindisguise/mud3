/**
 * Shared social command execution logic.
 *
 * This module provides a centralized function for handling social commands
 * to reduce code duplication across social command files.
 *
 * Social commands are simple actions that display messages in a room,
 * optionally targeting another mob.
 *
 * @module commands/_social
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob } from "../core/dungeon.js";
import { act, ActMessageTemplates } from "../act.js";

/**
 * Options for creating a social command.
 */
export interface SocialCommandOptions {
	/** Message templates for the social action */
	messages: {
		/** Message when performed alone (no target) */
		alone: ActMessageTemplates;
		/** Message when performed with a target */
		withTarget: ActMessageTemplates;
	};
}

/**
 * Executes a social command with optional target validation.
 *
 * @param context The command context containing actor and room
 * @param target Optional target mob
 * @param options Social command options with message templates
 */
export function executeSocial(
	context: CommandContext,
	target: Mob | undefined,
	options: SocialCommandOptions
): void {
	const { actor, room } = context;

	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return;
	}

	// If target is specified, validate it
	if (target) {
		// Check if target is in the same room
		if (target.location !== room) {
			actor.sendMessage(
				`${target.display} is not here.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Can't target yourself
		if (target === actor) {
			actor.sendMessage(
				"You cannot do that to yourself.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Perform action with target
		act(options.messages.withTarget, {
			user: actor,
			target: target,
			room: room,
		});
	} else {
		// Perform action alone
		act(options.messages.alone, {
			user: actor,
			room: room,
		});
	}
}

/**
 * Default error handler for social commands.
 *
 * @param context The command context
 * @param result The parse result
 */
export function onSocialError(
	context: CommandContext,
	result: ParseResult
): void {
	// No specific error handling needed - target is optional
}

/**
 * Formats a social message template by replacing placeholders.
 *
 * @param template The message template with placeholders
 * @param userDisplay The display name of the user
 * @param targetDisplay The display name of the target (if any)
 * @returns The formatted message
 */
export function formatSocialMessage(
	template: string,
	userDisplay: string,
	targetDisplay?: string
): string {
	const userCap = userDisplay.charAt(0).toUpperCase() + userDisplay.slice(1);
	const targetCap = targetDisplay
		? targetDisplay.charAt(0).toUpperCase() + targetDisplay.slice(1)
		: "";

	return template
		.replace(/\{user\}/g, userDisplay)
		.replace(/\{target\}/g, targetDisplay || "")
		.replace(/\{User\}/g, userCap)
		.replace(/\{Target\}/g, targetCap);
}
