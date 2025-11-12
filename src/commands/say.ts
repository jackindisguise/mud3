/**
 * Say command for in-character speech.
 *
 * Sends a message to all mobs in the same room as the actor. Used for in-character
 * dialogue and communication with other players/NPCs in the immediate vicinity.
 *
 * @example
 * ```
 * say Hello, traveler!
 * s How are you doing today? // (autocomplete to "say")
 * 'This is a shortcut for say
 * ```
 *
 * **Aliases:** `'`
 * **Pattern:** `say~ <message:text>`
 * @module commands/say
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Mob } from "../mob.js";
import { CommandObject } from "../package/commands.js";
import { CHANNEL } from "../channel.js";

export default {
	pattern: "say~ <message:text>",
	aliases: ["'<message:text>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const message = args.get("message") as string;
		const { actor, room } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can use the say channel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if the character is in the SAY channel
		if (!character.isInChannel(CHANNEL.SAY)) {
			actor.sendMessage(
				"You are not subscribed to the SAY channel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Send to all mobs in the same room that are subscribed to SAY
		for (const mob of [actor, ...(room?.contents || [])]) {
			if (!(mob instanceof Mob)) continue;
			if (!mob.character) continue;
			mob.character.sendChat(character, message, CHANNEL.SAY);
		}
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: message") {
			context.actor.sendMessage(
				"What do you want to say?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
