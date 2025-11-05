/**
 * Out-of-character (OOC) chat command.
 *
 * Broadcasts a message to all connected players in the game, prefixed with "OOC:".
 * Used for meta-game communication that isn't part of the in-character roleplay.
 *
 * @example
 * ```
 * ooc Hello everyone!
 * o Testing the OOC channel (autocomplete)
 * oo Also works! (autocomplete)
 * " Quick OOC message
 * ```
 *
 * **Aliases:** `"`
 *
 * **Pattern:** `ooc~ <message:text>` (supports autocomplete: o, oo, ooc)
 * @module commands/ooc
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Mob } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Game } from "../game.js";

export default {
	pattern: "ooc~ <message:text>",
	aliases: ['" <message:text>'],

	execute(context: CommandContext, args: Map<string, any>): void {
		const message = args.get("message") as string;
		const { actor } = context;

		actor.sendMessage(`You OOC: "${message}"`, MESSAGE_GROUP.CHANNELS);
		Game.game!.forEachCharacter((character) => {
			character.sendMessage(
				`${actor} OOC: "${message}"`,
				MESSAGE_GROUP.CHANNELS
			);
		});
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: message") {
			context.actor.sendLine("What do you want to OOC?");
			return;
		}
	},
} satisfies CommandObject;
