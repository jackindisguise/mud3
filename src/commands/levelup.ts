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

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";

const EXPERIENCE_THRESHOLD = 100;

export const command = {
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

		const oldLevel = actor.level;
		const remainingExperience = EXPERIENCE_THRESHOLD - actor.experience;
		const growth = actor.resolveGrowthModifier();
		const ceiledExperience = Math.ceil(remainingExperience * growth);
		const experienceGained = actor.gainExperience(ceiledExperience);
		const newLevel = actor.level;

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
