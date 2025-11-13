/**
 * Remove command for unequipping equipment.
 *
 * Removes (unequips) an Equipment item from the actor's equipped slots.
 * The equipment remains in the actor's inventory after being unequipped.
 *
 * @example
 * ```
 * remove helmet
 * remove "ring of strength"
 * remove sword
 * ```
 *
 * **Pattern:** `remove <equipment:item@equipment>`
 * @module commands/remove
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Equipment, EQUIPMENT_SLOT } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";

const slotMessages: Record<EQUIPMENT_SLOT, string> = {
	[EQUIPMENT_SLOT.HEAD]: "You unstrap {equipment} from your head.",
	[EQUIPMENT_SLOT.NECK]: "You remove {equipment} from around your neck.",
	[EQUIPMENT_SLOT.SHOULDERS]: "You unstrap {equipment} from your shoulders.",
	[EQUIPMENT_SLOT.CHEST]: "You remove {equipment} from your chest.",
	[EQUIPMENT_SLOT.HANDS]: "You take off {equipment}.",
	[EQUIPMENT_SLOT.WAIST]: "You unfasten {equipment} from your waist.",
	[EQUIPMENT_SLOT.LEGS]: "You unstrap {equipment} from your legs.",
	[EQUIPMENT_SLOT.FEET]: "You unstrap {equipment} from your feet.",
	[EQUIPMENT_SLOT.MAIN_HAND]: "You stop wielding {equipment}.",
	[EQUIPMENT_SLOT.OFF_HAND]: "You remove {equipment} from your offhand.",
	[EQUIPMENT_SLOT.FINGER]: "You slip {equipment} off your finger.",
};

export default {
	pattern: "remove~ <equipment:item@equipment>",
	aliases: ["unequip~ <equipment:item@equipment>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const equipment = args.get("equipment") as Equipment;
		const { actor } = context;

		// Unequip the equipment
		actor.unequip(equipment);

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
				"You're not wearing that.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		if (result.error?.includes("Missing required argument")) {
			context.actor.sendMessage(
				"What do you want to remove?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
