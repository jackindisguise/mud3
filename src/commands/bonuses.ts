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

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Equipment, Armor, Weapon } from "../core/dungeon.js";
import {
	PrimaryAttributeSet,
	SecondaryAttributeSet,
	ResourceCapacities,
	sumPrimaryAttributes,
	multiplyPrimaryAttributes,
	sumResourceCaps,
	multiplyResourceCaps,
	sumSecondaryAttributes,
	SECONDARY_ATTRIBUTE_FACTORS,
	HEALTH_PER_VITALITY,
	MANA_PER_WISDOM,
} from "../core/attribute.js";
import { CommandObject } from "../package/commands.js";
import { LINEBREAK } from "../core/telnet.js";
import { COLOR, color } from "../core/color.js";

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
		const job = mob.job;
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

		// Calculate job bonuses
		const jobAttributeBonuses = sumPrimaryAttributes(
			job.startingAttributes,
			multiplyPrimaryAttributes(job.attributeGrowthPerLevel, levelStages)
		);
		const jobResourceBonuses = sumResourceCaps(
			job.startingResourceCaps,
			multiplyResourceCaps(job.resourceGrowthPerLevel, levelStages)
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
			jobAttributeBonuses,
			totalEquipmentAttributeBonuses,
			mobAttributeBonuses
		);

		// Calculate secondary attribute contributions from primary attributes
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
			const jobBonus = jobAttributeBonuses[attr] || 0;
			const equipmentBonus = totalEquipmentAttributeBonuses[attr] || 0;
			const mobBonus = mobAttributeBonuses[attr] || 0;
			const total = raceBonus + jobBonus + equipmentBonus + mobBonus;

			if (
				total !== 0 ||
				raceBonus !== 0 ||
				jobBonus !== 0 ||
				equipmentBonus !== 0 ||
				mobBonus !== 0
			) {
				const attrName = formatAttributeName(attr);
				const parts: string[] = [];
				if (raceBonus !== 0) parts.push(`Race: ${formatBonus(raceBonus)}`);
				if (jobBonus !== 0) parts.push(`Job: ${formatBonus(jobBonus)}`);
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
			const jobBonus = jobResourceBonuses[attr] || 0;
			const equipmentBonus = totalEquipmentResourceBonuses[attr] || 0;
			const mobBonus = mobResourceBonuses[attr] || 0;
			const fromAttributes =
				attr === "maxHealth" ? healthFromVitality : manaFromWisdom;
			const total =
				raceBonus + jobBonus + equipmentBonus + mobBonus + fromAttributes;

			if (
				total !== 0 ||
				raceBonus !== 0 ||
				jobBonus !== 0 ||
				equipmentBonus !== 0 ||
				mobBonus !== 0 ||
				fromAttributes !== 0
			) {
				const attrName = formatAttributeName(attr);
				const parts: string[] = [];
				if (fromAttributes !== 0)
					parts.push(`From Attributes: ${formatBonus(fromAttributes)}`);
				if (raceBonus !== 0) parts.push(`Race: ${formatBonus(raceBonus)}`);
				if (jobBonus !== 0) parts.push(`Job: ${formatBonus(jobBonus)}`);
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
