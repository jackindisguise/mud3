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
import { color, COLOR, SIZER } from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";
import { string } from "mud-ext";

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

		// Build table
		const lines: string[] = [];
		lines.push(color("=== Learned Abilities ===", COLOR.YELLOW));

		// Table header
		const header = `${string.pad(
			"Ability",
			30,
			string.ALIGN.LEFT
		)} ${string.pad("Uses", 10, string.ALIGN.CENTER)} ${string.pad(
			"Proficiency",
			12,
			string.ALIGN.CENTER
		)}`;
		lines.push(color(header, COLOR.CYAN));

		// Table rows
		for (const { name, proficiency, uses } of abilityData) {
			const proficiencyStr = `${proficiency}%`;
			const proficiencyColor =
				proficiency >= 75
					? COLOR.LIME
					: proficiency >= 50
					? COLOR.YELLOW
					: proficiency >= 25
					? COLOR.OLIVE
					: COLOR.SILVER;

			const abilityName = color(name, COLOR.WHITE);
			const usesStr = color(uses.toString(), COLOR.CYAN);
			const proficiencyColored = color(proficiencyStr, proficiencyColor);

			const row = `${string.pad({
				string: abilityName,
				width: 30,
				sizer: SIZER,
				textAlign: string.ALIGN.LEFT,
			})} ${string.pad({
				string: usesStr,
				width: 10,
				sizer: SIZER,
				textAlign: string.ALIGN.CENTER,
			})} ${string.pad({
				string: proficiencyColored,
				width: 12,
				sizer: SIZER,
				textAlign: string.ALIGN.CENTER,
			})}`;
			lines.push(row);
		}

		// Footer
		lines.push("");
		lines.push(
			color(
				`Total: ${abilityData.length} abilit${
					abilityData.length === 1 ? "y" : "ies"
				}`,
				COLOR.SILVER
			)
		);

		// Box the output
		const boxed = string.box({
			input: lines,
			width: 80,
			sizer: SIZER,
			style: {
				...string.BOX_STYLES.PLAIN,
				hPadding: 1,
				vPadding: 1,
			},
		});

		actor.sendMessage(boxed.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
