/**
 * Bonuses command for viewing all attribute and resource bonuses.
 *
 * Shows bonuses from race, class, and equipment.
 *
 * @example
 * ```
 * bonuses
 * ```
 *
 * **Patterns:**
 * - `bonuses` - Show all bonuses
 * @module commands/bonuses
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Equipment, Armor, Weapon } from "../dungeon.js";
import {
	PrimaryAttributeSet,
	SecondaryAttributeSet,
	ResourceCapacities,
} from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { LINEBREAK } from "../telnet.js";
import { COLOR, color } from "../color.js";

// Helper functions to sum bonuses (duplicated from dungeon.ts since they're not exported)
function sumPrimaryAttributes(
	...components: Array<Partial<PrimaryAttributeSet> | undefined>
): PrimaryAttributeSet {
	let strength = 0;
	let agility = 0;
	let intelligence = 0;
	for (const part of components) {
		if (!part) continue;
		strength += Number(part.strength ?? 0);
		agility += Number(part.agility ?? 0);
		intelligence += Number(part.intelligence ?? 0);
	}
	return { strength, agility, intelligence };
}

function multiplyPrimaryAttributes(
	source: PrimaryAttributeSet,
	factor: number
): PrimaryAttributeSet {
	return {
		strength: source.strength * factor,
		agility: source.agility * factor,
		intelligence: source.intelligence * factor,
	};
}

function sumResourceCaps(
	...components: Array<Partial<ResourceCapacities> | undefined>
): ResourceCapacities {
	let maxHealth = 0;
	let maxMana = 0;
	for (const part of components) {
		if (!part) continue;
		maxHealth += Number(part.maxHealth ?? 0);
		maxMana += Number(part.maxMana ?? 0);
	}
	return { maxHealth, maxMana };
}

function multiplyResourceCaps(
	source: ResourceCapacities,
	factor: number
): ResourceCapacities {
	return {
		maxHealth: source.maxHealth * factor,
		maxMana: source.maxMana * factor,
	};
}

function sumSecondaryAttributes(
	...components: Array<Partial<SecondaryAttributeSet> | undefined>
): SecondaryAttributeSet {
	const result: SecondaryAttributeSet = {
		attackPower: 0,
		vitality: 0,
		defense: 0,
		critRate: 0,
		avoidance: 0,
		accuracy: 0,
		endurance: 0,
		spellPower: 0,
		wisdom: 0,
		resilience: 0,
	};
	for (const part of components) {
		if (!part) continue;
		result.attackPower += Number(part.attackPower ?? 0);
		result.vitality += Number(part.vitality ?? 0);
		result.defense += Number(part.defense ?? 0);
		result.critRate += Number(part.critRate ?? 0);
		result.avoidance += Number(part.avoidance ?? 0);
		result.accuracy += Number(part.accuracy ?? 0);
		result.endurance += Number(part.endurance ?? 0);
		result.spellPower += Number(part.spellPower ?? 0);
		result.wisdom += Number(part.wisdom ?? 0);
		result.resilience += Number(part.resilience ?? 0);
	}
	return result;
}

/**
 * Format a number with a sign prefix for display.
 */
function formatBonus(value: number): string {
	if (value === 0) return "0";
	return value > 0 ? `+${value}` : `${value}`;
}

/**
 * Format attribute name for display.
 */
