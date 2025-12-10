/**
 * Reply command for responding to whispers.
 *
 * Sends a whisper to the last person who whispered to you. This is a
 * convenience command that eliminates the need to remember or type the
 * username of the person you want to reply to.
 *
 * @example
 * ```
 * reply Thanks for the message!
 * r No problem!     // (autocomplete to "reply")
 * ```
 *
 * **Aliases:** `r`
 * **Pattern:** `reply~ <message:text>`
 * @module commands/reply
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP, Character } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { CHANNEL } from "../core/channel.js";
import { getCharacterById } from "../package/character.js";

export const command = {
	pattern: "reply~ <message:text>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const message = args.get("message") as string;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can use reply.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if the character is in the WHISPER channel
		if (!character.isInChannel(CHANNEL.WHISPER)) {
			actor.sendMessage(
				"You are not subscribed to the WHISPER channel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if there's someone to reply to
		if (!character.lastWhisperFromId) {
			actor.sendMessage(
				"No one has whispered to you yet.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Find the target character by ID
		const target = getCharacterById(character.lastWhisperFromId);

		if (!target) {
			actor.sendMessage(
				"That player is no longer online.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if target is subscribed to WHISPER
		if (!target.isInChannel(CHANNEL.WHISPER)) {
			actor.sendMessage(
				`${target.credentials.username} is not accepting whispers.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if target is blocking the sender
		if (target.isBlocking(character.credentials.username)) {
			actor.sendMessage(
				`${target.credentials.username} is not accepting whispers.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Send the whisper to the target
		target.sendChat(character, message, CHANNEL.WHISPER);

		// Send confirmation to sender
		character.sendChat(
			character,
			`(to ${target.credentials.username}) ${message}`,
			CHANNEL.WHISPER
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: message") {
			context.actor.sendMessage(
				"What do you want to reply?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
