/**
 * Appraise command for checking the sell price of items with shopkeepers.
 *
 * Allows a player to check how much a shopkeeper will pay for an item.
 *
 * @example
 * ```
 * appraise sword
 * appraise potion
 * ```
 *
 * **Pattern:** `appraise~ <item:item@inventory>`
 * @module commands/appraise
 */

import { CommandContext, ParseResult, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import {
	findShopkeeperInRoom,
	getShopkeeperInventoryFromMob,
} from "./_shopkeeper-helpers.js";
import { getSellPrice } from "../core/shopkeeper-inventory.js";
import { color, COLOR, SIZER } from "../core/color.js";
import { Item, Equipment, Weapon, Armor } from "../core/dungeon.js";
import {
	formatContainerBox,
	formatEquipmentBox,
	BOX_WIDTH,
} from "../abilities/lore.js";
import { formatNumber } from "../utils/number.js";
import { string } from "mud-ext";
import { capitalizeFirst } from "../utils/string.js";

export const command = {
	pattern: "appraise~ <item:text>",
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
				"What do you want to appraise?",
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

		const result = results[0];
		// Calculate sell price (what shopkeeper will pay if player sells this item)
		const sellPrice = getSellPrice(inventory, result);

		// Build lore information based on item type (same as lore command)
		let lines: string[] = [];

		if (result instanceof Item && result.isContainer) {
			// Container format
			lines = formatContainerBox(result);
		} else if (result instanceof Weapon) {
			// Weapon format
			lines = formatEquipmentBox(result, false, true);
		} else if (result instanceof Armor) {
			// Armor format
			lines = formatEquipmentBox(result, true, false);
		} else if (result instanceof Equipment) {
			// Equipment format
			lines = formatEquipmentBox(result, false, false);
		} else {
			// Fallback for regular items
			const content: string[] = [];
			const valueStr =
				result.value > 0 ? `${formatNumber(result.value)} gold` : "0 gold";
			const weightStr = `${formatNumber(result.baseWeight)}lbs`;
			const valueWeightLine = `Value: ${valueStr}${" ".repeat(
				BOX_WIDTH -
					2 -
					`Value: ${valueStr}`.length -
					`Weight: ${weightStr}`.length
			)}Weight: ${weightStr}`;
			content.push(valueWeightLine);
			lines = string.box({
				input: content,
				width: BOX_WIDTH,
				sizer: SIZER,
				style: {
					...string.BOX_STYLES.PLAIN,
				},
				title: result.display,
			});
		}

		// Add sell price information at the bottom
		const sellPriceStr = color(`${formatNumber(sellPrice)} gold`, COLOR.YELLOW);
		lines.push("");
		lines.push(`${shopkeeper.display} will pay ${sellPriceStr} for this item.`);

		actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("item")) {
			context.actor.sendMessage(
				"What do you want to appraise?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
