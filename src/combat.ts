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

import { Mob, Room, Weapon, EQUIPMENT_SLOT } from "./dungeon.js";
import { Character, MESSAGE_GROUP } from "./character.js";
import { color, COLOR } from "./color.js";
import { LINEBREAK } from "./telnet.js";
import logger from "./logger.js";
import {
	act,
	damageMessage,
	ActMessageTemplates,
	ActContext,
	ActOptions,
} from "./act.js";
import {
	getDamageMultiplier,
	DAMAGE_TYPE,
	HitType,
	getThirdPersonVerb,
} from "./damage-types.js";

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
 *
 * @param mob The mob to remove from combat
 */
export function removeFromCombatQueue(mob: Mob): void {
	combatQueue.delete(mob);
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
 * Processes threat-based target switching for NPCs.
 * NPCs will switch targets if a new attacker has 10% more threat than the current target.
 *
 * @param npc The NPC mob to process threat switching for
 */
function processThreatSwitching(npc: Mob): void {
	if (!npc.threatTable || npc.character) {
		return;
	}

	const currentTarget = npc.combatTarget;
	if (!currentTarget) {
		// No current target, pick highest threat
		const highestThreat = npc.getHighestThreatTarget();
		if (highestThreat) {
			npc.combatTarget = highestThreat;
		}
		return;
	}

	const currentThreat = npc.getThreat(currentTarget);
	const highestThreatMob = npc.getHighestThreatTarget();

	if (!highestThreatMob || highestThreatMob === currentTarget) {
		return;
	}

	const highestThreat = npc.getThreat(highestThreatMob);
	const graceThreshold = currentThreat * THREAT_GRACE_WINDOW;

	if (highestThreat >= graceThreshold) {
		npc.combatTarget = highestThreatMob;
	}
}

/**
 * Calculates damage dealt by an attacker to a defender.
 * This function assumes the attack has already hit - accuracy checks should be done before calling.
 * Takes into account attack power, defense, critical hits, and damage type relationships.
 *
 * @param attacker The mob dealing damage
 * @param defender The mob receiving damage
 * @param damageType The type of damage being dealt
 * @returns The damage amount (always >= 0)
 */
function calculateDamage(
	attacker: Mob,
	defender: Mob,
	damageType: DAMAGE_TYPE
): number {
	// Calculate base damage
	let damage = attacker.attackPower;

	// Apply defense reduction
	const defenseReduction = defender.defense * 0.1; // 10% damage reduction per defense point
	damage = Math.max(1, damage - defenseReduction);

	// Check for critical hit
	if (Math.random() * 100 < attacker.critRate) {
		damage *= 2;
	}

	// Apply damage type relationships (resist, immune, vulnerable)
	const defenderRelationships = defender.getDamageRelationships();
	const damageMultiplier = getDamageMultiplier(
		damageType,
		defenderRelationships
	);
	damage *= damageMultiplier;

	return Math.floor(damage);
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
	const room = deadMob.location;
	if (!room || !(room instanceof Room)) {
		return; // Can't handle death if not in a room
	}

	// Remove from combat
	deadMob.combatTarget = undefined;
	removeFromCombatQueue(deadMob);

	// Clear threat table
	deadMob.clearThreatTable();

	// Remove threat from other mobs' threat tables
	for (const mob of room.contents) {
		if (mob instanceof Mob) {
			mob.removeThreat(deadMob);
		}
	}

	// Send death messages
	act(
		{
			user: "{User} has been slain!",
			room: "{User} has been slain!",
		},
		{
			user: deadMob,
			room: room,
		},
		{ messageGroup: MESSAGE_GROUP.COMBAT, excludeUser: true }
	);

	// Award experience to killer if present
	if (killer && killer.character) {
		// Only players gain experience
		const experienceGained = killer.awardKillExperience(deadMob.level);
		if (experienceGained > 0) {
			// Send experience message to the killer
			killer.character.sendMessage(
				`You gain ${experienceGained} experience!`,
				MESSAGE_GROUP.INFO
			);
		}
	}

	// TODO: Handle loot, etc.
}

/**
 * Processes a single combat round for a mob.
 * The mob attacks its target if it has one and is still in the same room.
 *
 * @param mob The mob to process a combat round for
 */
function processMobCombatRound(mob: Mob): void {
	const target = mob.combatTarget;
	if (!target) {
		removeFromCombatQueue(mob);
		return;
	}

	// Check if target is still in the same room
	const mobRoom = mob.location;
	if (!mobRoom || !(mobRoom instanceof Room)) {
		removeFromCombatQueue(mob);
		mob.combatTarget = undefined;
		return;
	}

	if (target.location !== mobRoom) {
		// Target left the room, disengage
		mob.combatTarget = undefined;
		removeFromCombatQueue(mob);
		return;
	}

	// Check if target is dead
	if (target.health <= 0) {
		mob.combatTarget = undefined;
		removeFromCombatQueue(mob);
		return;
	}

	// Process threat switching for NPCs
	if (!mob.character) {
		processThreatSwitching(mob);
		const newTarget = mob.combatTarget;
		if (newTarget !== target) {
			// Target switched, skip this round
			return;
		}
	}

	// Perform the hit (oneHit handles accuracy checks, damage calculation, messages, and damage dealing)
	const mainHand = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
	const weapon = mainHand instanceof Weapon ? mainHand : undefined;
	mob.oneHit({ target, weapon });
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
	for (const mob of sortedMobs) {
		// Check if mob is still valid (not destroyed, still in a room)
		if (mob.location instanceof Room && mob.isInCombat()) {
			processMobCombatRound(mob);
		} else {
			// Mob is invalid, remove from queue
			removeFromCombatQueue(mob);
			mob.combatTarget = undefined;
		}
	}
}

/**
 * Initiates combat between two mobs.
 * The attacker engages the defender, and both are added to the combat queue.
 *
 * @param attacker The mob initiating combat
 * @param defender The mob being attacked
 * @param room The room where combat is occurring
 */
export function initiateCombat(attacker: Mob, defender: Mob, room: Room): void {
	// Set attacker's target
	attacker.combatTarget = defender;
	addToCombatQueue(attacker);

	// If defender is an NPC, add threat and potentially switch target
	if (!defender.character && defender.threatTable) {
		// Initial threat from engagement
		defender.addThreat(attacker, 1);
		processThreatSwitching(defender);
	}

	// If defender doesn't have a target, set attacker as target
	if (!defender.combatTarget) {
		defender.combatTarget = attacker;
		addToCombatQueue(defender);
	}

	// Send engagement messages
	act(
		{
			user: "You engage {target} in combat!",
			target: "{User} engages you in combat!",
			room: "{User} engages {target} in combat!",
		},
		{
			user: attacker,
			target: defender,
			room: room,
		},
		{ messageGroup: MESSAGE_GROUP.COMBAT }
	);
}
