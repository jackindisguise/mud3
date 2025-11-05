/**
 * Say command for in-character speech.
 *
 * Sends a message to all mobs in the same room as the actor. Used for in-character
 * dialogue and communication with other players/NPCs in the immediate vicinity.
 *
 * @example
 * ```
 * say Hello, traveler!
 * s How are you doing today? (autocomplete to "say")
 * ' This is a shortcut for say
 * ```
 *
 * **Aliases:** `'`
 *
 * **Pattern:** `say~ <message:text>`
 * @module commands/say
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Mob } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";

export default {
	pattern: "this~is~a~stupid~command~<message:text>",

	execute(context: CommandContext, args: Map<string, any>): void {
		const message = args.get("message") as string;
		const { actor, room } = context;

		actor.sendMessage(`You say: "${message}"`, MESSAGE_GROUP.CHANNELS);

		if (room) {
			for (const mob of room.contents) {
				if (mob instanceof Mob && mob !== actor) {
					mob.sendMessage(
						`${actor} says, "${message}"`,
						MESSAGE_GROUP.CHANNELS
					);
				}
			}
		}
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: message") {
			context.actor.sendLine("What do you want to say?");
			return;
		}
	},
} satisfies CommandObject;
