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

/**
 * Message templates for effects (onApply/onTick).
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
 * Union type of all effect templates.
 */
export type EffectTemplate =
	| PassiveEffectTemplate
	| DamageOverTimeEffectTemplate
	| HealOverTimeEffectTemplate;

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
 * Serialized form for effect instances.
 * Stores effect template ID, caster OID, and runtime data.
 */
export interface SerializedEffect {
	/** Effect template ID */
	effectId: string;
	/** OID of the mob that applied this effect (caster) */
	casterOid: number;
	/** Timestamp when this effect was applied (milliseconds since epoch) */
	appliedAt: number;
	/** Timestamp when this effect expires (milliseconds since epoch) */
	expiresAt: number;
	/** For DoT/HoT effects: timestamp of the next tick (milliseconds since epoch) */
	nextTickAt?: number;
	/** For DoT/HoT effects: number of ticks remaining */
	ticksRemaining?: number;
	/** For DoT/HoT effects: actual damage/heal amount per tick */
	tickAmount?: number;
}
