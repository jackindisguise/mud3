/**
 * Combat system for managing mob-to-mob combat, threat generation, and combat rounds.
 *
 * Features:
 * - Combat queue that tracks all mobs currently in combat
 * - Combat rounds that run every 3 seconds
 * - Threat-based targeting for NPCs with 10% grace window
 * - Automatic target switching based on threat
 * - Damage dealing and combat messages
 *
 * @module combat
 */
import { number } from "mud-ext";
import {
	Mob,
	Room,
	Weapon,
	EQUIPMENT_SLOT,
	BEHAVIOR,
	Prop,
	Item,
	Equipment,
	Currency,
	DungeonObject,
} from "../core/dungeon.js";
import { MESSAGE_GROUP } from "../core/character.js";
import {
	color,
	COLOR,
	gradientStringTransformer,
	repeatingColorStringTransformer,
	SIZER,
	stickyColor,
	wordColorStringTransformer,
} from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";
import logger from "../utils/logger.js";
import { getLocation, LOCATION } from "../registry/locations.js";
import { act, damageMessage } from "../utils/act.js";
import { showRoom } from "../utils/display.js";
import { createItem, createProp } from "../package/dungeon.js";
import { createGold } from "../utils/currency.js";
import { getAllFromContainer } from "../utils/get.js";
import { sacrificeContainer } from "../utils/sacrifice.js";
import {
	DEFAULT_HIT_TYPE,
	getDamageMultiplier,
	HitType,
} from "../core/damage-types.js";
import { ability as PURE_POWER } from "../abilities/pure-power.js";
import { ability as SECOND_ATTACK } from "../abilities/second-attack.js";
import { ability as THIRD_ATTACK } from "../abilities/third-attack.js";
import { string } from "mud-ext";
import {
	EFFECT_DAMAGE_CATEGORY,
	EffectInstance,
	isDamageOverTimeEffect,
} from "../core/effect.js";

/**
 * Options for damage variation.
 */
export interface DamageVariationOptions {
	/** Variation range as a percentage (default: 5%). A value of 5 means ±2.5% (97.5% to 102.5%) */
	variationRange?: number;
	/** Minimum damage multiplier (default: calculated from variationRange) */
	minMultiplier?: number;
	/** Maximum damage multiplier (default: calculated from variationRange) */
	maxMultiplier?: number;
	/** Modifier to apply to the general variation range */
	variationRangeModifier?: number;
	/** Modifier to apply to the minimum multiplier */
	minMultiplierModifier?: number;
	/** Modifier to apply to the maximum multiplier */
	maxMultiplierModifier?: number;
}

/**
 * Options for the oneHit function.
 */
export interface OneHitOptions {
	/** The mob performing the attack */
	attacker: Mob;
	/** The mob being hit */
	target: Mob;
	/** Optional weapon to use for the attack. If not provided, uses unarmed/default hit type */
	weapon?: Weapon;
	/** If true, the attack will never miss (guaranteed hit) */
	guaranteedHit?: boolean;
	/** Optional ability name to use in damage messages instead of the hit verb */
	abilityName?: string;
	/** Optional hit type to use for the attack */
	hitTypeOverride?: HitType;
	/** Optional flat bonus to add to attack power before damage calculation */
	attackPowerBonus?: number;
	/** Optional multiplier to apply to attack power before damage calculation */
	attackPowerMultiplier?: number;
	/** Optional damage variation options */
	damageVariation?: DamageVariationOptions;
}

/**
 * Options for the oneMagicHit function.
 */
export interface OneMagicHitOptions {
	/** The mob performing the magical attack */
	attacker: Mob;
	/** The mob being hit */
	target: Mob;
	/** If true, the attack will never miss (guaranteed hit) */
	guaranteedHit?: boolean;
	/** Ability name to use in damage messages (required - magical attacks are always tied to specific abilities) */
	abilityName: string;
	/** Optional hit type to use for the magical attack */
	hitType?: HitType;
	/** Optional flat bonus to add to spell power before damage calculation */
	spellPowerBonus?: number;
	/** Optional multiplier to apply to spell power before damage calculation */
	spellPowerMultiplier?: number;
	/** Optional damage variation options */
	damageVariation?: DamageVariationOptions;
}

/**
 * Combat queue containing all mobs currently engaged in combat.
 * Mobs are automatically added when they engage a target and removed when combat ends.
 */
const combatQueue = new Set<Mob>();

/**
 * Grace window multiplier for threat-based target switching.
 * A new attacker must have 10% more threat than the current target to cause a switch.
 */
const THREAT_GRACE_WINDOW = 1.1;

/**
 * Performs a hit attempt against a target, checking accuracy and dealing damage if successful.
 * This is the main function for combat hits. It checks accuracy vs avoidance, and if the hit
 * succeeds, calculates damage based on attack power, defense, critical hits, and damage type
 * relationships. It also handles threat generation and death if the target's health reaches 0.
 *
 * @param attacker The mob performing the attack
 * @param options Options for the hit, including target, weapon, and guaranteedHit flag
 * @returns The damage amount that was dealt (0 if missed, otherwise >= 0)
 *
 * @example
 * ```typescript
 * const attacker = new Mob();
 * const defender = new Mob();
 * const sword = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 15 });
 *
 * // oneHit handles accuracy checks internally
 * const damage = oneHit({ attacker: attacker, target: defender, weapon: sword });
 * // Damage has already been dealt and messages sent (or miss message if missed)
 *
 * // Guaranteed hit (never misses)
 * const guaranteedDamage = oneHit({ attacker: attacker, target: defender, weapon: sword, guaranteedHit: true });
 * ```
 */
