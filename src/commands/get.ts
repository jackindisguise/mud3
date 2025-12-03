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
 * ```
 *
 * **Patterns:**
 * - `get <item:item@room>` - Get item from room
 * - `get <item:item@container> from <container:object>` - Get item from container
 * @module commands/get
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item, DungeonObject, Currency } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { act } from "../act.js";
import { formatNumber } from "../utils/number.js";

function getItemFromRoom(
	item: Item | undefined,
	actor: any,
	room: any
): boolean {
	if (!item) {
		actor.sendMessage(
			"You don't see that here.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Ensure it's actually an Item (not a Prop or other DungeonObject)
	if (!(item instanceof Item)) {
		const displayName = (item as any)?.display || "that";
		actor.sendMessage(
			`You cannot pick up ${displayName}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if actor is in a room
	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return false;
	}

	// Check if item is actually in the room
	if (item.location !== room) {
		actor.sendMessage(
			`${item.display} is not here.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Handle Currency items specially - add value to mob and remove the item
	if (item instanceof Currency) {
		actor.value += item.value;
		item.location = undefined; // Remove from room
		act(
			{
				user: `You pick up ${item.display}.`,
				room: `{User} picks up ${item.display}.`,
			},
			{
				user: actor,
				room: room,
			}
		);
		actor.sendMessage(`You gain ${formatNumber(item.value)} gold.`, MESSAGE_GROUP.ACTION);
		return true;
	}

	// Move item to actor's inventory
	actor.add(item);

	act(
		{
			user: `You pick up ${item.display}.`,
			room: `{User} picks up ${item.display}.`,
		},
		{
			user: actor,
			room: room,
		},
		{ messageGroup: MESSAGE_GROUP.ACTION }
	);
	return true;
}

function getItemFromContainer(
	item: Item | undefined,
	container: DungeonObject | undefined,
	actor: any,
	room: any
): boolean {
	if (!container) {
		actor.sendMessage(
			"You don't see that container here.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	if (!item) {
		actor.sendMessage(
			`You don't see that in ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Ensure it's actually an Item
	if (!(item instanceof Item)) {
		const displayName = (item as any)?.display || "that";
		actor.sendMessage(
			`You cannot pick up ${displayName}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if actor is in a room
	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return false;
	}

	// Check if container is an Item and has isContainer flag
	if (container instanceof Item && !container.isContainer) {
		actor.sendMessage(
			`${container.display} is not a container.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if container is accessible (in room or in actor's inventory)
	const containerLocation = container.location;
	if (containerLocation !== room && containerLocation !== actor) {
		actor.sendMessage(
			`You don't have access to ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if item is actually in the container
	if (item.location !== container) {
		actor.sendMessage(
			`${item.display} is not in ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Handle Currency items specially - add value to mob and remove the item
	if (item instanceof Currency) {
		actor.value += item.value;
		item.location = undefined; // Remove from container
		act(
			{
				user: `You get ${item.display} from ${container.display}.`,
				room: `{User} gets ${item.display} from ${container.display}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
		actor.sendMessage(`You gain ${formatNumber(item.value)} gold.`, MESSAGE_GROUP.ACTION);
		return true;
	}

	// Move item to actor's inventory
	actor.add(item);

	act(
		{
			user: `You get ${item.display} from ${container.display}.`,
			room: `{User} gets ${item.display} from ${container.display}.`,
		},
		{
			user: actor,
			room: room,
		},
		{ messageGroup: MESSAGE_GROUP.ACTION }
	);
	return true;
}

export default {
	pattern: "get~ <item:item@room>",
	aliases: ["get~ <item:item@container> from <container:object>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const item = args.get("item") as Item | undefined;
		const container = args.get("container") as DungeonObject | undefined;
		const { actor, room } = context;

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
