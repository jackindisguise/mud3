/**
 * Damage types and relationships system.
 *
 * Defines damage types (physical and magical), damage relationships (resist, immune, vulnerable),
 * and provides utilities for calculating damage based on these relationships.
 *
 * @module damage-types
 */

/**
 * Physical damage types.
 */
export enum PHYSICAL_DAMAGE_TYPE {
	SLASH = "SLASH",
	STAB = "STAB",
	CRUSH = "CRUSH",
	EXOTIC = "EXOTIC",
}

/**
 * Magical damage types.
 */
export enum MAGICAL_DAMAGE_TYPE {
	FIRE = "FIRE",
	ICE = "ICE",
	ELECTRIC = "ELECTRIC",
	WATER = "WATER",
	RADIANT = "RADIANT",
	NECROTIC = "NECROTIC",
	PSYCHIC = "PSYCHIC",
	FORCE = "FORCE",
	THUNDER = "THUNDER",
	POISON = "POISON",
	ACID = "ACID",
}

/**
 * All damage types combined.
 */
export type DAMAGE_TYPE = PHYSICAL_DAMAGE_TYPE | MAGICAL_DAMAGE_TYPE;

/**
 * Damage relationship types that determine how damage is modified.
 */
export enum DAMAGE_RELATIONSHIP {
	/** 50% damage reduction */
	RESIST = "RESIST",
	/** 100% damage reduction (no damage) */
	IMMUNE = "IMMUNE",
	/** 100% damage increase (double damage) */
	VULNERABLE = "VULNERABLE",
}

/**
 * Damage type relationships map.
 * Each key is a damage type, and each value is the relationship (RESIST, IMMUNE, or VULNERABLE).
 * Missing damage types are treated as normal (no modification).
 */
export type DamageTypeRelationships = Partial<
	Record<DAMAGE_TYPE, DAMAGE_RELATIONSHIP>
>;

import { COLOR } from "./color.js";

/**
 * Hit type definition.
 * Associates a verb word with a damage type.
 *
 * @property verb - The verb in base form for first person ("You punch")
 * @property verbThirdPerson - Optional third person singular form ("punches"). If not provided, auto-conjugates by adding 's' or 'es'.
 * @property damageType - The damage type associated with this hit type
 * @property color - Optional color for the verb in combat messages. Defaults to COLOR.WHITE if not specified.
 */
export interface HitType {
	/** The verb in base form for first person ("You punch") */
	verb: string;
	/** Optional third person singular form ("punches"). If not provided, auto-conjugates by adding 's' or 'es'. */
	verbThirdPerson?: string;
	/** The damage type associated with this hit type */
	damageType: DAMAGE_TYPE;
	/** Optional color for the verb in combat messages. Defaults to COLOR.WHITE if not specified. */
	color?: COLOR;
}

/**
 * Conjugates a verb to third person singular form.
 * Handles regular verbs (adds 's' or 'es') and can be overridden with verbThirdPerson.
 *
 * @param verb The base verb form
 * @returns Third person singular form
 */
function conjugateThirdPerson(verb: string): string {
	// Handle verbs ending in s, x, z, ch, sh (add 'es')
	if (/[sxz]|[cs]h$/.test(verb)) {
		return `${verb}es`;
	}
	// Handle verbs ending in y preceded by a consonant (change y to ies)
	if (/[^aeiou]y$/.test(verb)) {
		return `${verb.slice(0, -1)}ies`;
	}
	// Default: add 's'
	return `${verb}s`;
}

/**
 * Default hit type for unarmed attacks.
 */
export const DEFAULT_HIT_TYPE: HitType = {
	verb: "punch",
	verbThirdPerson: "punches",
	damageType: PHYSICAL_DAMAGE_TYPE.CRUSH,
	color: COLOR.WHITE,
};

/**
 * Gets the third person singular form of a verb from a hit type.
 *
 * @param hitType The hit type containing the verb
 * @returns Third person singular form of the verb
 */
export function getThirdPersonVerb(hitType: HitType): string {
	return hitType.verbThirdPerson ?? conjugateThirdPerson(hitType.verb);
}

/**
 * Common hit type mappings.
 * These can be used as defaults for weapons.
 */