export function oneHit(options: OneHitOptions): number {
	const {
		attacker,
		target,
		weapon,
		guaranteedHit = false,
		abilityName,
		attackPowerBonus = 0,
		attackPowerMultiplier = 1,
		hitTypeOverride,
	} = options;

	// Shopkeepers cannot deal damage
	if (attacker.hasBehavior(BEHAVIOR.SHOPKEEPER)) {
		return 0;
	}

	// Get the room where combat is occurring
	const room = attacker.location;
	if (!room || !(room instanceof Room)) {
		return 0; // Can't hit if not in a room
	}

	// Verify target is in the same room
	if (target.location !== room) {
		return 0; // Target not in same room
	}

	// Check if target is dead or destroyed
	if (target.health <= 0) {
		return 0; // Target is dead
	}

	// Check if attack hits (accuracy vs avoidance)
	// Skip miss check if guaranteedHit is true
	if (!guaranteedHit) {
		// Base hit chance is 50%, modified by the difference between accuracy and avoidance
		// accuracy 10 vs avoidance 10 = 50% hit chance
		const hitChance = 50 + (attacker.accuracy - target.avoidance);
		// Clamp hit chance to reasonable bounds (5% to 95%)
		const clampedHitChance = Math.max(5, Math.min(95, hitChance));
		const roll = Math.random() * 100;

		if (roll > clampedHitChance) {
			// Miss - send miss message
			act(
				{
					user: "You miss {target}!",
					target: "{User} misses you!",
					room: "{User} misses {target}!",
				},
				{
					user: attacker,
					target: target,
					room: room,
				},
				{ messageGroup: MESSAGE_GROUP.COMBAT }
			);
			return 0;
		}
	}

	// Check for Pure Power passive ability
	// Pure Power increases attack power from +0% at 0% proficiency to +200% at 100% proficiency
	let purePowerMultiplier = 1;
	let usedPurePower = false;
	if (attacker.knowsAbilityById(PURE_POWER.id)) {
		const proficiency = attacker.learnedAbilities.get(PURE_POWER.id) || 0;
		// Formula: 1 + (proficiency / 100) * 2
		// At 0%: 1 + 0 = 1.0 (no change)
		// At 50%: 1 + 1 = 2.0 (+100%)
		// At 100%: 1 + 2 = 3.0 (+200%)
		purePowerMultiplier = 1 + (proficiency / 100) * 2;
		usedPurePower = true;
	}

	// Combine Pure Power multiplier with provided multiplier
	const finalAttackPowerMultiplier =
		attackPowerMultiplier * purePowerMultiplier;

	// Attack hits - proceed with damage calculation
	// Get hit type from weapon or use default
	const hitType = hitTypeOverride
		? hitTypeOverride
		: weapon
		? weapon.hitType
		: DEFAULT_HIT_TYPE;

	// Calculate base damage
	// Base attack power comes from strength (without weapon bonuses)
	// When using a weapon, add the weapon's attack power to the base
	// When unarmed, use only the base attack power
	const baseAttackPower = attacker.attackPower; // Base attack power (strength-derived, no weapon bonuses)
	let damage = weapon ? baseAttackPower + weapon.attackPower : baseAttackPower;

	// Apply attack power bonus and multiplier (from abilities, etc.)
	damage = (damage + attackPowerBonus) * finalAttackPowerMultiplier;

	// vary damage based on options
	damage = applyDamageVariation(damage, options.damageVariation);

	// Apply defense reduction
	const defenseReduction = target.defense * 0.05; // 5% damage reduction per defense point
	damage = Math.max(0, Math.floor(damage - defenseReduction));

	// Check for critical hit
	if (Math.random() * 100 < attacker.critRate) {
		damage *= 2;
	}

	// Apply damage type relationships (resist, immune, vulnerable)
	const targetRelationships = target.getDamageRelationships();
	const damageMultiplier = getDamageMultiplier(
		hitType.damageType,
		targetRelationships
	);
	damage *= damageMultiplier;

	// Apply effect modifiers
	// Check for outgoing damage multiplier on attacker
	for (const effect of attacker.getEffects()) {
		if (
			effect.template.type === "passive" &&
			effect.template.outgoingDamageMultiplier !== undefined
		) {
			damage *= effect.template.outgoingDamageMultiplier;
		}
	}
	// Check for incoming damage multiplier on target
	for (const effect of target.getEffects()) {
		if (
			effect.template.type === "passive" &&
			effect.template.incomingDamageMultiplier !== undefined
		) {
			damage *= effect.template.incomingDamageMultiplier;
		}
	}

	let finalDamage = Math.floor(damage);

	// Send combat messages
	const damageStr = color(String(finalDamage), COLOR.CRIMSON);

	// Get verb forms for different perspectives
	const verbBase = hitType.verb; // First person: "You punch"
	const verbThirdPersonBase = hitType.verbThirdPerson; // Third person: "punches"

	// Color the verbs based on hit type color (default to WHITE)
	let verbColor = hitType.color ?? COLOR.WHITE;
	let verb = color(verbBase, verbColor);
	let verbThirdPerson = color(verbThirdPersonBase, verbColor);

	// Get weapon name if provided
	let weaponName = undefined;
	if (weapon) {
		weaponName = weapon.display;
		verbColor = weapon.hitType.color ?? COLOR.WHITE;
		verb = color(weapon.hitType.verb, verbColor);
		verbThirdPerson = color(verbThirdPersonBase, verbColor);
	}

	// Build message templates based on whether ability, weapon, or default verb is used
	let userMsg: string;
	let targetMsg: string;
	let roomMsg: string;

	if (finalDamage <= 0) {
		if (abilityName) {
			userMsg = `Your ${abilityName}'s ${verb} {R{target}{x, having no effect!`;
			targetMsg = `{User}'s ${abilityName}'s ${verbThirdPerson} {Ryou{x, having no effect!`;
			roomMsg = `{User}'s ${abilityName}'s ${verbThirdPerson} {R{target}{x, having no effect!`;
		} else if (weaponName) {
			userMsg = `You ${weaponName}'s ${verb} does absolutely nothing to {R{target}{x!`;
			targetMsg = `{User}'s ${weaponName}'s ${verbThirdPerson} does absolutely nothing to {Ryou{x!`;
			roomMsg = `{User}'s ${weaponName}'s ${verbThirdPerson} does absolutely nothing to {R{target}{x!`;
		} else {
			userMsg = `You ${verb} {R{target}{x, doing absolutely nothing!`;
			targetMsg = `{User} ${verbThirdPerson} {Ryou{x, doing absolutely nothing!`;
			roomMsg = `{User} ${verbThirdPerson} {R{target}{x, doing absolutely nothing!`;
		}
	} else if (abilityName) {
		// With ability: ability is the subject, always use "hits"
		userMsg = `Your ${abilityName} ${verbThirdPerson} {R{target}{x for ${damageStr} damage!`;
		targetMsg = `{User}'s ${abilityName} ${verbThirdPerson} {Ryou{x for ${damageStr} damage!`;
		roomMsg = `{User}'s ${abilityName} ${verbThirdPerson} {R{target}{x for ${damageStr} damage!`;
	} else if (weaponName) {
		// With weapon: weapon is the subject, so always use third person
		userMsg = `Your ${weaponName} ${verbThirdPerson} {R{target}{x for ${damageStr} damage!`;
		targetMsg = `{User}'s ${weaponName} ${verbThirdPerson} {Ryou{x for ${damageStr} damage!`;
		roomMsg = `{User}'s ${weaponName} ${verbThirdPerson} {R{target}{x for ${damageStr} damage!`;
	} else {
		// Without weapon: user is the subject
		// First person (user sees): "You punch"
		userMsg = `You ${verb} {R{target}{x for ${damageStr} damage!`;
		// Third person (target/room see): "{User} punches"
		targetMsg = `{User} ${verbThirdPerson} {Ryou{x for ${damageStr} damage!`;
		roomMsg = `{User} ${verbThirdPerson} {R{target}{x for ${damageStr} damage!`;
	}

	damageMessage(
		{
			user: userMsg,
			target: targetMsg,
			room: roomMsg,
		},
		{
			user: attacker,
			target: target,
			room: room,
		},
		target,
		finalDamage,
		{ messageGroup: MESSAGE_GROUP.COMBAT }
	);

	// Deal the damage (this handles threat generation, death, and combat initiation)
	// Pass damage type for shield filtering
	target.damage(attacker, finalDamage, hitType.damageType);

	// Emit got-hit event on target (NPC AI can respond to taking damage)
	const targetEmitter = target.aiEvents;
	if (targetEmitter && finalDamage > 0) {
		targetEmitter.emit("got-hit", attacker);
	}

	logger.debug("Combat hit", {
		attacker: attacker.display,
		attackerId: attacker.oid,
		target: target.display,
		targetId: target.oid,
		damage: finalDamage,
		targetHealth: target.health,
	});

	return finalDamage;
}

