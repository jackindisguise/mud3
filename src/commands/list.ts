/**
 * List command for viewing shopkeeper inventory.
 *
 * Shows all items currently available for purchase from a shopkeeper in the room.
 *
 * @example
 * ```
 * list
 * ```
 *
 * **Pattern:** `list~`
 * @module commands/list
 */

import { CommandContext, ParseResult, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import {
	findShopkeeperInRoom,
	getShopkeeperInventoryFromMob,
} from "./_shopkeeper-helpers.js";
import { getBuyPrice, isInfiniteStock } from "../core/shopkeeper-inventory.js";
import { color, COLOR, SIZER } from "../core/color.js";
import { string } from "mud-ext";

export const command = {
	pattern: "list~",
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
				`${shopkeeper.display} has no inventory.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (inventory.stock.length === 0) {
			actor.sendMessage(
				`${shopkeeper.display} has nothing for sale.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Group items by template ID and count them
		const stockMap = new Map<string, { item: any; count: number }>();
		for (const item of inventory.stock) {
			const templateId = item.templateId || item.keywords;
			const existing = stockMap.get(templateId);
			if (existing) {
				existing.count++;
			} else {
				stockMap.set(templateId, { item, count: 1 });
			}
		}

		// Build inventory list
		const lines: string[] = [];
		lines.push(`${shopkeeper.display} has the following items for sale:`);
		lines.push("");

		for (const [templateId, { item, count }] of stockMap.entries()) {
			const price = getBuyPrice(inventory, item);
			const priceStr = color(String(price), COLOR.YELLOW);

			// Check if this item is infinite stock by finding its restock rule
			let isInfinite = false;
			if (item.templateId) {
				const rule = inventory.rules.find(
					(r) => r.template.id === item.templateId
				);
				if (rule) {
					isInfinite = isInfiniteStock(rule);
				}
			}

			// Show stock count/infinite indicator at the beginning: "[*]" or "[count]"
			const stockCount = Math.min(count, 999);
			const stockCountStr = `${color(
				String(stockCount).padStart(3, " "),
				COLOR.WHITE
			)}`;
			const stockIndicator = `[${isInfinite ? "***" : stockCountStr}]`;
			// Pad item name to 25 characters for alignment
			const paddedName = string.pad(
				item.display,
				25,
				string.ALIGN.LEFT,
				" ",
				SIZER
			);
			lines.push(`  ${stockIndicator} ${paddedName} (${priceStr} gold)`);
		}

		actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
	},

	onError(context: CommandContext, result: ParseResult): void {
		// No specific error handling needed for list command
	},
} satisfies CommandObject;
