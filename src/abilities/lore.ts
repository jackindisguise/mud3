/**
 * Lore ability - Provides in-depth details of an item in vision.
 *
 * Shows detailed information about items in a formatted box:
 * - For containers: shows holding capacity, value, and weight
 * - For equipment: shows slot and bonuses in a grid
 * - For weapons: shows attack power and bonuses
 * - For armor: shows defense and bonuses
 *
 * @example
 * ```
 * lore sword
 * lore bag
 * ```
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Item, Equipment, Weapon, Armor } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { getSlotNames } from "../core/equipment.js";
import { formatNumber } from "../utils/number.js";
import { string } from "mud-ext";
import { SIZER } from "../core/color.js";

export const ABILITY_ID = "lore";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Lore",
	description: "Examine an item in detail to learn its properties.",
	proficiencyCurve: [10, 25, 50, 100],
};

export const COOLDOWN_MS = 1000;

export const BOX_WIDTH = 80;

/**
 * Format a bonus value with sign.
 */
function formatBonus(value: number): string {
	return value > 0 ? `+${value}` : `${value}`;
}

/**
 * Format attribute name for display (e.g., "critRate" -> "crit. rate").
 */
function formatAttributeName(name: string): string {
	const specialCases: Record<string, string> = {
		critRate: "crit. rate",
		attackPower: "attack power",
		spellPower: "spell power",
	};
	if (specialCases[name]) {
		return specialCases[name];
	}
	return name.replace(/([A-Z])/g, " $1").toLowerCase();
}

/**
 * Format bonuses in a 3-column grid.
 */
function formatBonusGrid(
	bonuses: Record<string, number | undefined>
): string[] {
	const entries: Array<[string, number]> = [];
	for (const [key, value] of Object.entries(bonuses)) {
		if (value !== undefined && value !== 0) {
			entries.push([key, value]);
		}
	}

	if (entries.length === 0) {
		return [];
	}

	const lines: string[] = [];
	const itemsPerLine = 3;
	const itemWidth = 24; // Each bonus item is 24 characters wide

	for (let i = 0; i < entries.length; i += itemsPerLine) {
		const lineItems = entries.slice(i, i + itemsPerLine);
		const parts: string[] = [];
		for (const [key, value] of lineItems) {
			const bonusStr = formatBonus(value);
			const name = formatAttributeName(key);
			// Format: bonus (3 chars) + 2 spaces + name (padded to total 24 chars)
			const bonusPart = `${bonusStr.padStart(3)}  ${name}`;
			parts.push(bonusPart.padEnd(itemWidth));
		}
		// Join parts and pad to fit box width
		const content = parts.join("");
		lines.push(content);
	}
	return lines;
}

/**
 * Format container lore box.
 */
export function formatContainerBox(item: Item): string[] {
	const content: string[] = [];

	// Title line: item name on left, "Container" on right
	const itemCount = item.contents.length;
	const holding = `Holding: ${itemCount} item${itemCount !== 1 ? "s" : ""}`;
	const padding = BOX_WIDTH - 4 - holding.length - "Container".length;
	const holdingLine = `Container${" ".repeat(padding)}${holding}`;
	content.push(holdingLine);

	// Holding line
	content.push();

	// Value and weight line
	const valueStr =
		item.value > 0 ? `${formatNumber(item.value)} gold` : "0 gold";
	const weightStr = `${formatNumber(item.baseWeight)}lbs`;
	const valueWeightPadding =
		BOX_WIDTH - 4 - `Value: ${valueStr}`.length - `Weight: ${weightStr}`.length;
	const valueWeightLine = `Value: ${valueStr}${" ".repeat(
		valueWeightPadding
	)}Weight: ${weightStr}`;
	content.push(valueWeightLine);

	return string.box({
		input: content,
		width: BOX_WIDTH,
		sizer: SIZER,
		title: item.display,
		style: {
			...string.BOX_STYLES.PLAIN,
		},
	});
}

/**
 * Format equipment lore box.
 */