/**
 * Performs a magical hit attempt against a target, checking accuracy and dealing damage if successful.
 * This function is for magical attacks and uses spell power and resilience instead of attack power and defense.
 * It checks accuracy vs avoidance, and if the hit succeeds, calculates damage based on spell power,
 * resilience, critical hits, and damage type relationships. It also handles threat generation and death
 * if the target's health reaches 0.
 *
 * @param options Options for the magical hit, including attacker, target, and spell power modifiers
 * @returns The damage amount that was dealt (0 if missed, otherwise >= 0)
 *
 * @example
 * ```typescript
 * const attacker = new Mob();
 * const defender = new Mob();
 * const hitType = COMMON_HIT_TYPES.get("burn")!;
 *
 * // oneMagicHit handles accuracy checks internally
 * const damage = oneMagicHit({
 *   attacker: attacker,
 *   target: defender,
 *   hitType: hitType,
 *   spellPowerMultiplier: 1.5
 * });
 * // Damage has already been dealt and messages sent (or miss message if missed)
 * ```
 */
export function oneMagicHit(options: OneMagicHitOptions): number {
	const {
		attacker,
		target,
		guaranteedHit = false,
		abilityName,
		hitType = DEFAULT_HIT_TYPE,
		spellPowerBonus = 0,
		spellPowerMultiplier = 1,
		damageVariation,
	} = options;

	// Get the room where combat is occurring
	const room = attacker.location;
	if (!room || !(room instanceof Room)) {
		return 0; // Can't hit if not in a room
	}

	// Verify target is in the same room
	if (target.location !== room) {
		return 0; // Target not in same room
	}

	// Check if target is dead or destroyed
	if (target.health <= 0) {
		return 0; // Target is dead
	}

	// Check if attack hits (accuracy vs avoidance)
	// Skip miss check if guaranteedHit is true
	if (!guaranteedHit) {
		// Base hit chance is 50%, modified by the difference between accuracy and avoidance
		// accuracy 10 vs avoidance 10 = 50% hit chance
		const hitChance = 50 + (attacker.accuracy - target.avoidance);
		// Clamp hit chance to reasonable bounds (5% to 95%)
		const clampedHitChance = Math.max(5, Math.min(95, hitChance));
		const roll = Math.random() * 100;

		if (roll > clampedHitChance) {
			// Miss - send miss message
			act(
				{
					user: `Your ${abilityName} misses {R{target}{x!`,
					target: `{User}'s ${abilityName} misses {Ryou{x!`,
					room: `{User}'s ${abilityName} misses {R{target}{x!`,
				},
				{
					user: attacker,
					target: target,
					room: room,
				},
				{ messageGroup: MESSAGE_GROUP.COMBAT }
			);
			return 0;
		}
	}

	// Attack hits - proceed with damage calculation
	// Calculate base damage using spell power
	const baseSpellPower = attacker.spellPower;
	let damage = baseSpellPower;

	// Apply spell power bonus and multiplier (from abilities, etc.)
	damage = (damage + spellPowerBonus) * spellPowerMultiplier;

	// Apply damage variation
	damage = applyDamageVariation(damage, damageVariation);

	// Apply resilience reduction (magical resistance)
	const resilienceReduction = target.resilience * 0.05; // 5% damage reduction per resilience point
	damage = Math.max(0, Math.floor(damage - resilienceReduction));

	// Check for critical hit (using critRate, same as physical attacks)
	if (Math.random() * 100 < attacker.critRate) {
		damage *= 2;
	}

	// Apply damage type relationships (resist, immune, vulnerable)
	const targetRelationships = target.getDamageRelationships();
	const damageMultiplier = getDamageMultiplier(
		hitType.damageType,
		targetRelationships
	);
	damage *= damageMultiplier;

	// Apply effect modifiers
	// Check for outgoing damage multiplier on attacker
	for (const effect of attacker.getEffects()) {
		if (
			effect.template.type === "passive" &&
			effect.template.outgoingDamageMultiplier !== undefined
		) {
			damage *= effect.template.outgoingDamageMultiplier;
		}
	}
	// Check for incoming damage multiplier on target
	for (const effect of target.getEffects()) {
		if (
			effect.template.type === "passive" &&
			effect.template.incomingDamageMultiplier !== undefined
		) {
			damage *= effect.template.incomingDamageMultiplier;
		}
	}

	let finalDamage = Math.floor(damage);

	// Send combat messages
	const damageStr = color(String(finalDamage), COLOR.CRIMSON);

	// Get verb forms for different perspectives
	const verbBase = hitType.verb; // First person: "You burn"
	const verbThirdPersonBase = hitType.verbThirdPerson; // Third person: "burns"

	// Color the verbs based on hit type color (default to WHITE)
	const verbColor = hitType.color ?? COLOR.WHITE;
	const verb = color(verbBase, verbColor);
	const verbThirdPerson = color(verbThirdPersonBase, verbColor);

	// Build message templates - ability name is always required for magical attacks
	let userMsg: string;
	let targetMsg: string;
	let roomMsg: string;

	if (finalDamage <= 0) {
		userMsg = `Your ${abilityName}'s ${verb} {R{target}{x, having no effect!`;
		targetMsg = `{User}'s ${abilityName}'s ${verbThirdPerson} {Ryou{x, having no effect!`;
		roomMsg = `{User}'s ${abilityName}'s ${verbThirdPerson} {R{target}{x, having no effect!`;
	} else {
		// With ability: ability is the subject, always use third person
		userMsg = `Your ${abilityName} ${verbThirdPerson} {R{target}{x for ${damageStr} damage!`;
		targetMsg = `{User}'s ${abilityName} ${verbThirdPerson} {Ryou{x for ${damageStr} damage!`;
		roomMsg = `{User}'s ${abilityName} ${verbThirdPerson} {R{target}{x for ${damageStr} damage!`;
	}

	damageMessage(
		{
			user: userMsg,
			target: targetMsg,
			room: roomMsg,
		},
		{
			user: attacker,
			target: target,
			room: room,
		},
		target,
		finalDamage,
		{ messageGroup: MESSAGE_GROUP.COMBAT }
	);

	// Deal the damage (this handles threat generation, death, and combat initiation)
	// Pass damage type for shield filtering
	target.damage(attacker, finalDamage, hitType.damageType);

	logger.debug("Combat hit (magical)", {
		attacker: attacker.display,
		attackerId: attacker.oid,
		target: target.display,
		targetId: target.oid,
		damage: finalDamage,
		abilityName,
		targetHealth: target.health,
	});

	return finalDamage;
}

