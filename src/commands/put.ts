/**
 * Put command for placing items into containers.
 *
 * Moves an Item from the actor's inventory into a container. The container can be
 * in the actor's inventory or in the room.
 *
 * @example
 * ```
 * put sword in bag
 * put potion in chest
 * put coin in backpack
 * put all in bag
 * ```
 *
 * **Patterns:**
 * - `put all in <container>` - Put all items from inventory into container
 * - `put~ <item:item@inventory> in <container:object@all>` - Put item in container
 * @module commands/put
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item, DungeonObject, Equipment, Currency } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { act } from "../act.js";
import { createGold } from "../utils/currency.js";
import { capitalizeFirst } from "../utils/string.js";

function putAllInContainer(
	container: DungeonObject,
	actor: any,
	room: any
): void {
	// Check if actor is in a room
	if (!room) {
		actor.sendMessage(
			"You are not in a room.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Check if container is specified
	if (!container) {
		actor.sendMessage(
			"You don't see that container here or in your inventory.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Check if container is an Item and has isContainer flag
	if (container instanceof Item && !container.isContainer) {
		actor.sendMessage(
			`${capitalizeFirst(container.display)} is not a container.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Check if container is accessible (in room or in actor's inventory)
	const containerLocation = container.location;
	if (containerLocation !== room && containerLocation !== actor) {
		actor.sendMessage(
			`You don't have access to ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Get all items from inventory (exclude equipped items and the container itself)
	// Create a copy of the array since we'll be modifying actor.contents during iteration
	const inventoryItems = [...actor.contents].filter(
		(obj: any) =>
			obj instanceof Item &&
			!(obj instanceof Equipment && actor.getAllEquipped().includes(obj)) &&
			obj !== container
	) as Item[];

	if (inventoryItems.length === 0) {
		actor.sendMessage("You don't have anything to put in it.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return;
	}

	// Put all items in container
	let successCount = 0;
	const failedItems: string[] = [];

	for (const invItem of inventoryItems) {
		// Prevent putting container into itself
		if (invItem === container) {
			failedItems.push(invItem.display);
			continue;
		}

		// Prevent putting container into something inside it (circular reference check)
		let current: DungeonObject | undefined = container;
		let circular = false;
		while (current) {
			if (current === invItem) {
				circular = true;
				break;
			}
			current = current.location;
		}
		if (circular) {
			failedItems.push(invItem.display);
			continue;
		}

		// Move item to container
		container.add(invItem);
		successCount++;
	}

	if (successCount > 0) {
		act(
			{
				user: `You put ${successCount} item${successCount !== 1 ? "s" : ""} in ${container.display}.`,
				room: `{User} puts ${successCount} item${successCount !== 1 ? "s" : ""} in ${container.display}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
	}

	if (failedItems.length > 0) {
		actor.sendMessage(
			`Could not put: ${failedItems.join(", ")}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	}
}

export default {
	pattern: "put~ all in <container:object@all>",
	aliases: [
		"put~ <amount:number> gold in <container:object@all>",
		"put~ <item:item@inventory> in <container:object@all>",
	],
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;
		const item = args.get("item") as Item | undefined;
		const amount = args.get("amount") as number | undefined;
		const container = args.get("container") as DungeonObject | undefined;

		// Handle "put all in container"
		if (item === undefined && amount === undefined && container !== undefined) {
			putAllInContainer(container, actor, room);
			return;
		}

		// Check if actor is in a room
		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if container is specified
		if (!container) {
			actor.sendMessage(
				"You don't see that container here or in your inventory.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if container is an Item and has isContainer flag
		if (container instanceof Item && !container.isContainer) {
			actor.sendMessage(
				`${container.display} is not a container.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if container is accessible (in room or in actor's inventory)
		const containerLocation = container.location;
		if (containerLocation !== room && containerLocation !== actor) {
			actor.sendMessage(
				`You don't have access to ${container.display}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle gold putting
		if (amount !== undefined) {
			// Validate amount
			if (amount <= 0) {
				actor.sendMessage(
					"You must put a positive amount of gold.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Check if actor has enough value
			if ((actor.value || 0) < amount) {
				actor.sendMessage(
					`You don't have enough gold. You have ${actor.value || 0}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Create currency item
			const currency = createGold(amount);

			// Put currency in container
			container.add(currency);

			// Deduct value from actor
			actor.value = (actor.value || 0) - amount;

			act(
				{
					user: `You put ${currency.display} in ${container.display}.`,
					room: `{User} puts ${currency.display} in ${container.display}.`,
				},
				{
					user: actor,
					room: room,
				},
				{ messageGroup: MESSAGE_GROUP.ACTION }
			);
			return;
		}

		// Handle regular item putting
		// Check if item is specified
		if (!item) {
			actor.sendMessage("You don't have that.", MESSAGE_GROUP.COMMAND_RESPONSE);
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

		// Check if item is equipped (cannot put equipped items in containers)
		if (item instanceof Equipment) {
			const equippedItems = actor.getAllEquipped();
			if (equippedItems.includes(item)) {
				actor.sendMessage(
					`You cannot put ${item.display} in a container while it's equipped.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
		}

		// Prevent putting container into itself
		if (item === container) {
			actor.sendMessage(
				"You cannot put something into itself.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Prevent putting container into something inside it (circular reference check)
		let current: DungeonObject | undefined = container;
		while (current) {
			if (current === item) {
				actor.sendMessage(
					"You cannot put a container into something inside it.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
			current = current.location;
		}

		// Move item to container
		container.add(item);

		act(
			{
				user: `You put ${item.display} in ${container.display}.`,
				room: `{User} puts ${item.display} in ${container.display}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("Could not parse argument")) {
			context.actor.sendMessage(
				"You don't have that, or you don't see that container.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		if (result.error?.includes("Missing required argument")) {
			context.actor.sendMessage(
				"What do you want to put, and in what container?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
