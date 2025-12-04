/**
 * Sacrifice command for destroying items on the ground.
 *
 * Sacrifices an Item on the ground, destroying it and giving the actor 25% of its value as gold.
 * Only Item objects can be sacrificed (not Props or other DungeonObjects).
 *
 * @example
 * ```
 * sacrifice sword
 * sacrifice "gold coin"
 * sacrifice potion
 * ```
 *
 * **Pattern:** `sacrifice~ <item:item@room>`
 * @module commands/sacrifice
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { sacrificeItem } from "../utils/sacrifice.js";

export default {
	pattern: "sacrifice~ <item:item@room>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;
		const item = args.get("item") as Item | undefined;

		sacrificeItem(item, actor, room);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("Could not parse argument")) {
			context.actor.sendMessage(
				"You don't see that here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		if (result.error?.includes("Missing required argument")) {
			context.actor.sendMessage(
				"What do you want to sacrifice?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;

