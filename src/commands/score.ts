import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR, SIZER } from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { string } from "mud-ext";

function formatStat(
	value: number,
	width: number = 3,
	pad: string = " "
): string {
	return `${value}`.padStart(width, pad);
}

function buildSectionBox(
	title: string | undefined,
	content: string[]
): string[] {
	return string.box({
		input: content,
		width: 76,
		style: {
			titleHAlign: string.ALIGN.CENTER,
			top: {
				middle: "-",
			},
			titleBorder: {
				left: ">",
				right: "<",
			},
		},
		title,
		sizer: SIZER,
	});
}

function combineHorizontalBoxes(options: {
	sizer: string.Sizer;
	boxes: string[][];
}): string[] {
	const sizer = options.sizer;
	const boxes = options.boxes;
	const lines: string[] = [];
	const width: number[] = []; // width of each box (assuming first line is as long as the others)
	let height = 0;
	for (let i = 0; i < boxes.length; i++) {
		width[i] = sizer.size(boxes[i][0]);
		if (boxes[i].length > height) height = boxes[i].length;
	}
	for (let i = 0; i < height; i++) {
		const row = [];
		for (let j = 0; j < boxes.length; j++) {
			const line = boxes[j][i];
			if (line) row.push(line);
			else row.push(" ".repeat(width[j]));
		}
		if (row.length > 0) lines.push(row.join(""));
		else break;
	}
	return lines;
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

		const infoLines: string[] = string.box({
			input: [
				`${color(
					"Name:      ",
					COLOR.CYAN
				)} ${character.credentials.username.padEnd(10)}`,
				`${color("Race:      ", COLOR.CYAN)} ${(
					mob.race.name ?? "(unknown)"
				).padEnd(10)}`,
				`${color("Class:     ", COLOR.CYAN)} ${(
					mob.class.name ?? "(unknown)"
				).padEnd(10)}`,
				`${color("Level:     ", COLOR.CYAN)} ${mob.level
					.toString()
					.padStart(3, "0")
					.padEnd(10)}`,
				`${color("Experience:", COLOR.CYAN)} ${mob.experience
					.toString()
					.padStart(3, "0")
					.padEnd(10)}`,
			],
			width: 76,
			sizer: SIZER,
			style: {
				hAlign: string.ALIGN.CENTER,
			},
		});
		sections.push(buildSectionBox("Info", infoLines));

		const healthLine = string.pad({
			string: `${color("Health:", COLOR.CRIMSON)} ${formatStat(
				mob.health
			)} / ${formatStat(mob.maxHealth)}`,
			width: 25,
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
		const manaLine = string.pad({
			string: `${color("Mana:", COLOR.CYAN)} ${formatStat(
				mob.mana
			)} / ${formatStat(mob.maxMana)}`,
			width: 26,
			sizer: SIZER,
			textAlign: string.ALIGN.CENTER,
		});

		const statsLines: string[] = [healthLine, exhaustionLine, manaLine];
		sections.push(buildSectionBox("Stats", [statsLines.join("")]));

		const primary = mob.primaryAttributes;
		const strengthLine = string.pad({
			string: `${color("Strength:", COLOR.CRIMSON)} ${formatStat(
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
			string: `${color("Intelligence:", COLOR.CYAN)} ${formatStat(
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
		const strengthLines: string[] = string.box({
			input: [
				`${color("Attack Power:", COLOR.CRIMSON)} ${formatStat(
					secondary.attackPower
				)}`,
				`${color("Vitality:    ", COLOR.CRIMSON)} ${formatStat(
					secondary.vitality
				)}`,
				`${color("Defense:     ", COLOR.CRIMSON)} ${formatStat(
					secondary.defense
				)}`,
			],
			width: 25,
			sizer: SIZER,
			style: {
				hAlign: string.ALIGN.CENTER,
			},
		});
		const strengthBox = buildSectionBox("Strength", strengthLines);
		const agilityLines: string[] = string.box({
			input: [
				`${color("Crit Rate:", COLOR.LIME)} ${formatStat(secondary.critRate)}`,
				`${color("Avoidance:", COLOR.LIME)} ${formatStat(secondary.avoidance)}`,
				`${color("Accuracy: ", COLOR.LIME)} ${formatStat(secondary.accuracy)}`,
				`${color("Endurance:", COLOR.LIME)} ${formatStat(secondary.endurance)}`,
			],
			width: 26,
			sizer: SIZER,
			style: {
				hAlign: string.ALIGN.CENTER,
			},
		});
		const intelligenceLines: string[] = string.box({
			input: [
				`${color("Spell Power:", COLOR.CYAN)} ${formatStat(
					secondary.spellPower
				)}`,
				`${color("Wisdom:     ", COLOR.CYAN)} ${formatStat(secondary.wisdom)}`,
				`${color("Resilience: ", COLOR.CYAN)} ${formatStat(
					secondary.resilience
				)}`,
			],
			width: 25,
			sizer: SIZER,
			style: {
				hAlign: string.ALIGN.CENTER,
			},
		});
		const secondaryLines: string[] = combineHorizontalBoxes({
			sizer: SIZER,
			boxes: [strengthLines, agilityLines, intelligenceLines],
		});
		sections.push(buildSectionBox("Secondary Attributes", secondaryLines));

		const miscLines: string[] = [
			`${color("Playtime:", COLOR.YELLOW)} ${character.getFormattedPlaytime()}`,
			`${color(
				"Created:",
				COLOR.YELLOW
			)} ${character.credentials.createdAt.toLocaleString()}`,
			`${color(
				"Last Login:",
				COLOR.YELLOW
			)} ${character.credentials.lastLogin.toLocaleString()}`,
			`${color("Kills:", COLOR.YELLOW)} ${character.stats.kills}`,
			`${color("Deaths:", COLOR.YELLOW)} ${character.stats.deaths}`,
		];
		sections.push(buildSectionBox("Miscellaneous", miscLines));

		const finalOutput = sections.flatMap((section, index) => {
			if (index === 0) return section;
			return [LINEBREAK, ...section];
		});

		const wrapper = string.box({
			input: finalOutput,
			width: 80,
			style: {
				...string.BOX_STYLES.ROUNDED,
				titleHAlign: string.ALIGN.CENTER,
				titleBorder: {
					left: ">",
					right: "<",
				},
			},
			title: `Score`,
			sizer: SIZER,
		});

		actor.sendMessage(wrapper.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
