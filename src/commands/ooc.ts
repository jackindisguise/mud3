/**
 * Out-of-character (OOC) chat command.
 *
 * Broadcasts a message to all connected players in the game, prefixed with "OOC:".
 * Used for meta-game communication that isn't part of the in-character roleplay.
 *
 * @example
 * ```
 * ooc Hello everyone!
 * o Testing the OOC channel // (autocomplete to "ooc")
 * oo Also works! // (autocomplete to "ooc")
 * "Quick OOC message
 * ```
 *
 * **Aliases:** `"`
 * **Pattern:** `ooc~ <message:text>`
 * @module commands/ooc
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Mob } from "../mob.js";
import { CommandObject } from "../package/commands.js";
import { Game } from "../game.js";
import { CHANNEL, formatChannelMessage } from "../channel.js";

export default {
	pattern: "ooc~ <message:text>",
	aliases: ['"<message:text>'],
	/**
	 * Execute the OOC command.
	 */
	execute(context: CommandContext, args: Map<string, any>): void {
		const message = args.get("message") as string;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can use channels.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if the character is in the OOC channel
		if (!character.isInChannel(CHANNEL.OOC)) {
			actor.sendMessage(
				"You are not subscribed to the OOC channel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Send to all characters in the OOC channel
		Game.game!.forEachCharacter((recipient) => {
			recipient.sendChat(character, message, CHANNEL.OOC);
		});
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: message") {
			context.actor.sendMessage(
				"What do you want to OOC?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
