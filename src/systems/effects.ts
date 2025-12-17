/**
 * Effect processing system for mobs.
 *
 * Handles individual timers for each effect instance, processing ticks and expiration
 * at the exact times they should occur rather than polling.
 *
 * @module effects
 */

import { Mob } from "../core/dungeon.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { COLOR, color } from "../core/color.js";
import {
	EffectInstance,
	isDamageOverTimeEffect,
	isHealOverTimeEffect,
	isEffectExpired,
	shouldEffectTick,
} from "../core/effect.js";
import { act, ActMessageTemplates } from "./act.js";
import { initiateCombat, processEffectDamage } from "./combat.js";
import { Room } from "../core/dungeon.js";

/**
 * Set of mobs that have active effects.
 * Mobs are added when they receive an effect and removed when all effects expire.
 */
const mobsWithEffects = new Set<Mob>();

/**
 * Map of effect instances to their associated timers.
 * Each effect can have an expiration timer and/or a tick timer.
 */
interface EffectTimers {
	expirationTimer?: NodeJS.Timeout;
	tickTimer?: NodeJS.Timeout;
}

const effectTimers = new Map<EffectInstance, EffectTimers>();

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
 * Clears all timers associated with an effect instance.
 *
 * @param effect The effect instance to clear timers for
 */
function clearEffectTimers(effect: EffectInstance): void {
	const timers = effectTimers.get(effect);
	if (timers) {
		if (timers.expirationTimer) {
			clearTimeout(timers.expirationTimer);
		}
		if (timers.tickTimer) {
			clearInterval(timers.tickTimer);
		}
		effectTimers.delete(effect);
	}
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

	return result;
}

/**
 * Processes a single effect tick for a DoT/HoT effect.
 * Called by the tick timer when it's time for an effect to tick.
 *
 * @param mob The mob that has the effect
 * @param effect The effect instance to process
 */
function processEffectTick(mob: Mob, effect: EffectInstance): void {
	const now = Date.now();

	// Check if effect has expired (shouldn't happen, but safety check)
	if (isEffectExpired(effect, now)) {
		mob.removeEffect(effect);
		return;
	}

	// Check if it's actually time to tick
	if (!shouldEffectTick(effect, now)) {
		return;
	}

	// Process the tick
	if (isDamageOverTimeEffect(effect.template)) {
		// Process damage over time tick
		const baseDamage = effect.tickAmount ?? effect.template.damage;
		if (baseDamage > 0) {
			// Send onTick act message if template has one (before damage calculation)
			// This allows the message to show the base damage amount
			if (effect.template.onTick && mob.location instanceof Room) {
				const templates = replaceActPlaceholders(effect.template.onTick, {
					damage: String(baseDamage),
				});

				act(
					templates,
					{
						user: mob, // The mob affected by the effect
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
				const damageStr = color(String(baseDamage), COLOR.CRIMSON);
				const effectName = color(effect.template.name, COLOR.LIME);
				mob.sendMessage(
					`You take ${damageStr} damage from ${effectName}.`,
					MESSAGE_GROUP.COMBAT
				);
			}

			// Process effect damage (handles mitigation, damage type relationships, etc.)
			processEffectDamage({
				target: mob,
				effect: effect,
				damage: baseDamage,
			});

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
			mob.removeEffect(effect, true);
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
			mob.removeEffect(effect, true);
		}
	}
}

/**
 * Sets up timers for a newly added effect instance.
 * Creates an expiration timer and, for DoT/HoT effects, a tick timer.
 *
 * @param mob The mob that has the effect
 * @param effect The effect instance to set up timers for
 */
export function setupEffectTimers(mob: Mob, effect: EffectInstance): void {
	const now = Date.now();
	const timers: EffectTimers = {};

	// Set up expiration timer (unless it's a passive effect that never expires)
	if (effect.expiresAt !== Number.MAX_SAFE_INTEGER) {
		const timeUntilExpiration = effect.expiresAt - now;
		if (timeUntilExpiration > 0) {
			timers.expirationTimer = setTimeout(() => {
				// Effect has expired, clear all timers and remove it
				clearEffectTimers(effect);
				mob.removeEffect(effect);
			}, timeUntilExpiration);
		}
	}

	// Set up tick timer for DoT/HoT effects
	if (
		effect.nextTickAt &&
		(effect.ticksRemaining ?? 0) > 0 &&
		effect.expiresAt !== Number.MAX_SAFE_INTEGER
	) {
		const intervalMs = isDamageOverTimeEffect(effect.template)
			? effect.template.interval * 1000
			: isHealOverTimeEffect(effect.template)
			? effect.template.interval * 1000
			: 0;

		if (intervalMs > 0) {
			const timeUntilFirstTick = effect.nextTickAt - now;
			if (timeUntilFirstTick > 0) {
				// Set up initial tick timer
				timers.tickTimer = setTimeout(() => {
					processEffectTick(mob, effect);

					// After first tick, set up recurring interval for remaining ticks
					const currentTimers = effectTimers.get(effect);
					if (
						currentTimers &&
						effect.ticksRemaining &&
						effect.ticksRemaining > 0 &&
						!isEffectExpired(effect, Date.now())
					) {
						// Clear the one-time timer and replace with interval
						if (currentTimers.tickTimer) {
							clearTimeout(currentTimers.tickTimer);
						}

						currentTimers.tickTimer = setInterval(() => {
							// Check if effect still exists and hasn't expired
							if (
								!mob.getEffects().has(effect) ||
								isEffectExpired(effect, Date.now())
							) {
								clearEffectTimers(effect);
								return;
							}

							processEffectTick(mob, effect);

							// If effect was removed or expired, clear timers
							if (!mob.getEffects().has(effect)) {
								clearEffectTimers(effect);
							}
						}, intervalMs);
					}
				}, timeUntilFirstTick);
			} else {
				// First tick is due immediately, process it and set up interval
				processEffectTick(mob, effect);

				// Set up recurring interval for remaining ticks
				if (
					effect.ticksRemaining &&
					effect.ticksRemaining > 0 &&
					!isEffectExpired(effect, Date.now())
				) {
					timers.tickTimer = setInterval(() => {
						// Check if effect still exists and hasn't expired
						if (
							!mob.getEffects().has(effect) ||
							isEffectExpired(effect, Date.now())
						) {
							clearEffectTimers(effect);
							return;
						}

						processEffectTick(mob, effect);

						// If effect was removed or expired, clear timers
						if (!mob.getEffects().has(effect)) {
							clearEffectTimers(effect);
						}
					}, intervalMs);
				}
			}
		}
	}

	effectTimers.set(effect, timers);
}

/**
 * Clears timers for an effect instance when it's removed.
 * This should be called when an effect is removed from a mob.
 *
 * @param effect The effect instance to clear timers for
 */
export function clearEffectTimersForEffect(effect: EffectInstance): void {
	clearEffectTimers(effect);
}