export const COMMON_HIT_TYPES: ReadonlyMap<string, HitType> = new Map([
	// Physical hit types
	[
		"slash",
		{
			verb: "slash",
			verbThirdPerson: "slashes",
			damageType: PHYSICAL_DAMAGE_TYPE.SLASH,
			color: COLOR.WHITE,
		},
	],
	[
		"stab",
		{
			verb: "stab",
			verbThirdPerson: "stabs",
			damageType: PHYSICAL_DAMAGE_TYPE.STAB,
			color: COLOR.WHITE,
		},
	],
	[
		"cut",
		{
			verb: "cut",
			verbThirdPerson: "cuts",
			damageType: PHYSICAL_DAMAGE_TYPE.SLASH,
			color: COLOR.WHITE,
		},
	],
	[
		"crush",
		{
			verb: "crush",
			verbThirdPerson: "crushes",
			damageType: PHYSICAL_DAMAGE_TYPE.CRUSH,
			color: COLOR.WHITE,
		},
	],
	[
		"bludgeon",
		{
			verb: "bludgeon",
			verbThirdPerson: "bludgeons",
			damageType: PHYSICAL_DAMAGE_TYPE.CRUSH,
			color: COLOR.WHITE,
		},
	],
	[
		"bite",
		{
			verb: "bite",
			verbThirdPerson: "bites",
			damageType: PHYSICAL_DAMAGE_TYPE.EXOTIC,
			color: COLOR.WHITE,
		},
	],
	[
		"sting",
		{
			verb: "sting",
			verbThirdPerson: "stings",
			damageType: PHYSICAL_DAMAGE_TYPE.EXOTIC,
			color: COLOR.WHITE,
		},
	],
	// Magical hit types
	[
		"burn",
		{
			verb: "burn",
			verbThirdPerson: "burns",
			damageType: MAGICAL_DAMAGE_TYPE.FIRE,
			color: COLOR.CRIMSON,
		},
	],
	[
		"singe",
		{
			verb: "singe",
			verbThirdPerson: "singes",
			damageType: MAGICAL_DAMAGE_TYPE.FIRE,
			color: COLOR.CRIMSON,
		},
	],
	[
		"scorch",
		{
			verb: "scorch",
			verbThirdPerson: "scorches",
			damageType: MAGICAL_DAMAGE_TYPE.FIRE,
			color: COLOR.CRIMSON,
		},
	],
	[
		"freeze",
		{
			verb: "freeze",
			verbThirdPerson: "freezes",
			damageType: MAGICAL_DAMAGE_TYPE.ICE,
			color: COLOR.CYAN,
		},
	],
	[
		"shock",
		{
			verb: "shock",
			verbThirdPerson: "shocks",
			damageType: MAGICAL_DAMAGE_TYPE.ELECTRIC,
			color: COLOR.YELLOW,
		},
	],
	[
		"zap",
		{
			verb: "zap",
			verbThirdPerson: "zaps",
			damageType: MAGICAL_DAMAGE_TYPE.ELECTRIC,
			color: COLOR.YELLOW,
		},
	],
	[
		"drench",
		{
			verb: "drench",
			verbThirdPerson: "drenches",
			damageType: MAGICAL_DAMAGE_TYPE.WATER,
			color: COLOR.LIGHT_BLUE,
		},
	],
	[
		"melt",
		{
			verb: "melt",
			verbThirdPerson: "melts",
			damageType: MAGICAL_DAMAGE_TYPE.ACID,
			color: COLOR.OLIVE,
		},
	],
	[
		"dissolve",
		{
			verb: "dissolve",
			verbThirdPerson: "dissolves",
			damageType: MAGICAL_DAMAGE_TYPE.ACID,
			color: COLOR.OLIVE,
		},
	],
	// Radiant damage types
	[
		"smite",
		{
			verb: "smite",
			verbThirdPerson: "smites",
			damageType: MAGICAL_DAMAGE_TYPE.RADIANT,
			color: COLOR.YELLOW,
		},
	],
	[
		"purify",
		{
			verb: "purify",
			verbThirdPerson: "purifies",
			damageType: MAGICAL_DAMAGE_TYPE.RADIANT,
			color: COLOR.YELLOW,
		},
	],
	[
		"sear",
		{
			verb: "sear",
			verbThirdPerson: "sears",
			damageType: MAGICAL_DAMAGE_TYPE.RADIANT,
			color: COLOR.YELLOW,
		},
	],
	[
		"illuminate",
		{
			verb: "illuminate",
			verbThirdPerson: "illuminates",
			damageType: MAGICAL_DAMAGE_TYPE.RADIANT,
			color: COLOR.YELLOW,
		},
	],
	// Necrotic damage types
	[
		"wither",
		{
			verb: "wither",
			verbThirdPerson: "withers",
			damageType: MAGICAL_DAMAGE_TYPE.NECROTIC,
			color: COLOR.PURPLE,
		},
	],
	[
		"decay",
		{
			verb: "decay",
			verbThirdPerson: "decays",
			damageType: MAGICAL_DAMAGE_TYPE.NECROTIC,
			color: COLOR.PURPLE,
		},
	],
	[
		"drain",
		{
			verb: "drain",
			verbThirdPerson: "drains",
			damageType: MAGICAL_DAMAGE_TYPE.NECROTIC,
			color: COLOR.PURPLE,
		},
	],
	[
		"corrupt",
		{
			verb: "corrupt",
			verbThirdPerson: "corrupts",
			damageType: MAGICAL_DAMAGE_TYPE.NECROTIC,
			color: COLOR.PURPLE,
		},
	],
	[
		"blight",
		{
			verb: "blight",
			verbThirdPerson: "blights",
			damageType: MAGICAL_DAMAGE_TYPE.NECROTIC,
			color: COLOR.PURPLE,
		},
	],
	// Psychic damage types
	[
		"assault",
		{
			verb: "assault",
			verbThirdPerson: "assaults",
			damageType: MAGICAL_DAMAGE_TYPE.PSYCHIC,
			color: COLOR.PINK,
		},
	],
	[
		"scour",
		{
			verb: "scour",
			verbThirdPerson: "scours",
			damageType: MAGICAL_DAMAGE_TYPE.PSYCHIC,
			color: COLOR.PINK,
		},
	],
	[
		"rend",
		{
			verb: "rend",
			verbThirdPerson: "rends",
			damageType: MAGICAL_DAMAGE_TYPE.PSYCHIC,
			color: COLOR.PINK,
		},
	],
	[
		"pierce",
		{
			verb: "pierce",
			verbThirdPerson: "pierces",
			damageType: MAGICAL_DAMAGE_TYPE.PSYCHIC,
			color: COLOR.PINK,
		},
	],
	[
		"shatter",
		{
			verb: "shatter",
			verbThirdPerson: "shatters",
			damageType: MAGICAL_DAMAGE_TYPE.PSYCHIC,
			color: COLOR.PINK,
		},
	],
	// Force damage types
	[
		"pummel",
		{
			verb: "pummel",
			verbThirdPerson: "pummels",
			damageType: MAGICAL_DAMAGE_TYPE.FORCE,
			color: COLOR.GREY,
		},
	],
	[
		"strike",
		{
			verb: "strike",
			verbThirdPerson: "strikes",
			damageType: MAGICAL_DAMAGE_TYPE.FORCE,
			color: COLOR.GREY,
		},
	],
	[
		"impact",
		{
			verb: "impact",
			verbThirdPerson: "impacts",
			damageType: MAGICAL_DAMAGE_TYPE.FORCE,
			color: COLOR.GREY,
		},
	],
	[
		"blast",
		{
			verb: "blast",
			verbThirdPerson: "blasts",
			damageType: MAGICAL_DAMAGE_TYPE.FORCE,
			color: COLOR.GREY,
		},
	],
	// Thunder damage types
	[
		"resonate",
		{
			verb: "resonate",
			verbThirdPerson: "resonates",
			damageType: MAGICAL_DAMAGE_TYPE.THUNDER,
			color: COLOR.YELLOW,
		},
	],
	[
		"echo",
		{
			verb: "echo",
			verbThirdPerson: "echoes",
			damageType: MAGICAL_DAMAGE_TYPE.THUNDER,
			color: COLOR.YELLOW,
		},
	],
	[
		"boom",
		{
			verb: "boom",
			verbThirdPerson: "booms",
			damageType: MAGICAL_DAMAGE_TYPE.THUNDER,
			color: COLOR.YELLOW,
		},
	],
	[
		"thunder",
		{
			verb: "thunder",
			verbThirdPerson: "thunders",
			damageType: MAGICAL_DAMAGE_TYPE.THUNDER,
			color: COLOR.YELLOW,
		},
	],
	[
		"concuss",
		{
			verb: "concuss",
			verbThirdPerson: "concusses",
			damageType: MAGICAL_DAMAGE_TYPE.THUNDER,
			color: COLOR.YELLOW,
		},
	],
	// Poison damage types
	[
		"venom",
		{
			verb: "venom",
			verbThirdPerson: "venoms",
			damageType: MAGICAL_DAMAGE_TYPE.POISON,
			color: COLOR.LIME,
		},
	],
	[
		"toxify",
		{
			verb: "toxify",
			verbThirdPerson: "toxifies",
			damageType: MAGICAL_DAMAGE_TYPE.POISON,
			color: COLOR.LIME,
		},
	],
	[
		"poison",
		{
			verb: "poison",
			verbThirdPerson: "poisons",
			damageType: MAGICAL_DAMAGE_TYPE.POISON,
			color: COLOR.LIME,
		},
	],
	[
		"taint",
		{
			verb: "taint",
			verbThirdPerson: "taints",
			damageType: MAGICAL_DAMAGE_TYPE.POISON,
			color: COLOR.LIME,
		},
	],
	// Acid damage types
	[
		"corrode",
		{
			verb: "corrode",
			verbThirdPerson: "corrodes",
			damageType: MAGICAL_DAMAGE_TYPE.ACID,
			color: COLOR.OLIVE,
		},
	],
	[
		"erode",
		{
			verb: "erode",
			verbThirdPerson: "erodes",
			damageType: MAGICAL_DAMAGE_TYPE.ACID,
			color: COLOR.OLIVE,
		},
	],
	[
		"eat",
		{
			verb: "eat",
			verbThirdPerson: "eats",
			damageType: MAGICAL_DAMAGE_TYPE.ACID,
			color: COLOR.OLIVE,
		},
	],
]);

