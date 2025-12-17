/**
 * Give command for giving items or gold to mobs.
 *
 * Gives an Item from the actor's inventory to a mob in the room, or gives gold
 * by creating a Currency item and transferring it to the target mob.
 *
 * @example
 * ```
 * give sword to jon
 * give sword jon
 * give 10 gold to jon
 * give 10 gold jon
 * give all to jon
 * give all jon
 * ```
 *
 * **Patterns:**
 * - `give all to <target>` - Give all items from inventory to mob
 * - `give all <target>` - Give all items from inventory to mob (without "to")
 * - `give~ <item:item@inventory> to <target:mob@room>` - Give item to mob
 * - `give~ <item:item@inventory> <target:mob@room>` - Give item to mob (without "to")
 * - `give~ <amount:number> gold to <target:mob@room>` - Give gold to mob
 * - `give~ <amount:number> gold <target:mob@room>` - Give gold to mob (without "to")
 * @module commands/give
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item, Currency, Mob, Equipment } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { act } from "../utils/act.js";
import { createGold } from "../utils/currency.js";
import { capitalizeFirst } from "../utils/string.js";

function giveAllToTarget(target: Mob, actor: any, room: any): void {
	// Check if actor is in a room
	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return;
	}

	// Check if target is specified
	if (!target) {
		actor.sendMessage(
			"Who do you want to give that to?",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Check if target is in the same room
	if (target.location !== room) {
		actor.sendMessage(
			`${capitalizeFirst(target.display)} is not here.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Get all items from inventory (exclude equipped items)
	// Create a copy of the array since we'll be modifying actor.contents during iteration
	const inventoryItems = [...actor.contents].filter(
		(obj: any) =>
			obj instanceof Item &&
			!(obj instanceof Equipment && actor.getAllEquipped().includes(obj))
	) as Item[];

	if (inventoryItems.length === 0) {
		actor.sendMessage(
			"You don't have anything to give.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Give all items to target
	let successCount = 0;
	const failedItems: string[] = [];

	for (const invItem of inventoryItems) {
		// Skip if item is no longer in actor's inventory (might have been moved by previous iteration)
		if (invItem.location !== actor) continue;

		// Move item to target's inventory
		target.add(invItem);

		// Show act() message for each item
		act(
			{
				user: `You give ${invItem.display} to {target}.`,
				target: `{User} gives you ${invItem.display}.`,
				room: `{User} gives ${invItem.display} to {target}.`,
			},
			{
				user: actor,
				target: target,
				room: room,
			}
		);
		successCount++;
	}

	if (failedItems.length > 0) {
		actor.sendMessage(
			`Could not give: ${failedItems.join(", ")}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	}
}

export const command = {
	pattern: "give~ all to <target:mob@room>",
	aliases: [
		"give~ all <target:mob@room>",
		"give~ <amount:number> gold to <target:mob@room>",
		"give~ <amount:number> gold <target:mob@room>",
		"give~ <item:item@inventory> to <target:mob@room>",
		"give~ <item:item@inventory> <target:mob@room>",
	],
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;
		const item = args.get("item") as Item | undefined;
		const amount = args.get("amount") as number | undefined;
		const target = args.get("target") as Mob | undefined;

		// Handle "give all" (item and amount are both undefined)
		if (item === undefined && amount === undefined && target !== undefined) {
			giveAllToTarget(target, actor, room);
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

		// Check if target is specified
		if (!target) {
			actor.sendMessage(
				"Who do you want to give that to?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if target is in the same room
		if (target.location !== room) {
			actor.sendMessage(
				`${capitalizeFirst(target.display)} is not here.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle gold giving
		if (amount !== undefined) {
			// Validate amount
			if (amount <= 0) {
				actor.sendMessage(
					"You must give a positive amount of gold.",
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

			// Transfer currency to target - add value to target and remove the currency item
			target.value = (target.value || 0) + currency.value;
			currency.location = undefined; // Remove the currency item

			// Deduct value from actor
			actor.value = (actor.value || 0) - amount;

			act(
				{
					user: `You give ${currency.display} to {target}.`,
					target: `{User} gives you ${currency.display}.`,
					room: `{User} gives ${currency.display} to {target}.`,
				},
				{
					user: actor,
					target: target,
					room: room,
				},
				{ messageGroup: MESSAGE_GROUP.ACTION }
			);
			return;
		}

		// Handle item giving
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

		// Check if item is equipped (cannot give equipped items)
		if (item instanceof Equipment) {
			const equippedItems = actor.getAllEquipped();
			if (equippedItems.includes(item)) {
				actor.sendMessage(
					`You cannot give ${item.display} while it's equipped.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
		}

		// Move item to target's inventory
		target.add(item);

		act(
			{
				user: `You give ${item.display} to {target}.`,
				target: `{User} gives you ${item.display}.`,
				room: `{User} gives ${item.display} to {target}.`,
			},
			{
				user: actor,
				target: target,
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
				"What do you want to give, and to whom?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
