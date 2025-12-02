/**
 * Attribute system for mobs, including primary attributes, secondary attributes,
 * resource capacities, and helper functions for calculating and manipulating them.
 *
 * Primary attributes (strength, agility, intelligence) are the base stats that
 * determine secondary attributes and resource capacities. Secondary attributes
 * (attackPower, defense, critRate, etc.) are derived from primary attributes.
 * Resource capacities (maxHealth, maxMana) are calculated from base values,
 * secondary attributes, and bonuses.
 *
 * @module attribute
 */

/**
 * Factors for calculating secondary attributes from primary attributes.
 * Each secondary attribute is derived from a weighted combination of primary attributes.
 */
export const SECONDARY_ATTRIBUTE_FACTORS: Readonly<
	Record<keyof SecondaryAttributeSet, Partial<PrimaryAttributeSet>>
> = Object.freeze({
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
	spirit: {}, // Spirit does not scale with primary attributes
});

/**
 * Base values for secondary attributes before primary attribute contributions.
 */
export const SECONDARY_ATTRIBUTE_BASE: Readonly<
	Record<keyof SecondaryAttributeSet, number>
> = Object.freeze({
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
	spirit: 0,
});

/**
 * Health points gained per point of vitality.
 */
export const HEALTH_PER_VITALITY = 2;

/**
 * Mana points gained per point of wisdom.
 */
export const MANA_PER_WISDOM = 2;

/**
 * Number of decimal places to round attributes to.
 */
export const ATTRIBUTE_ROUND_DECIMALS = 2;

/**
 * Primary attribute set representing the three core stats for mobs.
 * These are the base attributes that determine all other derived stats.
 *
 * @property strength - Physical power (affects attack power, vitality, defense)
 * @property agility - Speed and dexterity (affects crit rate, avoidance, accuracy, endurance)
 * @property intelligence - Mental power (affects spell power, wisdom, resilience)
 *
 * @example
 * ```typescript
 * import { PrimaryAttributeSet } from "./attribute.js";
 *
 * const stats: PrimaryAttributeSet = {
 *   strength: 10,
 *   agility: 8,
 *   intelligence: 12
 * };
 * ```
 */
export interface PrimaryAttributeSet {
	strength: number;
	agility: number;
	intelligence: number;
}

/**
 * Secondary attribute set representing derived combat and utility stats for mobs.
 * These attributes are calculated from primary attributes and can be modified by equipment.
 *
 * @property attackPower - Physical damage output (derived from strength, base value only - weapons add their attack power when used)
 * @property vitality - Health capacity modifier (derived from strength, affects max health)
 * @property defense - Damage reduction (derived from strength, modified by armor defense)
 * @property critRate - Critical hit chance (derived from agility)
 * @property avoidance - Dodge chance (derived from agility)
 * @property accuracy - Hit chance (derived from agility)
 * @property endurance - Stamina/energy capacity (derived from agility)
 * @property spellPower - Magical damage output (derived from intelligence)
 * @property wisdom - Mana capacity modifier (derived from intelligence, affects max mana)
 * @property resilience - Magical resistance (derived from intelligence)
 *
 * @example
 * ```typescript
 * import { Mob, Armor, Weapon } from "./dungeon.js";
 * import { EQUIPMENT_SLOT } from "./dungeon.js";
 *
 * const fighter = new Mob();
 * const sword = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 10 });
 * const helmet = new Armor({ slot: EQUIPMENT_SLOT.HEAD, defense: 5 });
 *
 * fighter.equip(sword);
 * fighter.equip(helmet);
 *
 * console.log(fighter.attackPower); // Base attack power from strength (weapons add their power when used)
 * console.log(fighter.defense); // Includes armor bonus
 * ```
 */
export interface SecondaryAttributeSet {
	attackPower: number;
	vitality: number;
	defense: number;
	critRate: number;
	avoidance: number;
	accuracy: number;
	endurance: number;
	spellPower: number;
	wisdom: number;
	resilience: number;
	spirit: number;
}

/**
 * Resource capacity values representing the maximum amounts of health and mana a mob can have.
 * These values are calculated from race/job starting values, level growth, bonuses, and
 * secondary attributes (vitality for health, wisdom for mana).
 *
 * @property maxHealth - Maximum health points (affected by vitality and resource bonuses)
 * @property maxMana - Maximum mana points (affected by wisdom and resource bonuses)
 *
 * @example
 * ```typescript
 * import { Mob, ResourceCapacities } from "./dungeon.js";
 *
 * const mage = new Mob({
 *   resourceBonuses: {
 *     maxMana: 50
 *   } as Partial<ResourceCapacities>
 * });
 *
 * console.log(mage.maxHealth); // Base health + vitality bonus
 * console.log(mage.maxMana); // Base mana + wisdom bonus + equipment bonus
 * ```
 */
