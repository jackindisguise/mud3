/**
 * Buy command for purchasing items from shopkeepers.
 *
 * Allows a player to buy items from a shopkeeper's inventory.
 *
 * @example
 * ```
 * buy sword
 * buy potion
 * ```
 *
 * **Pattern:** `buy~ <item:object@room>`
 * @module commands/buy
 */

import { CommandContext, ParseResult, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import {
	findShopkeeperInRoom,
	getShopkeeperInventoryFromMob,
} from "./_shopkeeper-helpers.js";
import {
	getBuyPrice,
	removeStock,
	isInfiniteStock,
} from "../core/shopkeeper-inventory.js";
import { createFromTemplateWithOid } from "../package/dungeon.js";
import { resolveTemplateById } from "../registry/dungeon.js";
import { color, COLOR } from "../core/color.js";
import { act } from "../act.js";
import type { DungeonObject, Item } from "../core/dungeon.js";
import { capitalizeFirst } from "../utils/string.js";
import { LINEBREAK } from "../core/telnet.js";

export const command = {
	pattern: "buy~ <item:text>",
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
				`${capitalizeFirst(shopkeeper.display)} has no inventory.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const item = args.get("item") as string | undefined;
		if (!item) {
			actor.sendMessage(
				"What do you want to buy?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		const results = inventory.stock.filter((_item) => _item.match(item));
		if (results.length === 0) {
			actor.sendMessage(
				`${capitalizeFirst(
					shopkeeper.display
				)} doesn't have '${item}' for sale.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Find the restock rule for this item to check if it's infinite
		const result = results[0];
		const templateId = result.templateId;
		let isInfinite = false;
		if (templateId) {
			const rule = inventory.rules.find((r) => r.template.id === templateId);
			if (rule) {
				isInfinite = isInfiniteStock(rule);
			}
		}

		// Calculate price
		const price = getBuyPrice(inventory, result);

		// Check if player has enough gold
		if ((actor.value || 0) < price) {
			const lines = [
				`You don't have enough gold.`,
				`${capitalizeFirst(result.display)} costs ${color(
					String(price),
					COLOR.YELLOW
				)} gold, but you only have ${actor.value}.`,
			];
			actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
			return;
		}

		// Handle infinite stock - clone the item
		let itemToGive: DungeonObject;
		if (isInfinite && templateId) {
			const template = resolveTemplateById(templateId);
			if (!template) {
				actor.sendMessage(
					"Error: Could not find template for item.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
			itemToGive = createFromTemplateWithOid(template);
		} else {
			// Remove from stock
			if (!removeStock(inventory, result)) {
				actor.sendMessage(
					"Error: Item is no longer available.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
			itemToGive = result;
		}

		// Deduct gold from player
		actor.value -= price;

		// Give item to player
		actor.add(itemToGive);

		// Send messages
		act(
			{
				user: `You buy ${itemToGive.display} from ${
					shopkeeper.display
				} for ${color(String(price), COLOR.YELLOW)} gold.`,
				room: `{User} buys ${itemToGive.display} from ${shopkeeper.display}.`,
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
				"What do you want to buy?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
