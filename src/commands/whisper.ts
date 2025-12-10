/**
 * Whisper command for sending private messages.
 *
 * Sends a private message to a specific player. The message is only visible
 * to the sender and recipient. This updates the recipient's lastWhisperFrom
 * field so they can use the reply command.
 *
 * @example
 * ```
 * whisper Alice Hello there!
 * w Bob How are you?     // (autocomplete to "whisper")
 * tell Carol See you soon // (autocomplete to "whisper")
 * ```
 *
 * **Aliases:** `tell`, `w`
 * **Pattern:** `whisper~ <target:word> <message:text>`
 * @module commands/whisper
 */

import { CommandContext, ParseResult, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP, Character } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { CHANNEL } from "../core/channel.js";

export const command = {
	pattern: "whisper~ <target:character> <message:text>",
	aliases: ["tell~ <target:character> <message:text>"],
	priority: PRIORITY.LOW,
	execute(context: CommandContext, args: Map<string, any>): void {
		const target = args.get("target") as Character | undefined;
		const message = args.get("message") as string;
		const { actor } = context;
		const character = actor.character;

		// only characters can whisper (for now)
		if (!character) {
			actor.sendMessage(
				"Only players can use whisper.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if the character is in the WHISPER channel
		if (character && !character.isInChannel(CHANNEL.WHISPER)) {
			actor.sendMessage(
				"You are not subscribed to the WHISPER channel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (!target) {
			actor.sendMessage(
				"That player is not online.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Can't whisper to yourself
		if (target === character) {
			actor.sendMessage(
				"You can't whisper to yourself.",
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

		// If target is an NPC mob, emit whisper event
		if (target.mob) {
			const targetEmitter = target.mob.aiEvents;
			if (targetEmitter) {
				targetEmitter.emit("whisper", actor, message);
			}
		}

		// Send confirmation to sender
		character.sendChat(
			character,
			`(to ${target.credentials.username}) ${message}`,
			CHANNEL.WHISPER
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: target") {
			context.actor.sendMessage(
				"Who do you want to whisper to?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (result.error === "Could not parse argument: target") {
			context.actor.sendMessage(
				"That player is not online.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (result.error === "Missing required argument: message") {
			context.actor.sendMessage(
				"What do you want to whisper?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
