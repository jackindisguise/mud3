/**
 * Wear command for equipping equipment.
 *
 * Equips an Equipment item from the actor's inventory or from a container.
 * The equipment must be in the actor's inventory or accessible container.
 *
 * @example
 * ```
 * wear helmet
 * wear "ring of strength"
 * wear sword
 * wear helmet from bag
 * ```
 *
 * **Patterns:**
 * - `wear <equipment:equipment@inventory>` - Wear equipment from inventory
 * - `wear <equipment:equipment@container> from <container:object>` - Wear equipment from container
 * @module commands/wear
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { DungeonObject } from "../dungeon.js";
import { Equipment, Armor, Weapon, EQUIPMENT_SLOT, Mob } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";

const slotMessages: Record<EQUIPMENT_SLOT, string> = {
	[EQUIPMENT_SLOT.HEAD]: "You strap {equipment} onto your head.",
	[EQUIPMENT_SLOT.NECK]: "You wear {equipment} around your neck.",
	[EQUIPMENT_SLOT.SHOULDERS]: "You strap {equipment} onto your shoulders.",
	[EQUIPMENT_SLOT.CHEST]: "You wear {equipment} on your chest.",
	[EQUIPMENT_SLOT.HANDS]: "You put on {equipment}.",
	[EQUIPMENT_SLOT.WAIST]: "You fasten {equipment} around your waist.",
	[EQUIPMENT_SLOT.LEGS]: "You strap {equipment} onto your legs.",
	[EQUIPMENT_SLOT.FEET]: "You strap {equipment} onto your feet.",
	[EQUIPMENT_SLOT.MAIN_HAND]: "You wield {equipment} in your main hand.",
	[EQUIPMENT_SLOT.OFF_HAND]: "You put {equipment} in your offhand.",
	[EQUIPMENT_SLOT.FINGER]: "You slip {equipment} onto your finger.",
};

export default {
	pattern: "wear~ <equipment:equipment@inventory>",
	aliases: [
		"equip~ <equipment:equipment@inventory>",
		"wield~ <equipment:equipment@inventory>",
	],
	execute(context: CommandContext, args: Map<string, any>): void {
		const equipment = args.get("equipment") as Equipment;
		const { actor } = context;

		// Check if equipment is in actor's inventory
		if (equipment.location !== actor) {
			context.actor.sendMessage(
				`You don't have ${equipment.display}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Equip the equipment
		actor.equip(equipment);

		// Get slot-specific message
		const message = slotMessages[equipment.slot].replace(
			"{equipment}",
			equipment.display
		);

		context.actor.sendMessage(message, MESSAGE_GROUP.COMMAND_RESPONSE);
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
				"What do you want to wear?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
