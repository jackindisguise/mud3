/**
 * Effect processing system for mobs.
 *
 * Handles periodic processing of active effects (DoT/HoT) and expiration.
 * Effects are processed every second to handle ticks and remove expired effects.
 *
 * @module effects
 */

import { Mob } from "./core/dungeon.js";
import { MESSAGE_GROUP } from "./core/character.js";
import { COLOR, color } from "./core/color.js";
import {
	EffectInstance,
	isDamageOverTimeEffect,
	isHealOverTimeEffect,
	isEffectExpired,
	shouldEffectTick,
} from "./core/effect.js";
import { act, ActMessageTemplates } from "./act.js";
import { initiateCombat } from "./combat.js";
import { Room } from "./core/dungeon.js";

/**
 * Set of mobs that have active effects.
 * Mobs are added when they receive an effect and removed when all effects expire.
 */
const mobsWithEffects = new Set<Mob>();

/**
 * Effect processing interval in milliseconds (1 second).
 */
export const EFFECT_PROCESSING_INTERVAL_MS = 1000;

/**
 * Adds a mob to the effects processing set.
 * Called when a mob receives an effect.
 *
 * @param mob The mob to add
 */
export function addToEffectsSet(mob: Mob): void {
	mobsWithEffects.add(mob);
}

/**
 * Removes a mob from the effects processing set.
 * Called when a mob no longer has any effects.
 *
 * @param mob The mob to remove
 */
export function removeFromEffectsSet(mob: Mob): void {
	mobsWithEffects.delete(mob);
}

/**
 * Replaces placeholders in act message templates with actual values.
 *
 * @param templates The act message templates to process
 * @param replacements Map of placeholder names (without braces) to replacement values
 * @returns A new templates object with placeholders replaced
 */
function replaceActPlaceholders(
	templates: ActMessageTemplates,
	replacements: Record<string, string>
): ActMessageTemplates {
	const result: ActMessageTemplates = { ...templates };

	if (result.user) {
		for (const [key, value] of Object.entries(replacements)) {
			result.user = result.user.replace(new RegExp(`\\{${key}\\}`, "g"), value);
		}
	}

	if (result.room) {
		for (const [key, value] of Object.entries(replacements)) {
			result.room = result.room.replace(new RegExp(`\\{${key}\\}`, "g"), value);
		}
	}

	if (result.target) {
		for (const [key, value] of Object.entries(replacements)) {
			result.target = result.target.replace(
				new RegExp(`\\{${key}\\}`, "g"),
				value
			);
		}
	}

	return result;
}

/**
 * Processes a single effect instance, handling ticks and expiration.
 *
 * @param mob The mob that has the effect
 * @param effect The effect instance to process
 * @param now Current timestamp in milliseconds
 * @returns True if the effect should be removed (expired or finished)
 */
function processEffect(mob: Mob, effect: EffectInstance, now: number): boolean {
	// Check if effect has expired
	if (isEffectExpired(effect, now)) {
		return true; // Remove expired effect
	}

	// Process DoT/HoT ticks
	if (shouldEffectTick(effect, now)) {
		if (isDamageOverTimeEffect(effect.template)) {
			// Process damage over time tick
			const damage = effect.tickAmount ?? effect.template.damage;
			if (damage > 0) {
				// Send onTick act message if template has one
				if (effect.template.onTick && mob.location instanceof Room) {
					const templates = replaceActPlaceholders(effect.template.onTick, {
						damage: String(damage),
					});

					act(
						templates,
						{
							user: mob, // The mob affected by the effect
							target: effect.caster !== mob ? effect.caster : undefined, // The caster (if different from affected mob)
							room: mob.location,
						},
						{
							messageGroup: MESSAGE_GROUP.COMBAT,
							excludeTarget: true,
							excludeUser: true,
						}
					);
				} else {
					// Fallback to old message format if no onTick template
					const damageStr = color(String(damage), COLOR.CRIMSON);
					const effectName = color(effect.template.name, COLOR.LIME);
					mob.sendMessage(
						`You take ${damageStr} damage from ${effectName}.`,
						MESSAGE_GROUP.COMBAT
					);
				}

				// Deal damage
				mob.damage(effect.caster, damage);

				// If this is an offensive effect and target is not in combat, initiate combat
				if (
					effect.template.isOffensive &&
					!mob.isInCombat() &&
					mob.location instanceof Room &&
					effect.caster.location === mob.location
				) {
					initiateCombat(mob, effect.caster, true);
				}
			}

			// Update tick tracking
			effect.ticksRemaining = (effect.ticksRemaining ?? 0) - 1;
			if (effect.ticksRemaining && effect.ticksRemaining > 0) {
				const intervalMs = effect.template.interval * 1000;
				effect.nextTickAt = now + intervalMs;
			} else {
				// All ticks done, effect expires
				return true;
			}
		} else if (isHealOverTimeEffect(effect.template)) {
			// Process heal over time tick
			const heal = effect.tickAmount ?? effect.template.heal;
			if (heal > 0) {
				const oldHealth = mob.health;
				mob.health = Math.min(mob.maxHealth, mob.health + heal);
				const actualHeal = mob.health - oldHealth;

				if (actualHeal > 0) {
					// Send onTick act message if template has one
					if (effect.template.onTick && mob.location instanceof Room) {
						const templates = replaceActPlaceholders(effect.template.onTick, {
							heal: String(actualHeal),
						});

						act(
							templates,
							{
								user: mob, // The mob affected by the effect
								target: effect.caster !== mob ? effect.caster : undefined, // The caster (if different from affected mob)
								room: mob.location,
							},
							{ messageGroup: MESSAGE_GROUP.INFO }
						);
					} else {
						// Fallback to old message format if no onTick template
						const healStr = color(`+${actualHeal}`, COLOR.CRIMSON);
						const effectName = color(effect.template.name, COLOR.CYAN);
						mob.sendMessage(
							`You recover ${healStr} health from ${effectName}.`,
							MESSAGE_GROUP.INFO
						);
					}
				}
			}

			// Update tick tracking
			effect.ticksRemaining = (effect.ticksRemaining ?? 0) - 1;
			if (effect.ticksRemaining && effect.ticksRemaining > 0) {
				const intervalMs = effect.template.interval * 1000;
				effect.nextTickAt = now + intervalMs;
			} else {
				// All ticks done, effect expires
				return true;
			}
		}
	}

	return false; // Effect is still active
}

/**
 * Processes all effects for a single mob.
 * Removes expired effects and processes DoT/HoT ticks.
 *
 * @param mob The mob to process effects for
 */
function processMobEffects(mob: Mob): void {
	const effects = mob.getEffects();
	if (effects.size === 0) {
		removeFromEffectsSet(mob);
		return;
	}

	const now = Date.now();
	const effectsToRemove: EffectInstance[] = [];

	// Process each effect
	for (const effect of effects) {
		if (processEffect(mob, effect, now)) {
			effectsToRemove.push(effect);
		}
	}

	// Remove expired/finished effects
	for (const effect of effectsToRemove) {
		mob.removeEffect(effect);
	}

	// If no effects remain, remove from processing set
	if (mob.getEffects().size === 0) {
		removeFromEffectsSet(mob);
	}
}

/**
 * Processes effects for all mobs with active effects.
 * This function is called every second by the game loop.
 */
export function processEffects(): void {
	// Create a copy of the set to avoid modification during iteration
	const mobs = Array.from(mobsWithEffects);
	for (const mob of mobs) {
		processMobEffects(mob);
	}
}
