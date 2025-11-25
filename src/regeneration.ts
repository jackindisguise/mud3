/**
 * Regeneration system for mobs to recover health, mana, and reduce exhaustion over time.
 *
 * Mobs are added to the regeneration set when they take damage, lose mana, or gain exhaustion.
 * The regeneration interval runs every 30 seconds and applies different rates based on combat state.
 *
 * @module regeneration
 */

import { MESSAGE_GROUP } from "./character.js";
import { COLOR, color } from "./color.js";
import { Mob } from "./dungeon.js";

/**
 * Set of mobs that need to regenerate resources.
 * Mobs are added when they take damage, lose mana, or gain exhaustion.
 */
const regenerationSet = new Set<Mob>();

/**
 * Regeneration interval in milliseconds (30 seconds).
 */
export const REGENERATION_INTERVAL_MS = 30 * 1000;

/**
 * Default regeneration rate (when not in combat):
 * - 10% of max health
 * - 10% of max mana
 * - -10 exhaustion
 */
const DEFAULT_HEALTH_RATE = 0.1; // 10%
const DEFAULT_MANA_RATE = 0.1; // 10%
const DEFAULT_EXHAUSTION_RATE = 10;

/**
 * Combat regeneration rate (when in combat):
 * - 1% of max health
 * - 1% of max mana
 * - -1 exhaustion
 */
const COMBAT_HEALTH_RATE = 0.01; // 1%
const COMBAT_MANA_RATE = 0.01; // 1%
const COMBAT_EXHAUSTION_RATE = 1;

/**
 * Adds a mob to the regeneration set.
 * Called when a mob takes damage, loses mana, or gains exhaustion.
 *
 * @param mob The mob to add to regeneration
 */
export function addToRegenerationSet(mob: Mob): void {
	regenerationSet.add(mob);
}

/**
 * Removes a mob from the regeneration set.
 * Called when a mob is removed from the game or no longer needs regeneration.
 *
 * @param mob The mob to remove from regeneration
 */
export function removeFromRegenerationSet(mob: Mob): void {
	regenerationSet.delete(mob);
}

/**
 * Checks if a mob is in the regeneration set.
 *
 * @param mob The mob to check
 * @returns True if the mob is in the regeneration set
 */
export function isInRegenerationSet(mob: Mob): boolean {
	return regenerationSet.has(mob);
}

/**
 * Gets all mobs currently in the regeneration set.
 *
 * @returns Array of all mobs in the regeneration set
 */
export function getRegenerationSet(): Mob[] {
	return Array.from(regenerationSet);
}

/**
 * Spirit bonus multiplier per point of spirit.
 * Each point of spirit increases regeneration rates by 5%.
 */
export const SPIRIT_BONUS_PER_POINT = 0.05; // 5%

/**
 * Applies spirit bonus to a base regeneration rate.
 * Formula: baseRate * (1 + spirit * SPIRIT_BONUS_PER_POINT)
 *
 * @param baseRate The base regeneration rate (e.g., 0.1 for 10%)
 * @param spirit The mob's spirit attribute value
 * @returns The modified regeneration rate with spirit bonus applied
 */
export function applySpiritBonus(baseRate: number, spirit: number): number {
	return baseRate * (1 + spirit * SPIRIT_BONUS_PER_POINT);
}

function isFullyRegenerated(mob: Mob): boolean {
	return (
		mob.health >= mob.maxHealth &&
		mob.mana >= mob.maxMana &&
		mob.exhaustion <= 0
	);
}

/**
 * Processes regeneration for a single mob.
 * Applies different rates based on whether the mob is in combat.
 * Spirit attribute increases all regeneration rates by 5% per point.
 *
 * @param mob The mob to regenerate
 */
