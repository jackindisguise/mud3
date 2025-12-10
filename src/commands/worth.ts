/**
 * Worth command for viewing your character's value, level, and experience.
 *
 * Shows your current gold value, level, and experience points.
 *
 * @example
 * ```
 * worth
 * ```
 *
 * **Pattern:** `worth~`
 * @module commands/worth
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR } from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";
import { formatNumber } from "../utils/number.js";

export const command = {
	pattern: "worth~",
	execute(context: CommandContext): void {
		const { actor } = context;

		const totalBaseExperience = actor.calculateTotalBaseExperience();

		const lines = [
			`${color("Gold:", COLOR.YELLOW)} ${formatNumber(actor.value)}`,
			`${color("Level:", COLOR.CYAN)} ${actor.level}`,
			`${color("Experience:", COLOR.CYAN)} ${actor.experience}`,
			`${color("Total Base Experience:", COLOR.CYAN)} ${totalBaseExperience}`,
		];

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
