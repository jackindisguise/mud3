/**
 * Effect system for mobs, including passive and active effects.
 *
 * Effects can modify mob state, deal damage over time, heal over time, or
 * provide dynamic modifiers that other systems can check.
 *
 * @module core/effect
 */

import {
	PrimaryAttributeSet,
	SecondaryAttributeSet,
	ResourceCapacities,
} from "./attribute.js";
import { Mob } from "./dungeon.js";
import { ActMessageTemplates } from "../act.js";
import { DAMAGE_TYPE, HitType } from "./damage-types.js";

/**
 * Message templates for effects (onApply/onTick/onExpire).
 * Effects don't have a target, so target messages are not allowed.
 */
export type EffectMessageTemplates = Omit<ActMessageTemplates, "target">;

/**
 * Base effect template that defines the properties of an effect.
 * This is the template used when creating effect instances.
 */
export interface BaseEffectTemplate {
	/** Unique identifier for this effect type */
	id: string;
	/** Display name of the effect */
	name: string;
	/** Description of what the effect does */
	description: string;
	/** Whether multiple instances of this effect can stack */
	stackable: boolean;
	/** Act message templates shown when this effect is applied */
	onApply?: EffectMessageTemplates;
	/** Act message templates shown when this effect expires */
	onExpire?: EffectMessageTemplates;
}

/**
 * Passive effect template that modifies attributes or provides dynamic modifiers.
 * Passive effects are applied continuously while active.
 */
export interface PassiveEffectTemplate extends BaseEffectTemplate {
	type: "passive";
	/** Modifiers to primary attributes (strength, agility, intelligence) */
	primaryAttributeModifiers?: Partial<PrimaryAttributeSet>;
	/** Modifiers to secondary attributes (attackPower, defense, etc.) */
	secondaryAttributeModifiers?: Partial<SecondaryAttributeSet>;
	/** Modifiers to resource capacities (maxHealth, maxMana) */
	resourceCapacityModifiers?: Partial<ResourceCapacities>;
	/** Dynamic modifier: multiplier for incoming damage (e.g., 0.5 for 50% damage reduction) */
	incomingDamageMultiplier?: number;
	/** Dynamic modifier: multiplier for outgoing damage */
	outgoingDamageMultiplier?: number;
	/** Dynamic modifier: multiplier for healing received */
	healingReceivedMultiplier?: number;
	/** Dynamic modifier: multiplier for healing given */
	healingGivenMultiplier?: number;
	/** Whether this effect is offensive (initiates combat when applied) */
	isOffensive?: boolean;
}

/**
 * Damage category for effect damage.
 * Determines which defense attribute is used (defense for physical, resilience for magical).
 */
export enum EFFECT_DAMAGE_CATEGORY {
	PHYSICAL = "PHYSICAL",
	MAGICAL = "MAGICAL",
}

/**
 * Damage over time effect template.
 * Deals damage at regular intervals for a specified duration.
 */
export interface DamageOverTimeEffectTemplate extends BaseEffectTemplate {
	type: "damage-over-time";
	/** Base damage amount per tick */
	damage: number;
	/** Interval between damage ticks in seconds */
	interval: number;
	/** Total duration of the effect in seconds */
	duration: number;
	/** Hit type that determines the damage type for this DoT */
	hitType: HitType;
	/** Damage category - determines which defense attribute is used (defense vs resilience) */
	damageCategory: EFFECT_DAMAGE_CATEGORY;
	/** Whether this effect is offensive (initiates combat when applied) */
	isOffensive?: boolean;
	/** Act message templates shown when this effect ticks */
	onTick?: EffectMessageTemplates;
}

/**
 * Heal over time effect template.
 * Heals at regular intervals for a specified duration.
 */
export interface HealOverTimeEffectTemplate extends BaseEffectTemplate {
	type: "heal-over-time";
	/** Base heal amount per tick */
	heal: number;
	/** Interval between heal ticks in seconds */
	interval: number;
	/** Total duration of the effect in seconds */
	duration: number;
	/** Act message templates shown when this effect ticks */
	onTick?: EffectMessageTemplates;
}

/**
 * Shield effect template.
 * A passive effect that absorbs a fixed amount of damage.
 * Once the absorption potential is met, the effect is removed.
 */
export interface ShieldEffectTemplate extends BaseEffectTemplate {
	type: "shield";
	/** Amount of damage this shield can absorb */
	absorption: number;
	/** Optional damage type filter - if specified, only absorbs this damage type */
	damageType?: DAMAGE_TYPE;
	/** Optional maximum amount of damage this shield can absorb from a single hit */
	maxAbsorptionPerHit?: number;
	/** Percentage of incoming damage this shield will try to absorb (default: 1.0 = 100%) */
	absorptionRate?: number;
}

