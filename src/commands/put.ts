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
 * ```
 *
 * **Pattern:** `put~ <item:item@inventory> in <container:object@all>`
 * @module commands/put
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item, DungeonObject, Equipment, Currency } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { act } from "../act.js";
import { createGold } from "../utils/currency.js";

export default {
	pattern: "put~ <item:item@inventory> in <container:object@all>",
	aliases: ["put~ <amount:number> gold in <container:object@all>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;
		const item = args.get("item") as Item | undefined;
		const amount = args.get("amount") as number | undefined;
		const container = args.get("container") as DungeonObject | undefined;

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
