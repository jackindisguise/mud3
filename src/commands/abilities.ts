/**
 * Abilities command for displaying learned abilities.
 *
 * Shows all abilities the player has learned in a table format,
 * displaying the ability name and proficiency percentage.
 *
 * @example
 * ```
 * abilities
 * ```
 *
 * **Pattern:** `abilities~`
 * @module commands/abilities
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { getAbilityById } from "../registry/ability.js";
import { color, COLOR } from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";
import { string } from "mud-ext";

function getProficiencyLevel(proficiency: number): string {
	if (proficiency === 100) {
		return "Master";
	} else if (proficiency >= 75) {
		return "Expert";
	} else if (proficiency >= 50) {
		return "Skilled";
	} else if (proficiency >= 25) {
		return "Adept";
	} else {
		return "Novice";
	}
}

function formatProficiency(proficiency: number): string {
	// Format as "(XXX%)" with fixed width: "(  1%)", "( 80%)", "(100%)"
	return `${proficiency.toString()}%`;
}

export default {
	pattern: "abilities~",
	execute(context: CommandContext): void {
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can view abilities.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const learnedAbilities = actor.learnedAbilities;

		if (learnedAbilities.size === 0) {
			actor.sendMessage(
				"You haven't learned any abilities yet. Use 'learn <ability>' to learn an ability.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Collect ability data
		const abilityData: Array<{
			name: string;
			proficiency: number;
			uses: number;
		}> = [];

		for (const [abilityId, proficiency] of learnedAbilities.entries()) {
			const ability = getAbilityById(abilityId);
			if (ability) {
				const uses = actor.getAbilityUses(abilityId);
				abilityData.push({
					name: ability.name,
					proficiency,
					uses,
				});
			}
		}

		// Sort by name
		abilityData.sort((a, b) => a.name.localeCompare(b.name));

		// Build output lines
		const lines: string[] = [];
		lines.push(color("=== Learned Abilities ===", COLOR.YELLOW));

		// Format abilities as "Ability Name - Level (percentage%)"
		const abilityStrings: string[] = [];
		for (const { name, proficiency } of abilityData) {
			const level = getProficiencyLevel(proficiency);
			const proficiencyColor =
				proficiency === 100
					? COLOR.YELLOW
					: proficiency >= 75
					? COLOR.LIME
					: proficiency >= 50
					? COLOR.DARK_GREEN
					: proficiency >= 25
					? COLOR.TEAL
					: COLOR.GREY;

			const abilityName = color(
				string.pad(name, 18, string.ALIGN.CENTER),
				COLOR.WHITE
			);
			const levelColored = color(level, proficiencyColor);
			const percentFormatted = formatProficiency(proficiency);
			const percentColored = color(percentFormatted, proficiencyColor);

			abilityStrings.push(
				` ${abilityName} (${levelColored}) <${percentColored}>`
			);
		}

		// Display in 2 columns
		const columnWidth = 40;
		for (let i = 0; i < abilityStrings.length; i += 2) {
			const left = abilityStrings[i];
			const right = abilityStrings[i + 1];
			if (right) {
				lines.push(
					`${string.pad(left, columnWidth, string.ALIGN.LEFT)}${right}`
				);
			} else {
				lines.push(left);
			}
		}

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
