/**
 * Get command for picking up items.
 *
 * Picks up an Item (including Equipment) from the room or from a container and adds it to the actor's inventory.
 * Only Item objects can be picked up (not Props or other DungeonObjects).
 *
 * @example
 * ```
 * get sword
 * get "gold coin"
 * get potion
 * get coin from bag
 * get sword from chest
 * get helmet
 * get all
 * get all from bag
 * ```
 *
 * **Patterns:**
 * - `get all` - Get all items from room
 * - `get all from <container>` - Get all items from container
 * - `get <item:item@room>` - Get item from room
 * - `get <item:item@container> from <container:object>` - Get item from container
 * @module commands/get
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item, DungeonObject } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import {
	getItemFromRoom,
	getItemFromContainer,
	getAllFromRoom,
	getAllFromContainer,
} from "../utils/get.js";

export const command = {
	pattern: "get~ all from <container:object>",
	aliases: [
		"get~ all",
		"get~ <item:item@container> from <container:object>",
		"get~ <item:item@room>",
	],
	execute(context: CommandContext, args: Map<string, any>): void {
		const item = args.get("item") as Item | undefined;
		const container = args.get("container") as DungeonObject | undefined;
		const { actor, room } = context;

		// Handle "get all"
		if (item === undefined && container === undefined) {
			getAllFromRoom(actor, room);
			return;
		}

		// Handle "get all from container"
		if (item === undefined && container !== undefined) {
			getAllFromContainer(container, actor, room);
			return;
		}

		// If container is specified, get from container
		if (container !== undefined) {
			getItemFromContainer(item, container, actor, room);
			return;
		}

		// Otherwise, get from room
		getItemFromRoom(item, actor, room);
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
				"What do you want to get?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