/**
 * Options for processing effect damage.
 */
export interface ProcessEffectDamageOptions {
	/** The mob taking damage from the effect */
	target: Mob;
	/** The effect instance dealing the damage */
	effect: EffectInstance;
	/** The base damage amount before mitigation */
	damage: number;
	/** Optional damage variation options */
	damageVariation?: DamageVariationOptions;
}

/**
 * Default damage variation range as a percentage (default: 20%). A value of 20 means ±10% (90% to 110%)
 */
export const DEFAULT_DAMAGE_VARIATION_RANGE = 20;

/**
 * Applies damage variation to a damage value.
 * Default variation is 5% (97.5% to 102.5% of initial damage).
 * Minimum damage is always at least 1 less than initial damage, maximum is always at least 1 more.
 *
 * @param damage The base damage value to apply variation to
 * @param options Optional damage variation configuration
 * @returns The damage value after applying variation
 */
export function applyDamageVariation(
	damage: number,
	options?: DamageVariationOptions
): number {
	if (damage <= 0) {
		return damage;
	}

	const variationRange =
		(options?.variationRange ?? DEFAULT_DAMAGE_VARIATION_RANGE) +
		(options?.variationRangeModifier ?? 0);

	// Calculate base multipliers from variation range
	// A range of 5% means -2.5% to +2.5%, so 0.975 to 1.025
	const baseMinMultiplier = 1 - variationRange / 200;
	const baseMaxMultiplier = 1 + variationRange / 200;

	// Apply individual modifiers if provided, otherwise use base multipliers
	let minMultiplier = options?.minMultiplier ?? baseMinMultiplier;
	if (options?.minMultiplierModifier !== undefined) {
		minMultiplier += options.minMultiplierModifier;
	}

	let maxMultiplier = options?.maxMultiplier ?? baseMaxMultiplier;
	if (options?.maxMultiplierModifier !== undefined) {
		maxMultiplier += options.maxMultiplierModifier;
	}

	// Calculate minimum and maximum damage values
	const minDamageFromMultiplier = Math.floor(damage * minMultiplier);
	const maxDamageFromMultiplier = Math.floor(damage * maxMultiplier);

	// Maximum minimum damage is the base damage itself
	const actualMinDamage = Math.min(minDamageFromMultiplier, damage);

	// Minimum maximum damage is the base damage itself
	const actualMaxDamage = Math.max(maxDamageFromMultiplier, damage);

	// Ensure min is not greater than max
	const finalMinDamage = Math.max(
		0,
		Math.min(actualMinDamage, actualMaxDamage)
	);
	const finalMaxDamage = Math.max(actualMinDamage, actualMaxDamage);

	// Apply random variation
	const randomDamage = number.randomInt(finalMinDamage, finalMaxDamage);
	return Math.floor(randomDamage);
}

