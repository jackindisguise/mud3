import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR, SIZER } from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { string } from "mud-ext";

function formatStat(value: number): string {
	return `${Math.floor(Number(value) || 0)}`;
}

function buildSectionBox(title: string, content: string[]): string[] {
	return string.box({
		input: content,
		width: 76,
		style: {
			titleHAlign: string.ALIGN.CENTER,
			top: {
				middle: "-",
			},
		},
		title,
		sizer: SIZER,
	});
}

export default {
	pattern: "score~",
	aliases: ["info~", "me~"],
	execute(context: CommandContext): void {
		const { actor } = context;
		const character = actor.character;
		if (!character) {
			actor.sendMessage(
				"Only players have a score.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const mob = character.mob;

		const sections: string[][] = [];

		const infoLines: string[] = [
			`${color("Name:", COLOR.CYAN)} ${character.credentials.username}`,
			`${color("Level:", COLOR.CYAN)} ${mob.level}`,
			`${color("Experience:", COLOR.CYAN)} ${formatStat(mob.experience)}`,
			`${color("Race:", COLOR.CYAN)} ${mob.race.name ?? "(unknown)"}`,
			`${color("Class:", COLOR.CYAN)} ${mob.class.name ?? "(unknown)"}`,
		];
		sections.push(buildSectionBox("Character", infoLines));

		const healthLine = string.pad({
			string: `${color("Health:", COLOR.LIME)} ${formatStat(
				mob.health
			)} / ${formatStat(mob.maxHealth)}`,
			width: 25,
			sizer: SIZER,
			textAlign: string.ALIGN.CENTER,
		});
		const manaLine = string.pad({
			string: `${color("Mana:", COLOR.LIME)} ${formatStat(
				mob.mana
			)} / ${formatStat(mob.maxMana)}`,
			width: 26,
			sizer: SIZER,
			textAlign: string.ALIGN.CENTER,
		});
		const exhaustionLine = string.pad({
			string: `${color("Exhaustion:", COLOR.LIME)} ${formatStat(
				mob.exhaustion
			)} / ${formatStat(mob.maxExhaustion)}`,
			width: 25,
			sizer: SIZER,
			textAlign: string.ALIGN.CENTER,
		});
		const statsLines: string[] = [healthLine, manaLine, exhaustionLine];
		sections.push(buildSectionBox("Stats", [statsLines.join("")]));

		const primary = mob.primaryAttributes;
		const strengthLine = string.pad({
			string: `${color("Strength:", COLOR.LIME)} ${formatStat(
				primary.strength
			)}`,
			width: 25,
			sizer: SIZER,
			textAlign: string.ALIGN.CENTER,
		});
		const agilityLine = string.pad({
			string: `${color("Agility:", COLOR.LIME)} ${formatStat(primary.agility)}`,
			width: 26,
			sizer: SIZER,
			textAlign: string.ALIGN.CENTER,
		});
		const intelligenceLine = string.pad({
			string: `${color("Intelligence:", COLOR.LIME)} ${formatStat(
				primary.intelligence
			)}`,
			width: 25,
			sizer: SIZER,
			textAlign: string.ALIGN.CENTER,
		});
		const primaryLines: string[] = [
			strengthLine,
			agilityLine,
			intelligenceLine,
		];
		sections.push(
			buildSectionBox("Primary Attributes", [primaryLines.join("")])
		);

		const secondary = mob.secondaryAttributes;
		const strengthLines: string[] = [
			`${color("Attack Power:", COLOR.LIME)} ${formatStat(
				secondary.attackPower
			)}`,
			`${color("Vitality:", COLOR.LIME)} ${formatStat(secondary.vitality)}`,
			`${color("Defense:", COLOR.LIME)} ${formatStat(secondary.defense)}`,
		];
		const agilityLines: string[] = [
			`${color("Crit Rate:", COLOR.LIME)} ${formatStat(secondary.critRate)}`,
			`${color("Avoidance:", COLOR.LIME)} ${formatStat(secondary.avoidance)}`,
			`${color("Accuracy:", COLOR.LIME)} ${formatStat(secondary.accuracy)}`,
			`${color("Endurance:", COLOR.LIME)} ${formatStat(secondary.endurance)}`,
		];
		const intelligenceLines: string[] = [
			`${color("Spell Power:", COLOR.LIME)} ${formatStat(
				secondary.spellPower
			)}`,
			`${color("Wisdom:", COLOR.LIME)} ${formatStat(secondary.wisdom)}`,
			`${color("Resilience:", COLOR.LIME)} ${formatStat(secondary.resilience)}`,
		];
		const secondaryLines: string[] = [
			...strengthLines,
			...agilityLines,
			...intelligenceLines,
		];
		sections.push(buildSectionBox("Secondary Attributes", secondaryLines));

		const miscLines: string[] = [
			`${color("Playtime:", COLOR.CYAN)} ${character.getFormattedPlaytime()}`,
			`${color(
				"Created:",
				COLOR.CYAN
			)} ${character.credentials.createdAt.toLocaleString()}`,
			`${color(
				"Last Login:",
				COLOR.CYAN
			)} ${character.credentials.lastLogin.toLocaleString()}`,
			`${color("Kills:", COLOR.CYAN)} ${character.stats.kills}`,
			`${color("Deaths:", COLOR.CYAN)} ${character.stats.deaths}`,
		];
		sections.push(buildSectionBox("Miscellaneous", miscLines));

		const finalOutput = sections.flatMap((section, index) => {
			if (index === 0) return section;
			return [LINEBREAK, LINEBREAK, ...section];
		});

		const wrapper = string.box({
			input: finalOutput,
			width: 80,
			style: string.BOX_STYLES.ROUNDED,
			title: `${actor.display}`,
			sizer: SIZER,
		});

		actor.sendMessage(wrapper.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