export function formatEquipmentBox(
	item: Equipment,
	isArmor: boolean = false,
	isWeapon: boolean = false
): string[] {
	const content: string[] = [];
	const slotNames = getSlotNames();
	const slotName = slotNames[item.slot];

	// Type and slot line
	const typeName = isWeapon ? "Weapon" : isArmor ? "Armor" : "Equipment";
	const typeSlotLine = `${typeName}${" ".repeat(
		BOX_WIDTH - 4 - typeName.length - slotName.length
	)}${slotName}`;
	content.push(typeSlotLine);

	// Defense (for armor)
	if (isArmor && item instanceof Armor) {
		content.push(`Defense: ${item.defense}`);
	}

	// Attack Power (for weapons)
	if (isWeapon && item instanceof Weapon) {
		content.push(`Attack Power: ${item.attackPower}`);
	}

	// Primary attribute bonuses (for weapons)
	const attrBonuses: Record<string, number> = {};
	if (item.attributeBonuses.strength) {
		attrBonuses.strength = item.attributeBonuses.strength;
	}
	if (item.attributeBonuses.agility) {
		attrBonuses.agility = item.attributeBonuses.agility;
	}
	if (item.attributeBonuses.intelligence) {
		attrBonuses.intelligence = item.attributeBonuses.intelligence;
	}
	const attrBonusesLines = formatBonusGrid(attrBonuses);
	if (attrBonusesLines.length > 0) {
		const subbox = string.box({
			input: attrBonusesLines,
			width: BOX_WIDTH - 4,
			sizer: SIZER,
			style: {
				hPadding: 2,
			},
			title: "Primary Attribute Bonuses",
		});
		content.push(subbox.join("\r\n"));
	}

	// Secondary attribute bonuses
	const secBonuses: Record<string, number> = {};
	if (item.secondaryAttributeBonuses.attackPower !== undefined) {
		secBonuses.attackPower = item.secondaryAttributeBonuses.attackPower;
	}
	if (item.secondaryAttributeBonuses.vitality !== undefined) {
		secBonuses.vitality = item.secondaryAttributeBonuses.vitality;
	}
	if (item.secondaryAttributeBonuses.defense !== undefined) {
		secBonuses.defense = item.secondaryAttributeBonuses.defense;
	}
	if (item.secondaryAttributeBonuses.critRate !== undefined) {
		secBonuses.critRate = item.secondaryAttributeBonuses.critRate;
	}
	if (item.secondaryAttributeBonuses.avoidance !== undefined) {
		secBonuses.avoidance = item.secondaryAttributeBonuses.avoidance;
	}
	if (item.secondaryAttributeBonuses.accuracy !== undefined) {
		secBonuses.accuracy = item.secondaryAttributeBonuses.accuracy;
	}
	if (item.secondaryAttributeBonuses.endurance !== undefined) {
		secBonuses.endurance = item.secondaryAttributeBonuses.endurance;
	}
	if (item.secondaryAttributeBonuses.spellPower !== undefined) {
		secBonuses.spellPower = item.secondaryAttributeBonuses.spellPower;
	}
	if (item.secondaryAttributeBonuses.wisdom !== undefined) {
		secBonuses.wisdom = item.secondaryAttributeBonuses.wisdom;
	}
	if (item.secondaryAttributeBonuses.resilience !== undefined) {
		secBonuses.resilience = item.secondaryAttributeBonuses.resilience;
	}
	if (item.secondaryAttributeBonuses.spirit !== undefined) {
		secBonuses.spirit = item.secondaryAttributeBonuses.spirit;
	}
	const secBonusesLines = formatBonusGrid(secBonuses);
	if (secBonusesLines.length > 0) {
		const subbox = string.box({
			input: secBonusesLines,
			width: BOX_WIDTH,
			sizer: SIZER,
			style: {
				hPadding: 3,
				top: {
					middle: "-",
				},
			},
			title: "Secondary Attribute Bonuses",
		});
		content.push(subbox.join("\r\n"));
	}

	// Value and weight line
	const valueStr =
		item.value > 0 ? `${formatNumber(item.value)} gold` : "0 gold";
	const weightStr = `${formatNumber(item.baseWeight)}lbs`;
	const valueWeightPadding =
		BOX_WIDTH - 4 - `Value: ${valueStr}`.length - `Weight: ${weightStr}`.length;
	const valueWeightLine = `Value: ${valueStr}${" ".repeat(
		valueWeightPadding
	)}Weight: ${weightStr}`;
	content.push(valueWeightLine);

	// Create box with special title format for equipment
	const box = string.box({
		input: content,
		width: BOX_WIDTH,
		sizer: SIZER,
		style: {
			...string.BOX_STYLES.PLAIN,
			top: {
				left: "+-",
				middle: "-",
				right: "+",
			},
		},
		title: item.display,
	});

	return box;
}

export const command: CommandObject = {
	pattern: "lore <item:object>",
	cooldown(context: CommandContext, args: Map<string, any>) {
		const { actor, room } = context;
		if (!actor.knowsAbilityById(ABILITY_ID)) {
			return 0;
		}
		if (!room) {
			return 0;
		}
		const item = args.get("item") as Item | undefined;
		if (!item) {
			return 0;
		}
		return COOLDOWN_MS;
	},
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;

		if (!actor.knowsAbilityById(ABILITY_ID)) {
			actor.sendMessage(
				"You don't know that ability.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const item = args.get("item") as Item | undefined;
		if (!item) {
			actor.sendMessage(
				"You don't see that here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if item is in vision (in room or in actor's inventory)
		const itemLocation = item.location;
		if (itemLocation !== room && itemLocation !== actor) {
			actor.sendMessage(
				"You don't see that here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const proficiency = actor.learnedAbilities.get(ABILITY_ID) ?? 100;
		const baseSuccess = 0.5;
		const success = baseSuccess + (proficiency / 100) * (1 - baseSuccess);
		if (Math.random() > success) {
			actor.sendMessage(
				"You can't seem to grasp the details...",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Build lore information based on item type
		let lines: string[] = [];

		if (item instanceof Item && item.isContainer) {
			// Container format
			lines = formatContainerBox(item);
		} else if (item instanceof Weapon) {
			// Weapon format
			lines = formatEquipmentBox(item, false, true);
		} else if (item instanceof Armor) {
			// Armor format
			lines = formatEquipmentBox(item, true, false);
		} else if (item instanceof Equipment) {
			// Equipment format
			lines = formatEquipmentBox(item, false, false);
		} else {
			// Fallback for regular items
			const content: string[] = [];
			const valueStr =
				item.value > 0 ? `${formatNumber(item.value)} gold` : "0 gold";
			const weightStr = `${formatNumber(item.baseWeight)}lbs`;
			const valueWeightLine = `Value: ${valueStr}${" ".repeat(
				BOX_WIDTH -
					2 -
					`Value: ${valueStr}`.length -
					`Weight: ${weightStr}`.length
			)}Weight: ${weightStr}`;
			content.push(valueWeightLine);
			lines = string.box({
				input: content,
				width: BOX_WIDTH,
				sizer: SIZER,
				style: {
					...string.BOX_STYLES.PLAIN,
				},
				title: item.display,
			});
		}

		// Send the lore information
		actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);

		actor.useAbility(ability, 1);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("item")) {
			context.actor.sendMessage(
				"What item do you want to examine?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
};
