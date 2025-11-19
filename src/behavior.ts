/**
 * Behavior system for mobs.
 *
 * Handles aggressive, wimpy, and wander behaviors for NPCs.
 *
 * @module behavior
 */

import {
	Mob,
	Room,
	DIRECTION,
	DIRECTIONS,
	WANDERING_MOBS,
	BEHAVIOR,
} from "./dungeon.js";
import { initiateCombat, removeFromCombatQueue } from "./combat.js";
import { act } from "./act.js";
import { MESSAGE_GROUP } from "./character.js";
import { findPathAStar } from "./pathfinding.js";
import logger from "./logger.js";

/**
 * Process aggressive behavior: attack any mobs that enter the room.
 * Called when a mob enters a room.
 *
 * @param aggressiveMob The aggressive mob that should check for targets
 * @param room The room where the mob entered
 * @param enteringMob The mob that just entered (may be the aggressive mob itself)
 */
export function processAggressiveBehavior(
	aggressiveMob: Mob,
	room: Room,
	enteringMob: Mob
): void {
	// Only NPCs can be aggressive
	if (aggressiveMob.character) {
		return;
	}

	// Check if mob has aggressive behavior
	if (!aggressiveMob.hasBehavior(BEHAVIOR.AGGRESSIVE)) {
		return;
	}

	// Don't attack self
	if (aggressiveMob === enteringMob) {
		return;
	}

	// Don't attack if already in combat
	if (aggressiveMob.isInCombat()) {
		return;
	}

	// Don't attack if dead
	if (aggressiveMob.health <= 0) {
		return;
	}

	// Don't attack if entering mob is dead
	if (enteringMob.health <= 0) {
		return;
	}

	// Aggressive mobs attack any characters that enter their room
	if (aggressiveMob.hasBehavior(BEHAVIOR.WANDER)) {
		// Aggressive wanderers only attack characters
		if (enteringMob.character) initiateCombat(aggressiveMob, enteringMob, room);
	}
}

/**
 * Process wimpy behavior: randomly flee combat when health reaches 25%.
 * Called during combat processing.
 *
 * @param wimpyMob The wimpy mob to check
 * @param room The room where combat is occurring
 * @returns true if the mob fled, false otherwise
 */
export function processWimpyBehavior(wimpyMob: Mob, room: Room): boolean {
	// Only NPCs can be wimpy
	if (wimpyMob.character) {
		return false;
	}

	// Check if mob has wimpy behavior
	if (!wimpyMob.hasBehavior(BEHAVIOR.WIMPY)) {
		return false;
	}

	// Only flee if in combat
	if (!wimpyMob.isInCombat()) {
		return false;
	}

	// Check if health is at or below 25%
	const healthPercent = (wimpyMob.health / wimpyMob.maxHealth) * 100;
	if (healthPercent > 25) {
		return false;
	}

	// Random chance to flee (50% chance)
	if (Math.random() < 0.5) {
		return false;
	}

	// Find a random valid exit
	const validDirections: DIRECTION[] = [];
	for (const dir of DIRECTIONS) {
		if (wimpyMob.canStep(dir)) {
			const destination = wimpyMob.getStep(dir);
			if (destination instanceof Room) {
				validDirections.push(dir);
			}
		}
	}

	// If no valid exits, can't flee
	if (validDirections.length === 0) {
		return false;
	}

	// Pick a random direction and flee
	const randomDir =
		validDirections[Math.floor(Math.random() * validDirections.length)];
	const destination = wimpyMob.getStep(randomDir);

	if (destination instanceof Room) {
		// Clear combat target
		wimpyMob.combatTarget = undefined;
		removeFromCombatQueue(wimpyMob);

		// Move to the destination
		wimpyMob.step(randomDir);

		// Send flee message
		act(
			{
				user: "You flee in terror!",
				room: "{User} flees in terror!",
			},
			{
				user: wimpyMob,
				room: room,
			}
		);

		return true;
	}

	return false;
}

/**
 * Process wander behavior: randomly move to an adjacent room.
 * Called periodically for wandering mobs.
 *
 * @param wanderingMob The mob that should wander
 * @returns true if the mob moved, false otherwise
 */
