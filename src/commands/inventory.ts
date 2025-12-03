/**
 * Inventory command for viewing items in your inventory.
 *
 * Shows all items currently in your inventory (excluding equipped items).
 *
 * @example
 * ```
 * inventory
 * inv
 * i
 * ```
 *
 * **Patterns:**
 * - `inventory` - Show inventory
 * @module commands/inventory
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item } from "../core/dungeon.js";
import { Equipment } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { LINEBREAK } from "../core/telnet.js";
import { color, COLOR } from "../core/color.js";

export default {
	pattern: "inventory~",
	execute(context: CommandContext): void {
		const { actor } = context;

		// Get all items in inventory
		const inventory = actor.contents.filter(
			(obj) => obj instanceof Item
		) as Item[];

		// Get equipped items to exclude from inventory display
		const equippedItems = actor.getAllEquipped();

		// Filter out equipped items
		const unequippedItems = inventory.filter(
			(item) => !(item instanceof Equipment) || !equippedItems.includes(item)
		);

		const lines = ["You are carrying:"];

		if (unequippedItems.length === 0) {
			lines.push(" Nothing.");
		} else {
			// Format inventory list
			const itemList = unequippedItems.map((item) => `${item.display}`);
			lines.push(...itemList.map((item) => ` ${item}`));
		}

		lines.push(
			`You're carrying ${color(`${actor.value} gold`, COLOR.YELLOW)}.`
		);

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