/**
 * Union type of all effect templates.
 */
export type EffectTemplate =
	| PassiveEffectTemplate
	| DamageOverTimeEffectTemplate
	| HealOverTimeEffectTemplate
	| ShieldEffectTemplate;

/**
 * Active effect instance that is applied to a mob.
 * Contains runtime data like when it expires and who cast it.
 */
export interface EffectInstance {
	/** The effect template this instance is based on */
	template: EffectTemplate;
	/** The mob that applied this effect (caster) */
	caster: Mob;
	/** Timestamp when this effect was applied (milliseconds since epoch) */
	appliedAt: number;
	/** Timestamp when this effect expires (milliseconds since epoch) */
	expiresAt: number;
	/** For DoT/HoT effects: timestamp of the next tick (milliseconds since epoch) */
	nextTickAt?: number;
	/** For DoT/HoT effects: number of ticks remaining */
	ticksRemaining?: number;
	/** For DoT/HoT effects: actual damage/heal amount per tick (may differ from template) */
	tickAmount?: number;
	/** For shield effects: remaining absorption capacity */
	remainingAbsorption?: number;
}

/**
 * Checks if an effect template is a passive effect.
 */
export function isPassiveEffect(
	effect: EffectTemplate
): effect is PassiveEffectTemplate {
	return effect.type === "passive";
}

/**
 * Checks if an effect template is a damage over time effect.
 */
export function isDamageOverTimeEffect(
	effect: EffectTemplate
): effect is DamageOverTimeEffectTemplate {
	return effect.type === "damage-over-time";
}

/**
 * Checks if an effect template is a heal over time effect.
 */
export function isHealOverTimeEffect(
	effect: EffectTemplate
): effect is HealOverTimeEffectTemplate {
	return effect.type === "heal-over-time";
}

/**
 * Checks if an effect template is a shield effect.
 */
export function isShieldEffect(
	effect: EffectTemplate
): effect is ShieldEffectTemplate {
	return effect.type === "shield";
}

/**
 * Checks if an effect instance has expired.
 */
export function isEffectExpired(effect: EffectInstance, now: number): boolean {
	return now >= effect.expiresAt;
}

/**
 * Checks if an effect instance should tick (for DoT/HoT effects).
 */
export function shouldEffectTick(effect: EffectInstance, now: number): boolean {
	if (!effect.nextTickAt) return false;
	return now >= effect.nextTickAt && (effect.ticksRemaining ?? 0) > 0;
}

/**
 * Override options for adding an effect to a mob.
 * Used to customize effect properties during application or restoration.
 */
export interface EffectOverrides {
	/** Override damage amount for damage-over-time effects */
	damage?: number;
	/** Override heal amount for heal-over-time effects */
	heal?: number;
	/** Override duration for timed effects */
	duration?: number;
	/** Restoration field: timestamp when effect was applied (for deserialization) */
	appliedAt?: number;
	/** Restoration field: timestamp when effect expires (for deserialization) */
	expiresAt?: number;
	/** Restoration field: timestamp of next tick (for DoT/HoT effects) */
	nextTickAt?: number;
	/** Restoration field: number of ticks remaining (for DoT/HoT effects) */
	ticksRemaining?: number;
	/** Restoration field: actual tick amount (for DoT/HoT effects) */
	tickAmount?: number;
	/** Restoration field: remaining absorption capacity (for shield effects) */
	remainingAbsorption?: number;
	/** Restoration field: time until next tick (for DoT/HoT effects, used during deserialization) */
	nextTickIn?: number;
}

/**
 * Serialized form for effect instances.
 * Stores effect template ID, caster OID, and runtime data.
 * Uses remaining durations instead of absolute timestamps to preserve effect duration across save/load.
 */
export interface SerializedEffect {
	/** Effect template ID */
	effectId: string;
	/** OID of the mob that applied this effect (caster) */
	casterOid: number;
	/** Remaining duration until effect expires (milliseconds), or undefined for permanent effects */
	remainingDuration?: number;
	/** For DoT/HoT effects: time until next tick (milliseconds) */
	nextTickIn?: number;
	/** For DoT/HoT effects: number of ticks remaining */
	ticksRemaining?: number;
	/** For DoT/HoT effects: actual damage/heal amount per tick */
	tickAmount?: number;
	/** For shield effects: remaining absorption capacity */
	remainingAbsorption?: number;
}
