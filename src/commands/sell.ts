/**
 * Sell command for selling items to shopkeepers.
 *
 * Allows a player to sell items to a shopkeeper.
 *
 * @example
 * ```
 * sell sword
 * sell potion
 * ```
 *
 * **Pattern:** `sell~ <item:item@inventory>`
 * @module commands/sell
 */

import { CommandContext, ParseResult, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import {
	findShopkeeperInRoom,
	getShopkeeperInventoryFromMob,
} from "./_shopkeeper-helpers.js";
import { getSellPrice, addStock } from "../core/shopkeeper.js";
import { color, COLOR } from "../core/color.js";
import { act } from "../systems/act.js";
import type { Item } from "../core/dungeon.js";

export const command = {
	pattern: "sell~ <item:item@inventory>",
	priority: PRIORITY.LOW,
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const shopkeeper = findShopkeeperInRoom(room);
		if (!shopkeeper) {
			actor.sendMessage(
				"There is no shopkeeper here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const inventory = getShopkeeperInventoryFromMob(shopkeeper);
		if (!inventory) {
			actor.sendMessage(
				`${shopkeeper.display} is not buying anything.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const item = args.get("item") as Item | undefined;
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

		// Calculate sell price
		const price = getSellPrice(inventory, item);

		if (price <= 0) {
			actor.sendMessage(
				`${shopkeeper.display} is not interested in ${item.display}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Remove item from player
		item.location = undefined;

		// Add to shopkeeper stock
		addStock(inventory, item);

		// Give gold to player
		actor.value = (actor.value || 0) + price;

		// Send messages
		act(
			{
				user: `You sell ${item.display} to ${shopkeeper.display} for ${color(
					String(price),
					COLOR.YELLOW
				)} gold.`,
				room: `{User} sells ${item.display} to ${shopkeeper.display}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("item")) {
			context.actor.sendMessage(
				"What do you want to sell?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