export function processWanderBehavior(wanderingMob: Mob): boolean {
	// Only NPCs can wander
	if (wanderingMob.character) {
		return false;
	}

	// Check if mob has wander behavior
	if (!wanderingMob.hasBehavior(BEHAVIOR.WANDER)) {
		return false;
	}

	// Don't wander if not in a room
	if (!(wanderingMob.location instanceof Room)) {
		return false;
	}

	// Don't wander if in combat
	if (wanderingMob.isInCombat()) {
		logger.debug(`Wander: ${wanderingMob.display} skipping - in combat`);
		return false;
	}

	// Don't wander if dead
	if (wanderingMob.health <= 0) {
		logger.debug(`Wander: ${wanderingMob.display} skipping - dead`);
		return false;
	}

	// Random chance to wander (30% chance per tick)
	if (Math.random() >= 0.3) {
		return false;
	}

	const currentRoom = wanderingMob.location as Room;
	const dungeon = currentRoom.dungeon;
	if (!dungeon) {
		logger.debug(`Wander: ${wanderingMob.display} skipping - no dungeon`);
		return false;
	}

	logger.debug(
		`Wander: ${wanderingMob.display} attempting to wander from room at ${currentRoom.x},${currentRoom.y},${currentRoom.z}`
	);

	const dimensions = dungeon.dimensions;
	const totalRooms = dimensions.width * dimensions.height * dimensions.layers;

	// Pick a random room from the dungeon
	let attempts = 0;
	const maxAttempts = 10; // Try up to 10 random rooms before giving up
	let targetRoom: Room | undefined;
	let path: { directions: DIRECTION[]; cost: number } | undefined;

	while (attempts < maxAttempts && !path) {
		attempts++;
		// Pick random coordinates
		const x = Math.floor(Math.random() * dimensions.width);
		const y = Math.floor(Math.random() * dimensions.height);
		const z = Math.floor(Math.random() * dimensions.layers);

		const candidateRoom = dungeon.getRoom(x, y, z);
		if (!candidateRoom) continue; // Skip if room doesn't exist
		if (candidateRoom === currentRoom) continue; // Skip current room
		if (candidateRoom.dense) continue; // Skip dense rooms

		// Try to find a path to this room
		const candidatePath = findPathAStar(currentRoom, candidateRoom, {
			maxNodes: 100, // Limit search to avoid performance issues
		});

		if (candidatePath && candidatePath.directions.length > 0) {
			targetRoom = candidateRoom;
			path = candidatePath;
			break;
		}
	}

	// If we found a path, walk the first 5 steps (or all steps if path is shorter)
	if (path && targetRoom) {
		const stepsToTake = Math.min(5, path.directions.length);
		const targetCoords = targetRoom.coordinates;
		logger.debug(
			`Wander: ${wanderingMob.display} found path to room at ${targetCoords.x},${targetCoords.y},${targetCoords.z} (${path.directions.length} steps), taking first ${stepsToTake} step(s)`
		);

		// Walk up to 5 steps
		for (let i = 0; i < stepsToTake; i++) {
			const direction = path.directions[i];
			if (!wanderingMob.step(direction)) {
				logger.debug(
					`Wander: ${wanderingMob.display} failed to step ${
						i + 1
					}/${stepsToTake}, stopping`
				);
				return i > 0; // Return true if we took at least one step
			}
		}
		return true;
	}

	// If no path found, fall back to adjacent rooms
	logger.debug(
		`Wander: ${wanderingMob.display} no path found after ${attempts} attempts, falling back to adjacent rooms`
	);
	// Find valid exits
	const validDirections: DIRECTION[] = [];
	for (const dir of DIRECTIONS) {
		if (wanderingMob.canStep(dir)) {
			const destination = wanderingMob.getStep(dir);
			if (destination instanceof Room) {
				validDirections.push(dir);
			}
		}
	}

	if (validDirections.length === 0) {
		logger.debug(
			`Wander: ${wanderingMob.display} no valid adjacent exits, cannot wander`
		);
		return false;
	}

	// Pick a random direction and move
	const randomDir =
		validDirections[Math.floor(Math.random() * validDirections.length)];
	logger.debug(
		`Wander: ${wanderingMob.display} moving to adjacent room (fallback)`
	);
	return wanderingMob.step(randomDir);
}

/**
 * Process all wandering mobs in all dungeons.
 * Called periodically by the game loop.
 */
export function processWanderBehaviors(): void {
	// Iterate through the wandering mobs cache
	for (const mob of WANDERING_MOBS) {
		processWanderBehavior(mob);
	}
}