/**
 * Processes damage from an effect (DoT).
 * Effects don't come from an attacker - they come from the effect itself.
 * This function handles damage calculation using the appropriate defense attribute
 * (defense for physical, resilience for magical) based on the effect's damage category.
 * Effect damage cannot miss, and messages are handled by the effect's onTick template.
 *
 * @param options Options for processing effect damage
 * @returns The final damage amount that was dealt (after mitigation)
 *
 * @example
 * ```typescript
 * const mob = new Mob();
 * const effect = mob.getEffectsById("poison")[0];
 * const damage = processEffectDamage({
 *   target: mob,
 *   effect: effect,
 *   damage: 10
 * });
 * // Damage has been dealt and messages sent via effect's onTick template
 * ```
 */
export function processEffectDamage(
	options: ProcessEffectDamageOptions
): number {
	const { target, effect, damage: baseDamage } = options;

	if (baseDamage <= 0) {
		return 0;
	}

	// Only process DoT effects
	if (!isDamageOverTimeEffect(effect.template)) {
		return 0;
	}

	const template = effect.template;
	let damage = baseDamage;

	// Apply mitigation based on damage category
	if (template.damageCategory === EFFECT_DAMAGE_CATEGORY.PHYSICAL) {
		// Physical damage uses defense
		const defenseReduction = target.defense * 0.05; // 5% damage reduction per defense point
		damage = Math.max(0, Math.floor(damage - defenseReduction));
	} else {
		// Magical damage uses resilience
		const resilienceReduction = target.resilience * 0.05; // 5% damage reduction per resilience point
		damage = Math.max(0, Math.floor(damage - resilienceReduction));
	}

	// Apply damage type relationships (resist, immune, vulnerable)
	const targetRelationships = target.getDamageRelationships();
	const damageMultiplier = getDamageMultiplier(
		template.hitType.damageType,
		targetRelationships
	);
	damage *= damageMultiplier;

	// Apply effect modifiers
	// Check for incoming damage multiplier on target
	for (const targetEffect of target.getEffects()) {
		if (
			targetEffect.template.type === "passive" &&
			targetEffect.template.incomingDamageMultiplier !== undefined
		) {
			damage *= targetEffect.template.incomingDamageMultiplier;
		}
	}

	let finalDamage = Math.floor(damage);

	// Apply damage variation
	finalDamage = applyDamageVariation(finalDamage, options.damageVariation);

	// Deal the damage (this handles threat generation, death, and combat initiation)
	// Pass damage type for shield filtering
	target.damage(effect.caster, finalDamage, template.hitType.damageType);

	return finalDamage;
}

/**
 * Gets the mob with the highest threat that is in the same room as the NPC.
 * Returns undefined if no valid target is found in the room.
 *
 * @param npc The NPC to check threat for
 * @param room The room to check for targets in
 * @returns The mob with highest threat in the room, or undefined
 */
function getHighestThreatInRoom(npc: Mob, room: Room): Mob | undefined {
	if (!npc.threatTable || npc.threatTable.size === 0) {
		return undefined;
	}

	let highestThreat = -1;
	let highestThreatMob: Mob | undefined;

	for (const [mob, entry] of npc.threatTable.entries()) {
		// Only consider mobs that are in the same room
		if (mob.location === room && entry.value > highestThreat) {
			highestThreat = entry.value;
			highestThreatMob = mob;
		}
	}

	return highestThreatMob;
}

/**
 * Adds a mob to the combat queue.
 * Called automatically when a mob engages a target.
 *
 * @param mob The mob to add to combat
 */
export function addToCombatQueue(mob: Mob): void {
	if (mob.isInCombat()) {
		combatQueue.add(mob);
	}
}

/**
 * Removes a mob from the combat queue.
 * Called automatically when a mob disengages from combat.
 * For player characters with combat busy mode enabled, this will dump queued messages.
 *
 * @param mob The mob to remove from combat
 */
