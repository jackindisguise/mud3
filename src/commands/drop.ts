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

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item, Currency } from "../core/dungeon.js";
import { Equipment } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { act } from "../act.js";
import logger from "../logger.js";
import { createGold } from "../utils/currency.js";

export default {
	pattern: "drop~ <item:item@inventory>",
	aliases: ["drop~ <amount:number> gold"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const amount = args.get("amount") as number | undefined;
		const item = args.get("item") as Item | undefined;
		//logger.debug(`Drop command`, { amount, item });
		const { actor, room } = context;

		// Handle currency drop pattern: "drop X gold/gil/etc"
		if (amount !== undefined) {
			// Check if actor is in a room
			if (!room) {
				actor.sendMessage(
					"You are not in a room.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Validate amount
			if (amount <= 0) {
				actor.sendMessage(
					"You must drop a positive amount of currency.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Check if actor has enough value
			if ((actor.value || 0) < amount) {
				actor.sendMessage(
					`You don't have enough value. You have ${actor.value || 0}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Create currency item and drop it
			const currency = createGold(amount, {
				includeRoomDescription: true,
			});
			room.add(currency);

			// Deduct value from actor
			actor.value = (actor.value || 0) - amount;

			act(
				{
					user: `You drop ${currency.display}.`,
					room: `{User} drops ${currency.display}.`,
				},
				{
					user: actor,
					room: room,
				},
				{ messageGroup: MESSAGE_GROUP.ACTION }
			);
			return;
		}

		// Handle regular item drop
		if (!item) {
			context.actor.sendMessage(
				"You don't have that.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
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

		act(
			{
				user: `You drop ${item.display}.`,
				room: `{User} drops ${item.display}.`,
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