export interface ResourceCapacities {
	maxHealth: number;
	maxMana: number;
}

/**
 * Snapshot of current mutable resource values for a mob.
 * Used for persistence and UI display. Values are clamped between 0 and their maximums.
 *
 * @property health - Current health points (0 to maxHealth)
 * @property mana - Current mana points (0 to maxMana)
 * @property exhaustion - Current exhaustion level (0 to 100)
 *
 * @example
 * ```typescript
 * import { Mob } from "./dungeon.js";
 *
 * const player = new Mob();
 * const resources = player.resources;
 *
 * console.log(`HP: ${resources.health}/${player.maxHealth}`);
 * console.log(`MP: ${resources.mana}/${player.maxMana}`);
 * console.log(`Exhaustion: ${resources.exhaustion}%`);
 * ```
 */
export interface ResourceSnapshot {
	health: number;
	mana: number;
	exhaustion: number;
}

/**
 * Clamps a number between min and max values.
 * Returns min if value is not finite.
 *
 * @param value The value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(Math.max(value, min), max);
}

/**
 * Rounds a number to a specified number of decimal places.
 *
 * @param value The value to round
 * @param decimals Number of decimal places
 * @returns Rounded value
 */
export function roundTo(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Converts a value to a finite integer by flooring it, or returns 0 if the value is not finite.
 * Used for creating readonly views of attributes and resources to ensure all values are valid integers.
 *
 * @param value The number to convert
 * @returns Floored finite number, or 0 if the value is not finite
 *
 * @example
 * ```typescript
 * toFinite(10.7); // 10
 * toFinite(Infinity); // 0
 * toFinite(NaN); // 0
 * toFinite(-Infinity); // 0
 * ```
 */
function toFinite(value: number): number {
	const num = Number(value);
	return isFinite(num) ? Math.floor(num) : 0;
}

/**
 * Sums multiple partial primary attribute sets into a complete set.
 *
 * @param components Array of partial primary attribute sets to sum
 * @returns Complete primary attribute set with summed values
 */
export function sumPrimaryAttributes(
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
	return {
		strength,
		agility,
		intelligence,
	};
}

/**
 * Sums multiple partial secondary attribute sets into a complete set.
 *
 * @param components Array of partial secondary attribute sets to sum
 * @returns Complete secondary attribute set with summed values
 */
export function sumSecondaryAttributes(
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
		spirit: 0,
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
		result.spirit += Number(part.spirit ?? 0);
	}
	return result;
}

/**
 * Multiplies a primary attribute set by a factor.
 *
 * @param source The primary attribute set to multiply
 * @param factor The multiplication factor
 * @returns New primary attribute set with multiplied values
 */
export function multiplyPrimaryAttributes(
	source: PrimaryAttributeSet,
	factor: number
): PrimaryAttributeSet {
	return {
		strength: source.strength * factor,
		agility: source.agility * factor,
		intelligence: source.intelligence * factor,
	};
}

/**
 * Sums multiple partial resource capacity sets into a complete set.
 *
 * @param components Array of partial resource capacity sets to sum
 * @returns Complete resource capacity set with summed values
 */
export function sumResourceCaps(
	...components: Array<Partial<ResourceCapacities> | undefined>
): ResourceCapacities {
	let maxHealth = 0;
	let maxMana = 0;
	for (const part of components) {
		if (!part) continue;
		maxHealth += Number(part.maxHealth ?? 0);
		maxMana += Number(part.maxMana ?? 0);
	}
	return {
		maxHealth,
		maxMana,
	};
}

/**
 * Multiplies a resource capacity set by a factor.
 *
 * @param source The resource capacity set to multiply
 * @param factor The multiplication factor
 * @returns New resource capacity set with multiplied values
 */
export function multiplyResourceCaps(
	source: ResourceCapacities,
	factor: number
): ResourceCapacities {
	return {
		maxHealth: source.maxHealth * factor,
		maxMana: source.maxMana * factor,
	};
}

/**
 * Normalizes a partial primary attribute set into a complete set.
 * Missing values default to 0.
 *
 * @param bonuses Optional partial primary attribute set
 * @returns Complete primary attribute set
 */
export function normalizePrimaryBonuses(
	bonuses?: Partial<PrimaryAttributeSet>
): PrimaryAttributeSet {
	return sumPrimaryAttributes(bonuses);
}

/**
 * Normalizes a partial resource capacity set into a complete set.
 * Missing values default to 0.
 *
 * @param bonuses Optional partial resource capacity set
 * @returns Complete resource capacity set
 */