export function removeFromCombatQueue(mob: Mob): void {
	const wasInCombat = combatQueue.has(mob);
	combatQueue.delete(mob);

	if (wasInCombat) {
		logger.debug("Mob removed from combat queue", {
			mob: mob.display,
			mobId: mob.oid,
			stillInCombat: mob.isInCombat(),
		});
	}

	// If this is a player character that just exited combat and has combat busy mode enabled,
	// dump their queued messages
	if (
		mob.character &&
		wasInCombat &&
		!mob.isInCombat() &&
		mob.character.settings.combatBusyModeEnabled
	) {
		const messages = mob.character.readQueuedMessages();
		if (messages.length > 0) {
			mob.character.sendMessage(
				`Combat ended. ${messages.length} queued message${
					messages.length === 1 ? "" : "s"
				} dumped.`,
				MESSAGE_GROUP.SYSTEM
			);
		}
	}
}

/**
 * Checks if a mob is in the combat queue.
 *
 * @param mob The mob to check
 * @returns True if the mob is in the combat queue
 */
export function isInCombatQueue(mob: Mob): boolean {
	return combatQueue.has(mob);
}

/**
 * Gets all mobs currently in the combat queue.
 *
 * @returns Array of all mobs in combat
 */
export function getCombatQueue(): ReadonlyArray<Mob> {
	return Array.from(combatQueue);
}

/**
 * Handles NPC behavior when leaving combat.
 * If the NPC has mobs in the room with threat, switches to the highest threat target.
 * If the NPC is aggro, checks the room for player mobs and attacks them.
 *
 * @param npc The NPC mob that just left combat
 */
export function handleNPCLeavingCombat(npc: Mob): void {
	// Only process NPCs
	if (npc.character) {
		return;
	}

	// Don't process dead NPCs
	if (npc.health <= 0) {
		return;
	}

	const npcRoom = npc.location;
	if (!(npcRoom instanceof Room)) {
		return;
	}

	// Check for threat-based targets first
	if (npc.threatTable && npc.threatTable.size > 0) {
		const highestThreat = getHighestThreatInRoom(npc, npcRoom);
		if (highestThreat) {
			// Switch to highest threat target - new engagement, gets free round
			initiateCombat(npc, highestThreat, false);
			return; // Don't check aggro if we found a threat target
		}
	}

	// If no threat targets, check aggro behavior
	if (npc.hasBehavior(BEHAVIOR.AGGRESSIVE)) {
		// Look for character mobs in the room
		for (const obj of npcRoom.contents) {
			if (!(obj instanceof Mob)) continue;
			const target = obj as Mob;
			if (target === npc) continue; // Don't process self
			if (!target.character) continue; // Only attack character mobs

			// Found a player mob, initiate combat
			initiateCombat(npc, target);
			return; // Only attack one target
		}
	}
}

/**
 * Processes threat-based target switching for NPCs.
 * NPCs will switch targets if a new attacker has 10% more threat than the current target.
 * Only switches if the new target is in the same room as the NPC.
 *
 * @param npc The NPC mob to process threat switching for
 */
export function processThreatSwitching(npc: Mob): void {
	if (!npc.threatTable || npc.character) {
		return;
	}

	// Don't process dead NPCs
	if (npc.health <= 0) {
		return;
	}

	const npcRoom = npc.location;
	if (!(npcRoom instanceof Room)) {
		npc.combatTarget = undefined;
		return;
	}

	const currentTarget = npc.combatTarget;
	if (!currentTarget) {
		// No current target, pick highest threat that's in the same room
		const highestThreat = getHighestThreatInRoom(npc, npcRoom);
		if (highestThreat) {
			// New engagement - should get free round
			initiateCombat(npc, highestThreat, false);
		}
		return;
	}

	// Check if current target is still in the same room
	if (currentTarget.location !== npcRoom) {
		// Current target left the room, find a new target that's actually in the room
		const highestThreat = getHighestThreatInRoom(npc, npcRoom);
		if (highestThreat) {
			// New engagement (previous target left) - should get free round
			initiateCombat(npc, highestThreat, false);
		} else {
			// No valid target in room, clear target and remove from combat queue
			npc.combatTarget = undefined;
		}
		return;
	}

	const highestThreatMob = getHighestThreatInRoom(npc, npcRoom);
	if (!highestThreatMob || highestThreatMob === currentTarget) {
		return;
	}

	const currentThreat = npc.getThreat(currentTarget);
	const highestThreat = npc.getThreat(highestThreatMob);
	const graceThreshold = currentThreat * THREAT_GRACE_WINDOW;

	if (highestThreat >= graceThreshold) {
		// Switch targets - we're already in combat, so just update the target
		// Don't use initiateCombat here as it would send engagement messages again
		initiateCombat(npc, highestThreatMob, true);
	}
}

const deathColorRepeatingTransformer = repeatingColorStringTransformer(
	[
		COLOR.OLIVE,
		COLOR.MAROON,
		COLOR.CRIMSON,
		COLOR.YELLOW,
		COLOR.CRIMSON,
		COLOR.MAROON,
	],
	4
);

/**
 * Creates a corpse item from a dead mob.
 * The corpse is marked as a container so items can be put into it and retrieved from it.
 *
 * @param deadMob The mob that died
 * @returns A new Item representing the corpse
 *
 * @example
 * ```typescript
 * const corpse = createCorpse(deadMob);
 * room.add(corpse);
 * ```
 */
export function createCorpse(deadMob: Mob): Item {
	return createItem({
		keywords: `corpse ${deadMob.keywords}`,
		display: `the corpse of ${deadMob.display}`,
		description: `The lifeless body of ${deadMob.display} lies here.`,
		roomDescription: `The corpse of ${deadMob.display} is here.`,
		isContainer: true,
	});
}

