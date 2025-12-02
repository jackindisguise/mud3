/**
 * Gocial (global social) command for performing social actions on a global channel.
 *
 * Allows players to perform social emotes that are broadcast to all players
 * subscribed to the GOCIAL channel, optionally targeting another player by username.
 *
 * @example
 * ```
 * gocial laugh
 * gocial dance bob
 * gocial poke alice
 * ```
 *
 * **Pattern:** `gocial~ <emote:word> <target:character?>`
 * @module commands/gocial
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { Character, MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { forEachCharacter } from "../game.js";
import { CHANNEL, formatChannelMessage } from "../core/channel.js";
import { getSocialCommand, getSocialCommandNames } from "../social.js";
import { formatSocialMessage } from "./_social.js";

export default {
	pattern: "gocial~ <emote:word> <target:character?>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const emoteName = (args.get("emote") as string).toLowerCase();
		const target = args.get("target") as Character | undefined;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can use gocial.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if the character is in the GOCIAL channel
		if (!character.isInChannel(CHANNEL.GOCIAL)) {
			actor.sendMessage(
				"You are not subscribed to the GOCIAL channel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Get the social command definition
		const socialDef = getSocialCommand(emoteName);
		if (!socialDef) {
			const available = getSocialCommandNames().join(", ");
			actor.sendMessage(
				`Unknown emote "${emoteName}". Available emotes: ${available}`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Find target character if specified
		if (target) {
			// Can't target yourself
			if (target === character) {
				actor.sendMessage(
					"You cannot do that to yourself.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
		}

		// Select appropriate message template
		const messages = target
			? socialDef.messages.withTarget
			: socialDef.messages.alone;

		const userDisplay = character.credentials.username;
		const targetDisplay = target?.credentials.username;

		// Format messages
		const userMessage = messages.user
			? formatSocialMessage(messages.user, userDisplay, targetDisplay)
			: messages.room
			? formatSocialMessage(messages.room, userDisplay, targetDisplay)
			: undefined;
		const roomMessage = messages.room
			? formatSocialMessage(messages.room, userDisplay, targetDisplay)
			: undefined;
		const targetMessage =
			target && messages.target
				? formatSocialMessage(messages.target, userDisplay, targetDisplay)
				: undefined;

		forEachCharacter((recipient) => {
			if (!recipient.isInChannel(CHANNEL.GOCIAL)) return;

			// Check if recipient is blocking the speaker
			if (recipient.isBlocking(character.credentials.username)) {
				return;
			}

			// Determine which message to send
			let messageToSend: string | undefined;
			if (recipient === character && userMessage) {
				messageToSend = userMessage;
			} else if (
				target &&
				recipient === target &&
				(targetMessage || roomMessage)
			) {
				messageToSend = (targetMessage || roomMessage)!;
			} else if (roomMessage) {
				messageToSend = roomMessage;
			}

			// Format as channel message and send
			if (messageToSend) {
				const formatted = formatChannelMessage(
					CHANNEL.GOCIAL,
					userDisplay,
					messageToSend
				);
				recipient.sendMessage(formatted, MESSAGE_GROUP.CHANNELS);
			}
		});
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("Missing required argument: emote")) {
			const available = getSocialCommandNames().join(", ");
			context.actor.sendMessage(
				`What emote do you want to perform? Available: ${available}`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