export function normalizeResourceBonuses(
	bonuses?: Partial<ResourceCapacities>
): ResourceCapacities {
	return sumResourceCaps(bonuses);
}

/**
 * Prunes zero values from a primary attribute set.
 * Returns undefined if all values are zero.
 *
 * @param bonuses Primary attribute set to prune
 * @returns Partial primary attribute set with non-zero values, or undefined if all zero
 */
export function prunePrimaryBonuses(
	bonuses: PrimaryAttributeSet
): Partial<PrimaryAttributeSet> | undefined {
	const result: Partial<PrimaryAttributeSet> = {};
	if (bonuses.strength !== 0)
		result.strength = roundTo(bonuses.strength, ATTRIBUTE_ROUND_DECIMALS);
	if (bonuses.agility !== 0)
		result.agility = roundTo(bonuses.agility, ATTRIBUTE_ROUND_DECIMALS);
	if (bonuses.intelligence !== 0)
		result.intelligence = roundTo(
			bonuses.intelligence,
			ATTRIBUTE_ROUND_DECIMALS
		);
	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Prunes zero values from a resource capacity set.
 * Returns undefined if all values are zero.
 *
 * @param bonuses Resource capacity set to prune
 * @returns Partial resource capacity set with non-zero values, or undefined if all zero
 */
export function pruneResourceBonuses(
	bonuses: ResourceCapacities
): Partial<ResourceCapacities> | undefined {
	const result: Partial<ResourceCapacities> = {};
	if (bonuses.maxHealth !== 0)
		result.maxHealth = roundTo(bonuses.maxHealth, ATTRIBUTE_ROUND_DECIMALS);
	if (bonuses.maxMana !== 0)
		result.maxMana = roundTo(bonuses.maxMana, ATTRIBUTE_ROUND_DECIMALS);
	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Computes secondary attributes from primary attributes.
 * Uses SECONDARY_ATTRIBUTE_FACTORS and SECONDARY_ATTRIBUTE_BASE to calculate values.
 *
 * @param primary Primary attribute set to compute from
 * @returns Complete secondary attribute set
 */
export function computeSecondaryAttributes(
	primary: PrimaryAttributeSet
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
		spirit: 0,
	};

	(
		Object.keys(SECONDARY_ATTRIBUTE_FACTORS) as Array<
			keyof SecondaryAttributeSet
		>
	).forEach((key) => {
		const base = SECONDARY_ATTRIBUTE_BASE[key];
		const weights = SECONDARY_ATTRIBUTE_FACTORS[key];
		let value = base;
		if (weights.strength)
			value += primary.strength * Number(weights.strength ?? 0);
		if (weights.agility)
			value += primary.agility * Number(weights.agility ?? 0);
		if (weights.intelligence)
			value += primary.intelligence * Number(weights.intelligence ?? 0);
		result[key] = roundTo(value, ATTRIBUTE_ROUND_DECIMALS);
	});

	return result;
}

/**
 * Creates a readonly view of primary attributes with integer values.
 *
 * @param source Primary attribute set to create view from
 * @returns Readonly primary attribute set with floored values
 */
export function createPrimaryAttributesView(
	source: PrimaryAttributeSet
): Readonly<PrimaryAttributeSet> {
	return Object.freeze({
		strength: toFinite(source.strength),
		agility: toFinite(source.agility),
		intelligence: toFinite(source.intelligence),
	});
}

/**
 * Creates a readonly view of secondary attributes with integer values.
 *
 * @param source Secondary attribute set to create view from
 * @returns Readonly secondary attribute set with floored values
 */
export function createSecondaryAttributesView(
	source: SecondaryAttributeSet
): Readonly<SecondaryAttributeSet> {
	return Object.freeze({
		attackPower: toFinite(source.attackPower),
		vitality: toFinite(source.vitality),
		defense: toFinite(source.defense),
		critRate: toFinite(source.critRate),
		avoidance: toFinite(source.avoidance),
		accuracy: toFinite(source.accuracy),
		endurance: toFinite(source.endurance),
		spellPower: toFinite(source.spellPower),
		wisdom: toFinite(source.wisdom),
		resilience: toFinite(source.resilience),
		spirit: toFinite(source.spirit),
	});
}

/**
 * Creates a readonly view of resource capacities with integer values.
 *
 * @param source Resource capacity set to create view from
 * @returns Readonly resource capacity set with floored values
 */
export function createResourceCapsView(
	source: ResourceCapacities
): Readonly<ResourceCapacities> {
	return Object.freeze({
		maxHealth: toFinite(source.maxHealth),
		maxMana: toFinite(source.maxMana),
	});
}