/**
 * Handles mob death, removing from combat and cleaning up.
 * This is a central function for all death handling logic.
 *
 * @param deadMob The mob that died
 * @param killer The mob that killed it (if any)
 *
 * @example
 * ```typescript
 * if (mob.health <= 0) {
 *   handleDeath(mob, attacker);
 * }
 * ```
 */
export function handleDeath(deadMob: Mob, killer?: Mob): void {
	logger.debug("Mob dying", {
		deadMob: deadMob.display,
		deadMobId: deadMob.oid,
		killer: killer?.display,
		killerId: killer?.oid,
		isCharacter: !!deadMob.character,
	});

	const room = deadMob.location;
	if (!room || !(room instanceof Room)) {
		return; // Can't handle death if not in a room
	}

	// Emit death events before removing from combat
	// Emit target-death for killer (if they have AI)
	if (killer) {
		const killerEmitter = killer.aiEvents;
		if (killerEmitter) {
			killerEmitter.emit("target-death", deadMob);
		}
	}

	// Emit death event for the dying mob
	const deadMobEmitter = deadMob.aiEvents;
	if (deadMobEmitter) {
		deadMobEmitter.emit("death", killer);
	}

	// Remove from combat
	deadMob.combatTarget = undefined;

	// Clear threat table
	deadMob.clearThreatTable();

	// Remove threat from other mobs' threat tables and clear their combatTarget if they were targeting the dead mob
	for (const mob of room.contents) {
		if (mob instanceof Mob) {
			mob.removeThreat(deadMob);
			// Clear combatTarget if this mob was targeting the dead mob
			if (mob.combatTarget === deadMob) {
				mob.combatTarget = undefined;
			}
		}
	}

	// Send death messages
	if (killer) {
		deadMob.sendMessage(
			`You have been slain by ${killer.display}!`,
			MESSAGE_GROUP.COMBAT
		);
	}

	// action -- falling down, dead.
	act(
		{
			user: "You hit the ground DEAD!",
			room: "{User} hits the ground DEAD!",
		},
		{
			user: deadMob,
			room: room,
		},
		{
			messageGroup: MESSAGE_GROUP.ACTION,
		}
	);

	// Award experience to killer if present
	if (killer) {
		if (!killer.character) {
			processThreatSwitching(killer);
		} else {
			if (killer.combatTarget === deadMob) killer.combatTarget = undefined;
			const slainMessage = `You have slain ${color(
				deadMob.display,
				COLOR.YELLOW
			)}!`;
			killer.sendMessage(
				stickyColor(slainMessage, COLOR.CRIMSON),
				MESSAGE_GROUP.COMBAT
			);
			// Only players gain experience
			const experienceGained = killer.awardKillExperience(deadMob.level);
			if (experienceGained > 0) {
				// Send experience message to the killer
				killer.character.sendMessage(
					`You gain ${color(String(experienceGained), COLOR.CYAN)} experience!`,
					MESSAGE_GROUP.INFO
				);
			}
		}
	}

	// Create corpse and move inventory/equipment to it
	const corpse = createCorpse(deadMob);

	// Get all inventory items (Items in contents)
	const inventoryItems = deadMob.contents.filter(
		(obj) => obj instanceof Item
	) as Item[];

	// Get all equipped items
	const equippedItems = deadMob.getAllEquipped();

	// Unequip all equipped items
	for (const equipment of equippedItems) {
		deadMob.unequip(equipment);
	}

	// Move all items (inventory + previously equipped) to corpse
	const allItems = [...inventoryItems, ...equippedItems];
	for (const item of allItems) {
		corpse.add(item);
	}

	// Generate gold coin pile from mob's value and add to corpse
	const mobValue = deadMob.value || 0;
	if (mobValue > 0) {
		const goldPile = createGold(mobValue, {
			includeRoomDescription: true,
		});
		corpse.add(goldPile);
		// Clear the mob's value since it's now in the corpse
		deadMob.value = 0;
	}

	// Drop corpse in room (always drop it, even if empty)
	room.add(corpse);

	// Handle autoloot and autosacrifice if killer is a player character
	if (killer && killer.character) {
		const settings = killer.character.settings;

		// Auto-loot first (if enabled)
		if (settings.autoloot) {
			// Auto-loot all items from the corpse using the centralized get logic
			getAllFromContainer(corpse, killer, room);
		}

		// Then auto-sacrifice (if enabled) - this will destroy the corpse even if it's now empty after looting
		if (settings.autosacrifice) {
			sacrificeContainer(corpse, killer, room);
		}
	}

	// delete NPCs
	if (!deadMob.character) {
		logger.debug("Destroying NPC mob", {
			mob: deadMob.display,
			mobId: deadMob.oid,
		});
		deadMob.destroy();
		return;
	}

	// preserve characters
	// move mob to graveyard and set HP to 1
	try {
		const graveyard = getLocation(LOCATION.GRAVEYARD);
		if (graveyard) {
			deadMob.move(graveyard);
			deadMob.resetResources();
			showRoom(deadMob, graveyard);
		}
	} catch (error) {
		logger.warn(`Failed to move ${deadMob.display} to graveyard: ${error}`);
	}
}

/**
 * Processes a single combat round for a mob.
 * The mob attacks its target if it has one and is still in the same room.
 *
 * @param mob The mob to process a combat round for
 */
