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
import { getLocation, LOCATION } from "./package/locations.js";
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
import { showRoom } from "./commands/look.js";

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
			// Use initiateCombat to properly set up combat with new target
			initiateCombat(npc, highestThreat, npcRoom);
		}
		return;
	}

	// Check if current target is still in the same room
	if (currentTarget.location !== npcRoom) {
		// Current target left the room, find a new target that's actually in the room
		const highestThreat = getHighestThreatInRoom(npc, npcRoom);
		if (highestThreat) {
			// Use initiateCombat to properly set up combat with new target
			initiateCombat(npc, highestThreat, npcRoom);
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
		initiateCombat(npc, highestThreatMob, npcRoom);
	}
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
			user: "You have been slain by {target}!",
			room: "{User} has been slain!",
		},
		{
			user: deadMob,
			target: killer,
			room: room,
		},
		{
			messageGroup: MESSAGE_GROUP.COMBAT,
			excludeUser: true,
			excludeTarget: true,
		}
	);

	// Award experience to killer if present
	if (killer) {
		if (!killer.character) {
			processThreatSwitching(killer);
		} else {
			if (killer.combatTarget === deadMob) killer.combatTarget = undefined;
			killer.sendMessage(`You have slain ${deadMob}!`, MESSAGE_GROUP.COMBAT);
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
	}

	// delete NPCs
	if (!deadMob.character) {
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

	// TODO: Handle loot, etc.
}

/**
 * Processes a single combat round for a mob.
 * The mob attacks its target if it has one and is still in the same room.
 *
 * @param mob The mob to process a combat round for
 */
function processMobCombatRound(mob: Mob): void {
	if (mob.health <= 0) {
		mob.combatTarget = undefined;
		return;
	}

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

	// Check if target is dead
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

	// Perform the hit (oneHit handles accuracy checks, damage calculation, messages, and damage dealing)
	const mainHand = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
	const weapon = mainHand instanceof Weapon ? mainHand : undefined;
	mob.oneHit({ target: mob.combatTarget, weapon });

	// extra hit when dual wielding
	const offHand = mob.getEquipped(EQUIPMENT_SLOT.OFF_HAND);
	const weaponOff = offHand instanceof Weapon ? offHand : undefined;
	if (weaponOff) mob.oneHit({ target: mob.combatTarget, weapon: weaponOff });
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
		processMobCombatRound(mob);
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

	// If defender is an NPC, add threat and potentially switch target
	// addThreat will call processThreatSwitching, which will set defender's target if needed
	if (!defender.character && defender.getThreat(attacker) === 0) {
		// Initial threat from engagement
		defender.addThreat(attacker, 1);
	}

	// If defender doesn't have a target (e.g., defender is a player character), set attacker as target
	if (!defender.combatTarget) {
		initiateCombat(defender, attacker, room);
	}
}
