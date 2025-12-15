/**
 * Resource cost utility functions.
 *
 * Helper functions for checking and consuming resource costs (mana, exhaustion)
 * for commands and abilities.
 *
 * @module utils/resources
 */

import { Mob } from "../core/dungeon.js";
import { MESSAGE_GROUP } from "../core/character.js";

/**
 * Calculates the actual exhaustion cost after applying endurance mitigation.
 * Every 50 endurance provides a 50% reduction in exhaustion cost.
 * Formula: actualCost = baseCost * (0.5 ^ (endurance / 50))
 *
 * @param baseCost The base exhaustion cost before mitigation
 * @param endurance The mob's endurance attribute
 * @returns The actual exhaustion cost after endurance mitigation
 *
 * @example
 * ```typescript
 * // 50 endurance: 50% reduction
 * calculateExhaustionCost(10, 50); // 5
 * // 100 endurance: 75% reduction
 * calculateExhaustionCost(10, 100); // 2.5
 * // 150 endurance: 87.5% reduction
 * calculateExhaustionCost(10, 150); // 1.25
 * ```
 */
export function calculateExhaustionCost(
	baseCost: number,
	endurance: number
): number {
	if (endurance <= 0) {
		return baseCost;
	}
	// Formula: multiplier = 0.5 ^ (endurance / 50)
	// This gives us compounding 50% reductions every 50 endurance
	const multiplier = Math.pow(0.5, endurance / 50);
	return baseCost * multiplier;
}

/**
 * Checks if a mob has enough exhaustion to perform an action.
 * Takes into account endurance mitigation when calculating the actual cost.
 *
 * @param mob The mob to check
 * @param cost The base exhaustion cost to check (before endurance mitigation)
 * @returns True if the mob has enough exhaustion capacity remaining
 *
 * @example
 * ```typescript
 * if (!hasEnoughExhaustion(player, 10)) {
 *   player.sendMessage("You are too exhausted!");
 *   return;
 * }
 * ```
 */
export function hasEnoughExhaustion(mob: Mob, cost: number): boolean {
	const actualCost = calculateExhaustionCost(cost, mob.endurance);
	return mob.exhaustion + actualCost <= 100;
}

/**
 * Checks if a mob has enough mana to perform an action.
 *
 * @param mob The mob to check
 * @param cost The mana cost to check
 * @returns True if the mob has enough mana
 *
 * @example
 * ```typescript
 * if (!hasEnoughMana(player, 50)) {
 *   player.sendMessage("You don't have enough mana!");
 *   return;
 * }
 * ```
 */
export function hasEnoughMana(mob: Mob, cost: number): boolean {
	return mob.mana >= cost;
}

/**
 * Attempts to consume exhaustion from a mob.
 * Takes into account endurance mitigation when calculating the actual cost.
 * Sends an error message if the mob doesn't have enough exhaustion capacity.
 *
 * @param mob The mob to consume exhaustion from
 * @param cost The base amount of exhaustion to gain (before endurance mitigation)
 * @param errorMessage Optional custom error message (default: "You are too exhausted!")
 * @returns True if exhaustion was successfully consumed, false otherwise
 *
 * @example
 * ```typescript
 * if (!consumeExhaustion(player, 10)) {
 *   return; // Error message already sent
 * }
 * // Continue with action
 * ```
 */
export function consumeExhaustion(
	mob: Mob,
	cost: number,
	errorMessage?: string
): boolean {
	const actualCost = calculateExhaustionCost(cost, mob.endurance);
	if (mob.exhaustion + actualCost > 100) {
		mob.sendMessage(
			errorMessage ?? "You are too exhausted!",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}
	mob.gainExhaustion(actualCost);
	return true;
}

/**
 * Attempts to consume mana from a mob.
 * Sends an error message if the mob doesn't have enough mana.
 *
 * @param mob The mob to consume mana from
 * @param cost The amount of mana to consume
 * @param errorMessage Optional custom error message (default: "You don't have enough mana!")
 * @returns True if mana was successfully consumed, false otherwise
 *
 * @example
 * ```typescript
 * if (!consumeMana(player, 50)) {
 *   return; // Error message already sent
 * }
 * // Continue with spell
 * ```
 */
export function consumeMana(
	mob: Mob,
	cost: number,
	errorMessage?: string
): boolean {
	if (!hasEnoughMana(mob, cost)) {
		mob.sendMessage(
			errorMessage ?? "You don't have enough mana!",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}
	mob.mana = mob.mana - cost;
	return true;
}

/**
 * Calculates the mana cost for a spell based on proficiency.
 * The cost scales inversely with proficiency:
 * - At 0% proficiency: cost = baseCost
 * - At 100% proficiency: cost = baseCost * 0.5
 *
 * @param baseCost The base mana cost (at 0% proficiency)
 * @param proficiencyPercent The proficiency percentage (0-100)
 * @returns The calculated mana cost
 *
 * @example
 * ```typescript
 * // For a spell that costs 100 mana at 0% proficiency
 * const cost = calculateProficiencyManaCost(100, 0);   // 100
 * const cost = calculateProficiencyManaCost(100, 50);   // 75
 * const cost = calculateProficiencyManaCost(100, 100);  // 50
 * ```
 */
export function calculateProficiencyManaCost(
	baseCost: number,
	proficiencyPercent: number
): number {
	// Formula: cost = baseCost * (1 - proficiencyPercent / 200)
	// At 0%: cost = baseCost * 1 = baseCost
	// At 100%: cost = baseCost * 0.5 = baseCost / 2
	return Math.floor(baseCost * (1 - proficiencyPercent / 200));
}
