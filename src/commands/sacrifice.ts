/**
 * Sacrifice command for destroying items on the ground.
 *
 * Sacrifices an Item on the ground, destroying it and giving the actor 25% of its value as gold.
 * Only Item objects can be sacrificed (not Props or other DungeonObjects).
 *
 * @example
 * ```
 * sacrifice sword
 * sacrifice "gold coin"
 * sacrifice potion
 * ```
 *
 * **Pattern:** `sacrifice~ <item:item@room>`
 * @module commands/sacrifice
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item, Currency } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { act } from "../act.js";
import { color, COLOR } from "../core/color.js";

export default {
	pattern: "sacrifice~ <item:item@room>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;
		const item = args.get("item") as Item | undefined;

		// Check if actor is in a room
		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if item is specified
		if (!item) {
			actor.sendMessage(
				"You don't see that here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Ensure it's actually an Item (not a Prop or other DungeonObject)
		if (!(item instanceof Item)) {
			const displayName = (item as any)?.display || "that";
			actor.sendMessage(
				`You cannot sacrifice ${displayName}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if item is actually in the room
		if (item.location !== room) {
			actor.sendMessage(
				`${item.display} is not here.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Cannot sacrifice Currency items
		if (item instanceof Currency) {
			actor.sendMessage(
				"You cannot sacrifice currency.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Calculate gold reward (25% of item value)
		const itemValue = item.value || 0;
		const goldReward = Math.floor(itemValue * 0.25);

		// Save display name before destroying
		const itemDisplay = item.display;

		// Destroy the item
		item.destroy();

		// Give gold to actor
		if (goldReward > 0) {
			actor.value += goldReward;
			act(
				{
					user: `You sacrifice ${itemDisplay} and gain ${color(
						String(goldReward),
						COLOR.YELLOW
					)} gold.`,
					room: `{User} sacrifices ${itemDisplay}.`,
				},
				{
					user: actor,
					room: room,
				},
			);
		} else {
			act(
				{
					user: `You sacrifice ${itemDisplay}.`,
					room: `{User} sacrifices ${itemDisplay}.`,
				},
				{
					user: actor,
					room: room,
				},
			);
		}
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("Could not parse argument")) {
			context.actor.sendMessage(
				"You don't see that here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		if (result.error?.includes("Missing required argument")) {
			context.actor.sendMessage(
				"What do you want to sacrifice?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;