/**
 * Merges damage type relationships from race and job.
 * Priority: IMMUNE > RESIST > VULNERABLE
 *
 * @param raceRelationships Damage relationships from race
 * @param jobRelationships Damage relationships from job
 * @returns Merged damage type relationships
 *
 * @example
 * ```typescript
 * const race = { FIRE: DAMAGE_RELATIONSHIP.IMMUNE };
 * const job = { FIRE: DAMAGE_RELATIONSHIP.VULNERABLE };
 * const merged = mergeDamageRelationships(race, job);
 * // Result: { FIRE: DAMAGE_RELATIONSHIP.IMMUNE } (immune takes priority)
 * ```
 */
export function mergeDamageRelationships(
	raceRelationships?: DamageTypeRelationships,
	jobRelationships?: DamageTypeRelationships
): DamageTypeRelationships {
	const result: DamageTypeRelationships = {};

	// Collect all damage types from both sources
	const allTypes = new Set<DAMAGE_TYPE>();
	if (raceRelationships) {
		for (const type of Object.keys(raceRelationships) as DAMAGE_TYPE[]) {
			allTypes.add(type);
		}
	}
	if (jobRelationships) {
		for (const type of Object.keys(jobRelationships) as DAMAGE_TYPE[]) {
			allTypes.add(type);
		}
	}

	// Merge with priority: IMMUNE > RESIST > VULNERABLE
	for (const type of allTypes) {
		const raceRel = raceRelationships?.[type];
		const jobRel = jobRelationships?.[type];

		// Priority: IMMUNE > RESIST > VULNERABLE
		if (
			raceRel === DAMAGE_RELATIONSHIP.IMMUNE ||
			jobRel === DAMAGE_RELATIONSHIP.IMMUNE
		) {
			result[type] = DAMAGE_RELATIONSHIP.IMMUNE;
		} else if (
			raceRel === DAMAGE_RELATIONSHIP.RESIST ||
			jobRel === DAMAGE_RELATIONSHIP.RESIST
		) {
			result[type] = DAMAGE_RELATIONSHIP.RESIST;
		} else if (
			raceRel === DAMAGE_RELATIONSHIP.VULNERABLE ||
			jobRel === DAMAGE_RELATIONSHIP.VULNERABLE
		) {
			result[type] = DAMAGE_RELATIONSHIP.VULNERABLE;
		}
	}

	return result;
}

/**
 * Calculates the damage multiplier based on damage type relationships.
 *
 * @param damageType The type of damage being dealt
 * @param relationships The damage type relationships to check
 * @returns Damage multiplier (0.0 for immune, 0.5 for resist, 2.0 for vulnerable, 1.0 for normal)
 *
 * @example
 * ```typescript
 * const relationships = { FIRE: DAMAGE_RELATIONSHIP.RESIST };
 * const multiplier = getDamageMultiplier(MAGICAL_DAMAGE_TYPE.FIRE, relationships);
 * // Result: 0.5 (50% damage)
 * ```
 */
export function getDamageMultiplier(
	damageType: DAMAGE_TYPE,
	relationships?: DamageTypeRelationships
): number {
	if (!relationships) {
		return 1.0;
	}

	const relationship = relationships[damageType];
	if (!relationship) {
		return 1.0;
	}

	switch (relationship) {
		case DAMAGE_RELATIONSHIP.IMMUNE:
			return 0.0;
		case DAMAGE_RELATIONSHIP.RESIST:
			return 0.5;
		case DAMAGE_RELATIONSHIP.VULNERABLE:
			return 2.0;
		default:
			return 1.0;
	}
}
