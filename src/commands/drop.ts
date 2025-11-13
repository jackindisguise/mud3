/**
 * Drop command for dropping items.
 *
 * Drops an Item (including Equipment) from the actor's inventory into the current room.
 * Only Item objects can be dropped (not Props or other DungeonObjects).
 *
 * @example
 * ```
 * drop sword
 * drop "gold coin"
 * drop potion
 * drop helmet
 * ```
 *
 * **Pattern:** `drop <item:item@inventory>`
 * @module commands/drop
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Item } from "../dungeon.js";
import { Equipment } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";

export default {
	pattern: "drop~ <item:item@inventory>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const item = args.get("item") as Item;
		const { actor, room } = context;

		// Check if actor is in a room
		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if item is actually in actor's inventory
		if (item.location !== actor) {
			actor.sendMessage(
				`You don't have ${item.display}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if item is equipped (cannot drop equipped items)
		if (item instanceof Equipment) {
			const equippedItems = actor.getAllEquipped();
			if (equippedItems.includes(item)) {
				actor.sendMessage(
					`You cannot drop ${item.display} while it's equipped.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
		}

		// Move item to room
		room.add(item);

		actor.sendMessage(
			`You drop ${item.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("Could not parse argument")) {
			context.actor.sendMessage(
				"You don't have that.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		if (result.error?.includes("Missing required argument")) {
			context.actor.sendMessage(
				"What do you want to drop?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