function formatAttributeName(name: string): string {
	return name
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

export default {
	pattern: "bonuses~",
	aliases: [],
	execute(context: CommandContext): void {
		const { actor } = context;
		const mob = actor;
		const race = mob.race;
		const clazz = mob.class;
		const level = mob.level;
		const levelStages = Math.max(0, level - 1);

		const lines: string[] = [];

		// Calculate race bonuses
		const raceAttributeBonuses = sumPrimaryAttributes(
			race.startingAttributes,
			multiplyPrimaryAttributes(race.attributeGrowthPerLevel, levelStages)
		);
		const raceResourceBonuses = sumResourceCaps(
			race.startingResourceCaps,
			multiplyResourceCaps(race.resourceGrowthPerLevel, levelStages)
		);

		// Calculate class bonuses
		const classAttributeBonuses = sumPrimaryAttributes(
			clazz.startingAttributes,
			multiplyPrimaryAttributes(clazz.attributeGrowthPerLevel, levelStages)
		);
		const classResourceBonuses = sumResourceCaps(
			clazz.startingResourceCaps,
			multiplyResourceCaps(clazz.resourceGrowthPerLevel, levelStages)
		);

		// Calculate equipment bonuses
		const equipmentAttributeBonuses: Partial<PrimaryAttributeSet>[] = [];
		const equipmentResourceBonuses: Partial<ResourceCapacities>[] = [];
		const equipmentSecondaryBonuses: Partial<SecondaryAttributeSet>[] = [];
		let totalArmorDefense = 0;
		let totalWeaponAttackPower = 0;

		for (const equipment of mob.getAllEquipped()) {
			if (equipment.attributeBonuses) {
				equipmentAttributeBonuses.push(equipment.attributeBonuses);
			}
			if (equipment.resourceBonuses) {
				equipmentResourceBonuses.push(equipment.resourceBonuses);
			}
			if (equipment.secondaryAttributeBonuses) {
				equipmentSecondaryBonuses.push(equipment.secondaryAttributeBonuses);
			}
			if (equipment instanceof Armor) {
				totalArmorDefense += equipment.defense;
			} else if (equipment instanceof Weapon) {
				totalWeaponAttackPower += equipment.attackPower;
			}
		}

		const totalEquipmentAttributeBonuses = sumPrimaryAttributes(
			...equipmentAttributeBonuses
		);
		const totalEquipmentResourceBonuses = sumResourceCaps(
			...equipmentResourceBonuses
		);
		const totalEquipmentSecondaryBonuses = sumSecondaryAttributes(
			...equipmentSecondaryBonuses
		);

		// Get direct mob bonuses
		const mobAttributeBonuses = mob.attributeBonuses;
		const mobResourceBonuses = mob.resourceBonuses;

		// Calculate total primary attributes (for deriving secondary attributes)
		const totalPrimaryAttributes = sumPrimaryAttributes(
			raceAttributeBonuses,
			classAttributeBonuses,
			totalEquipmentAttributeBonuses,
			mobAttributeBonuses
		);

		// Calculate secondary attribute contributions from primary attributes
		const SECONDARY_ATTRIBUTE_FACTORS: Record<
			keyof SecondaryAttributeSet,
			Partial<PrimaryAttributeSet>
		> = {
			attackPower: { strength: 0.5 },
			vitality: { strength: 0.5 },
			defense: { strength: 0.5 },
			critRate: { agility: 0.2 },
			avoidance: { agility: 0.2 },
			accuracy: { agility: 0.2 },
			endurance: { agility: 1 },
			spellPower: { intelligence: 0.5 },
			wisdom: { intelligence: 0.5 },
			resilience: { intelligence: 0.5 },
		};

		function calculateSecondaryFromPrimary(
			attr: keyof SecondaryAttributeSet
		): number {
			const factors = SECONDARY_ATTRIBUTE_FACTORS[attr];
			let value = 0;
			if (factors.strength)
				value += totalPrimaryAttributes.strength * factors.strength;
			if (factors.agility)
				value += totalPrimaryAttributes.agility * factors.agility;
			if (factors.intelligence)
				value += totalPrimaryAttributes.intelligence * factors.intelligence;
			return Math.round((value + Number.EPSILON) * 100) / 100; // Round to 2 decimals
		}

		// Calculate resource contributions from secondary attributes
		const HEALTH_PER_VITALITY = 2;
		const MANA_PER_WISDOM = 2;
		const vitalityFromPrimary = calculateSecondaryFromPrimary("vitality");
		const wisdomFromPrimary = calculateSecondaryFromPrimary("wisdom");
		const healthFromVitality = vitalityFromPrimary * HEALTH_PER_VITALITY;
		const manaFromWisdom = wisdomFromPrimary * MANA_PER_WISDOM;

		// Header
		lines.push(color("=== Bonuses ===", COLOR.CYAN));
		lines.push("");

		// Primary Attributes
		lines.push(color("Primary Attributes:", COLOR.YELLOW));
		const primaryAttrs: (keyof PrimaryAttributeSet)[] = [
			"strength",
			"agility",
			"intelligence",
		];

		for (const attr of primaryAttrs) {
			const raceBonus = raceAttributeBonuses[attr] || 0;
			const classBonus = classAttributeBonuses[attr] || 0;
			const equipmentBonus = totalEquipmentAttributeBonuses[attr] || 0;
			const mobBonus = mobAttributeBonuses[attr] || 0;
			const total = raceBonus + classBonus + equipmentBonus + mobBonus;

			if (
				total !== 0 ||
				raceBonus !== 0 ||
				classBonus !== 0 ||
				equipmentBonus !== 0 ||
				mobBonus !== 0
			) {
				const attrName = formatAttributeName(attr);
				const parts: string[] = [];
				if (raceBonus !== 0) parts.push(`Race: ${formatBonus(raceBonus)}`);
				if (classBonus !== 0) parts.push(`Class: ${formatBonus(classBonus)}`);
				if (equipmentBonus !== 0)
					parts.push(`Equipment: ${formatBonus(equipmentBonus)}`);
				if (mobBonus !== 0) parts.push(`Other: ${formatBonus(mobBonus)}`);
				const partsStr = parts.length > 0 ? ` (${parts.join(", ")})` : "";
				lines.push(
					`  ${attrName.padEnd(15)}: ${formatBonus(total)}${partsStr}`
				);
			}
		}

		lines.push("");

		// Secondary Attributes
		lines.push(color("Secondary Attributes:", COLOR.YELLOW));
		const secondaryAttrs: (keyof SecondaryAttributeSet)[] = [
			"attackPower",
			"vitality",
			"defense",
			"critRate",
			"avoidance",
			"accuracy",
			"endurance",
			"spellPower",
			"wisdom",
			"resilience",
		];

		for (const attr of secondaryAttrs) {
			const equipmentBonus = totalEquipmentSecondaryBonuses[attr] || 0;
			const fromPrimary = calculateSecondaryFromPrimary(attr);
			let total = equipmentBonus + fromPrimary;

			// Add armor defense and weapon attack power
			if (attr === "defense" && totalArmorDefense > 0) {
				total += totalArmorDefense;
			}
			if (attr === "attackPower" && totalWeaponAttackPower > 0) {
				total += totalWeaponAttackPower;
			}

			if (
				total !== 0 ||
				equipmentBonus !== 0 ||
				fromPrimary !== 0 ||
				(attr === "defense" && totalArmorDefense > 0) ||
				(attr === "attackPower" && totalWeaponAttackPower > 0)
			) {
				const attrName = formatAttributeName(attr);
				const parts: string[] = [];
				if (fromPrimary !== 0)
					parts.push(`From Attributes: ${formatBonus(fromPrimary)}`);
				if (equipmentBonus !== 0)
					parts.push(`Equipment: ${formatBonus(equipmentBonus)}`);
				if (attr === "defense" && totalArmorDefense > 0) {
					parts.push(`Armor: ${formatBonus(totalArmorDefense)}`);
				}
				if (attr === "attackPower" && totalWeaponAttackPower > 0) {
					parts.push(`Weapons: ${formatBonus(totalWeaponAttackPower)}`);
				}
				const partsStr = parts.length > 0 ? ` (${parts.join(", ")})` : "";
				lines.push(
					`  ${attrName.padEnd(15)}: ${formatBonus(total)}${partsStr}`
				);
			}
		}

		lines.push("");

		// Resource Capacities
		lines.push(color("Resource Capacities:", COLOR.YELLOW));
		const resourceAttrs: (keyof ResourceCapacities)[] = [
			"maxHealth",
			"maxMana",
		];

		for (const attr of resourceAttrs) {
			const raceBonus = raceResourceBonuses[attr] || 0;
			const classBonus = classResourceBonuses[attr] || 0;
			const equipmentBonus = totalEquipmentResourceBonuses[attr] || 0;
			const mobBonus = mobResourceBonuses[attr] || 0;
			const fromAttributes =
				attr === "maxHealth" ? healthFromVitality : manaFromWisdom;
			const total =
				raceBonus + classBonus + equipmentBonus + mobBonus + fromAttributes;

			if (
				total !== 0 ||
				raceBonus !== 0 ||
				classBonus !== 0 ||
				equipmentBonus !== 0 ||
				mobBonus !== 0 ||
				fromAttributes !== 0
			) {
				const attrName = formatAttributeName(attr);
				const parts: string[] = [];
				if (fromAttributes !== 0)
					parts.push(`From Attributes: ${formatBonus(fromAttributes)}`);
				if (raceBonus !== 0) parts.push(`Race: ${formatBonus(raceBonus)}`);
				if (classBonus !== 0) parts.push(`Class: ${formatBonus(classBonus)}`);
				if (equipmentBonus !== 0)
					parts.push(`Equipment: ${formatBonus(equipmentBonus)}`);
				if (mobBonus !== 0) parts.push(`Other: ${formatBonus(mobBonus)}`);
				const partsStr = parts.length > 0 ? ` (${parts.join(", ")})` : "";
				lines.push(
					`  ${attrName.padEnd(15)}: ${formatBonus(total)}${partsStr}`
				);
			}
		}

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
