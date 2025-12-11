/**
 * Inventory command for viewing items in your inventory.
 *
 * Shows all items currently in your inventory (excluding equipped items).
 * Optional arguments:
 * - `weight` - Shows weight next to each item and sorts by weight
 * - `value` - Shows value next to each item and sorts by value
 *
 * @example
 * ```
 * inventory
 * inv
 * inv weight
 * inv value
 * ```
 *
 * **Patterns:**
 * - `inventory~` - Show inventory
 * - `inventory~ <mode:word?>` - Show inventory with optional mode (weight/value)
 * @module commands/inventory
 */

import { CommandContext, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item } from "../core/dungeon.js";
import { Equipment } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { LINEBREAK } from "../core/telnet.js";
import { color, COLOR } from "../core/color.js";
import { formatNumber } from "../utils/number.js";
import { groupItems } from "../utils/display.js";

export const command = {
	pattern: "inventory~ <mode:word?>",
	priority: PRIORITY.HIGH,
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor } = context;
		const mode = (args.get("mode") as string | undefined)?.toLowerCase();

		// Get all items in inventory
		const inventory = actor.contents.filter(
			(obj) => obj instanceof Item
		) as Item[];

		// Get equipped items to exclude from inventory display
		const equippedItems = actor.getAllEquipped();

		// Filter out equipped items
		let unequippedItems = inventory.filter(
			(item) => !(item instanceof Equipment) || !equippedItems.includes(item)
		);

		// Sort items based on mode
		if (mode === "weight") {
			unequippedItems.sort((a, b) => b.currentWeight - a.currentWeight);
		} else if (mode === "value") {
			unequippedItems.sort((a, b) => b.value - a.value);
		}

		const lines = ["You are carrying:"];

		if (unequippedItems.length === 0 && actor.value === 0) {
			lines.push(" Nothing.");
		} else {
			// Group items by display and keywords string
			const displayAndKeywordsKeyFn = (item: Item) =>
				`${item.display}|${item.keywords}`;
			const templateIdKeyFn = (item: Item) => item.templateId || "no-template";
			const standardKeyFn = (item: Item) =>
				`${displayAndKeywordsKeyFn(item)}|${templateIdKeyFn(item)}`;
			const weightKeyFn = (item: Item) =>
				`${standardKeyFn(item)}|weight ${item.currentWeight}`;
			const valueKeyFn = (item: Item) =>
				`${standardKeyFn(item)}|value ${item.value}`;
			let itemGroups: Map<string, { item: Item; count: number }>;

			// Format inventory list
			const itemList: string[] = [];
			if (mode === "weight") {
				itemGroups = groupItems(unequippedItems, weightKeyFn);
			} else if (mode === "value") {
				itemGroups = groupItems(unequippedItems, valueKeyFn);
			} else {
				itemGroups = groupItems(unequippedItems, standardKeyFn);
			}
			for (const { item, count } of itemGroups.values()) {
				let line = ` ${item.display}`;

				// Add count if more than one
				if (count > 1) {
					line += ` ${color(`(x${count})`, COLOR.GREY)}`;
				}

				if (mode === "weight") {
					line += ` ${color(
						`(${formatNumber(item.currentWeight)}lbs)`,
						COLOR.CYAN
					)}`;
				} else if (mode === "value") {
					if (item.value > 0) {
						line += ` ${color(
							`(${formatNumber(item.value)} gold)`,
							COLOR.YELLOW
						)}`;
					} else {
						line += ` ${color(`(worthless)`, COLOR.GREY)}`;
					}
				}
				itemList.push(line);
			}
			lines.push(...itemList);
			if (actor.value > 0)
				lines.push(
					` ${color(`${formatNumber(actor.value)} gold`, COLOR.YELLOW)}`
				);
		}

		// Add current weight at the bottom
		const totalWeight = unequippedItems.reduce(
			(sum, item) => sum + item.currentWeight,
			0
		);
		lines.push("");
		lines.push(
			`Total weight: ${color(`${formatNumber(totalWeight)}lbs`, COLOR.CYAN)}`
		);

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
