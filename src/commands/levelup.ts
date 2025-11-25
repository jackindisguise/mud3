/**
 * Levelup command for granting one level's worth of experience.
 *
 * Gives the player exactly 100 experience points (one level's worth).
 * This is a debug/development command for testing leveling up.
 *
 * @example
 * ```
 * levelup
 * ```
 *
 * **Pattern:** `levelup~`
 * @module commands/levelup
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";

const EXPERIENCE_THRESHOLD = 100;

export default {
	pattern: "levelup~",
	aliases: [],
	execute(context: CommandContext): void {
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can use this command.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const mob = character.mob;
		const oldLevel = mob.level;
		const remainingExperience = EXPERIENCE_THRESHOLD - mob.experience;
		const growth = mob.resolveGrowthModifier();
		const ceiledExperience = Math.ceil(remainingExperience * growth);
		const experienceGained = mob.gainExperience(ceiledExperience);
		const newLevel = mob.level;

		if (newLevel > oldLevel) {
			actor.sendMessage(
				`You gained ${experienceGained} experience and leveled up to level ${newLevel}!`,
				MESSAGE_GROUP.INFO
			);
		} else {
			actor.sendMessage(
				`You gained ${experienceGained} experience.`,
				MESSAGE_GROUP.INFO
			);
		}
	},
} satisfies CommandObject;