function processMobCombatRound(mob: Mob): void {
	if (!mob.location || !(mob.location instanceof Room)) {
		mob.combatTarget = undefined;
		return;
	}

	if (!mob.combatTarget) {
		mob.combatTarget = undefined;
		return;
	}

	// Check if target is still in the same room
	if (mob.combatTarget.location !== mob.location) {
		mob.combatTarget = undefined;
		return;
	}

	// Check if target is dead or destroyed
	if (mob.combatTarget.health <= 0) {
		mob.combatTarget = undefined;
		return;
	}

	// Process threat switching for NPCs
	if (!mob.character) {
		processThreatSwitching(mob);
		if (!mob.combatTarget) {
			removeFromCombatQueue(mob);
			return;
		}
	}

	// Emit combat-round event before combat actions
	const mobEmitter = mob.aiEvents;
	if (mobEmitter && mob.combatTarget) {
		mobEmitter.emit("combat-round", mob.combatTarget);
	}

	// Perform the hit (oneHit handles accuracy checks, damage calculation, messages, and damage dealing)
	const mainHand = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
	const weapon = mainHand instanceof Weapon ? mainHand : undefined;
	oneHit({ attacker: mob, target: mob.combatTarget, weapon });

	// extra hit when dual wielding
	const offHand = mob.getEquipped(EQUIPMENT_SLOT.OFF_HAND);
	const weaponOff = offHand instanceof Weapon ? offHand : undefined;
	if (weaponOff)
		oneHit({ attacker: mob, target: mob.combatTarget, weapon: weaponOff });

	// second attack: extra round of attacks
	if (
		mob.knowsAbilityById(SECOND_ATTACK.id) &&
		mob.combatTarget &&
		mob.combatTarget.health > 0
	) {
		oneHit({ attacker: mob, target: mob.combatTarget, weapon });
		if (weaponOff)
			oneHit({ attacker: mob, target: mob.combatTarget, weapon: weaponOff });
	}

	// third attack: extra round of attacks
	if (
		mob.knowsAbilityById(THIRD_ATTACK.id) &&
		mob.combatTarget &&
		mob.combatTarget.health > 0
	) {
		oneHit({ attacker: mob, target: mob.combatTarget, weapon });
		if (weaponOff)
			oneHit({ attacker: mob, target: mob.combatTarget, weapon: weaponOff });
	}

	// Emit after-combat-round event after all combat actions
	if (mobEmitter && mob.combatTarget) {
		mobEmitter.emit("after-combat-round", mob.combatTarget);
	}
}

/**
 * Processes a full combat round for all mobs in the combat queue.
 * Mobs are sorted by agility (highest first) and each attacks their target.
 * This function is called every 3 seconds by the game loop.
 */
export function processCombatRound(): void {
	// Sort combat queue by agility (highest first)
	const sortedMobs = Array.from(combatQueue).sort((a, b) => {
		return b.agility - a.agility;
	});

	// Process each mob's combat round
	const characters = sortedMobs.filter((mob) => mob.character);
	for (const mob of sortedMobs) {
		processMobCombatRound(mob);
	}
	characters.forEach((mob) => !mob.isInCombat() || mob.character!.showPrompt());
}

/**
 * Initiates combat between two mobs.
 * The attacker engages the defender, and both are added to the combat queue.
 *
 * @param attacker The mob initiating combat
 * @param defender The mob being attacked
 * @param room The room where combat is occurring
 */
export function initiateCombat(
	attacker: Mob,
	defender: Mob,
	reaction: boolean = false
): void {
	// Prevent self-targeting
	if (attacker === defender) {
		return;
	}
	if (attacker.combatTarget === defender) {
		return;
	}

	// Prevent dead mobs from initiating combat
	if (attacker.health <= 0 || defender.health <= 0) {
		return;
	}

	// Shopkeepers cannot initiate or receive combat
	if (
		attacker.hasBehavior(BEHAVIOR.SHOPKEEPER) ||
		defender.hasBehavior(BEHAVIOR.SHOPKEEPER)
	) {
		return;
	}

	logger.debug("Combat initiated", {
		attacker: attacker.display,
		attackerId: attacker.oid,
		defender: defender.display,
		defenderId: defender.oid,
		reaction,
	});

	const originalTarget = attacker.combatTarget;
	const room =
		attacker.location instanceof Room ? attacker.location : undefined;

	attacker.combatTarget = defender;

	// Emit attacked event on defender (NPC AI can respond to being attacked)
	const defenderEmitter = defender.aiEvents;
	if (defenderEmitter) {
		defenderEmitter.emit("attacked", attacker);
	}

	// not a reactionary initiation (backfoot)
	if (!reaction) {
		// defender	is an NPC? defender needs to consider us a threat
		if (!defender.character) {
			defender.addToThreatTable(attacker);
		} else {
			// defender is a character and not in combat? initiate combat
			if (!defender.isInCombat()) {
				initiateCombat(defender, attacker, true);
			}
		}

		// Send act() message for combat initiation or target switching
		/*
		if (room) {
			if (!originalTarget) {
				// New engagement
				act(
					{
						user: `You engage {target} in combat!`,
						room: `{User} engages {target} in combat!`,
						target: `{User} engages you in combat!`,
					},
					{
						user: attacker,
						target: defender,
						room: room,
					},
					{ messageGroup: MESSAGE_GROUP.ACTION }
				);
			} else {
				// Target switch
				act(
					{
						user: `You switch targets to {target}!`,
						room: `{User} switches targets to {target}!`,
						target: `{User} switches targets to you!`,
					},
					{
						user: attacker,
						target: defender,
						room: room,
					},
					{ messageGroup: MESSAGE_GROUP.ACTION }
				);
			}
		}*/

		// we didn't have a target before, free round of combat
		if (!originalTarget) {
			processMobCombatRound(attacker);
		}
	}
}