function processMobRegeneration(mob: Mob): void {
	if (isFullyRegenerated(mob)) {
		removeFromRegenerationSet(mob);
		return;
	}

	const isInCombat = mob.isInCombat();
	const baseHealthRate = isInCombat ? COMBAT_HEALTH_RATE : DEFAULT_HEALTH_RATE;
	const baseManaRate = isInCombat ? COMBAT_MANA_RATE : DEFAULT_MANA_RATE;
	const baseExhaustionRate = isInCombat
		? COMBAT_EXHAUSTION_RATE
		: DEFAULT_EXHAUSTION_RATE;

	// Apply spirit bonus to rates
	const spirit = mob.spirit;
	const healthRate = applySpiritBonus(baseHealthRate, spirit);
	const manaRate = applySpiritBonus(baseManaRate, spirit);
	const exhaustionRate = applySpiritBonus(baseExhaustionRate, spirit);

	// Regenerate health
	const diffHealth = mob.maxHealth - mob.health;
	const healthGain = Math.max(
		0,
		Math.min(diffHealth, Math.floor(mob.maxHealth * healthRate))
	); // 0 <= healthGain <= diffHealth
	mob.health += healthGain;

	// Regenerate mana
	const diffMana = mob.maxMana - mob.mana; // maximum we can gain
	const manaGain = Math.max(
		0,
		Math.min(diffMana, Math.floor(mob.maxMana * manaRate))
	); // 0 <= manaGain <= diffMana
	mob.mana += manaGain;

	// Reduce exhaustion
	const diffExhaustion = mob.exhaustion;
	const exhaustionLoss = Math.max(0, Math.min(diffExhaustion, exhaustionRate)); // 0 <= exhaustionLoss <= diffExhaustion
	mob.exhaustion -= exhaustionLoss;

	const recoveryParts: string[] = [];
	if (healthGain > 0) {
		recoveryParts.push(`${color(`+${healthGain}`, COLOR.CRIMSON)} health`);
	}
	if (manaGain > 0) {
		recoveryParts.push(`${color(`+${manaGain}`, COLOR.CYAN)} mana`);
	}
	if (exhaustionRate < 0) {
		recoveryParts.push(
			`${color(`-${exhaustionRate}`, COLOR.YELLOW)}% exhaustion`
		);
	}
	mob.sendMessage(
		`You regenerate ${recoveryParts.join(", ")}.`,
		MESSAGE_GROUP.INFO
	);

	if (isFullyRegenerated(mob)) {
		removeFromRegenerationSet(mob);
	}
}

/**
 * Processes regeneration for all mobs in the regeneration set.
 * This function is called every 30 seconds by the game loop.
 */
export function processRegeneration(): void {
	// Create a copy of the set to avoid modification during iteration
	const mobs = Array.from(regenerationSet);
	for (const mob of mobs) {
		processMobRegeneration(mob);
	}
}

/**
 * Rest regeneration rates:
 * - 33% of max health
 * - 33% of max mana
 * - -33 exhaustion
 */
const REST_HEALTH_RATE = 0.33; // 33%
const REST_MANA_RATE = 0.33; // 33%
const REST_EXHAUSTION_RATE = 33;

/**
 * Performs rest regeneration for a mob, recovering health, mana, and reducing exhaustion.
 * Applies spirit bonus to regeneration rates.
 *
 * @param mob The mob to rest
 * @returns Object containing the recovery amounts for messaging
 */
export function restRegeneration(mob: Mob): {
	healthGain: number;
	manaGain: number;
	exhaustionReduction: number;
} {
	// Apply spirit bonus to rest rates
	const spirit = mob.spirit;
	const healthRate = applySpiritBonus(REST_HEALTH_RATE, spirit);
	const manaRate = applySpiritBonus(REST_MANA_RATE, spirit);
	const exhaustionRate = applySpiritBonus(REST_EXHAUSTION_RATE, spirit);

	// Calculate recovery amounts
	const diffHealth = mob.maxHealth - mob.health;
	const healthGain = Math.max(
		0,
		Math.min(diffHealth, Math.floor(mob.maxHealth * healthRate))
	);
	const diffMana = mob.maxMana - mob.mana;
	const manaGain = Math.max(
		0,
		Math.min(diffMana, Math.floor(mob.maxMana * manaRate))
	);
	const diffExhaustion = mob.exhaustion;
	const exhaustionReduction = Math.max(
		0,
		Math.min(diffExhaustion, exhaustionRate)
	);

	// Apply recovery
	const oldHealth = mob.health;
	const oldMana = mob.mana;
	const oldExhaustion = mob.exhaustion;

	mob.health += healthGain;
	mob.mana += manaGain;
	mob.exhaustion -= exhaustionReduction;

	// Return actual gains (may be less if already at max)
	return {
		healthGain: mob.health - oldHealth,
		manaGain: mob.mana - oldMana,
		exhaustionReduction: oldExhaustion - mob.exhaustion,
	};
}
