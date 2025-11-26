/**
 * Registry: dungeon - centralized dungeon access
 *
 * Provides a centralized location for accessing registered dungeons,
 * room links, and wandering mobs. The registries are populated by the
 * dungeon classes and package layer.
 *
 * @module registry/dungeon
 */

import { Dungeon, Room, RoomLink, Mob } from "../dungeon.js";

/**
 * Registry of dungeons by their optional persistent ID.
 * Only dungeons with an assigned `id` are present in this map.
 */
const SAFE_DUNGEON_REGISTRY: Map<string, Dungeon> = new Map();

/**
 * Readonly view of the dungeon registry.
 */
const READONLY_DUNGEON_REGISTRY: ReadonlyMap<string, Dungeon> =
	SAFE_DUNGEON_REGISTRY;
export { READONLY_DUNGEON_REGISTRY as DUNGEON_REGISTRY };

/**
 * Global cache of mobs that have the WANDER behavior enabled.
 * This cache is maintained automatically when behaviors are toggled.
 * Used to efficiently find all mobs that need to wander periodically.
 */
const SAFE_WANDERING_MOBS: Set<Mob> = new Set();

/**
 * Readonly view of the wandering mobs cache.
 */
const READONLY_WANDERING_MOBS: ReadonlySet<Mob> = SAFE_WANDERING_MOBS;
export { READONLY_WANDERING_MOBS as WANDERING_MOBS };

/**
 * Global registry of created RoomLink instances.
 * This array is intentionally module-level so the application can iterate
 * and persist links across dungeons. Links created by `RoomLink.createTunnel`
 * are pushed here; `RoomLink.remove()` removes links from this array.
 */
const SAFE_ROOM_LINKS: RoomLink[] = [];

/**
 * Readonly view of the room links registry.
 */
const READONLY_ROOM_LINKS: ReadonlyArray<RoomLink> = SAFE_ROOM_LINKS;
export { READONLY_ROOM_LINKS as ROOM_LINKS };

/**
 * Register a dungeon in the registry.
 * @param id The dungeon ID
 * @param dungeon The dungeon instance
 * @throws Error if the ID is already in use
 */
export function registerDungeon(id: string, dungeon: Dungeon): void {
	if (SAFE_DUNGEON_REGISTRY.has(id)) {
		throw new Error(`Dungeon id "${id}" is already in use`);
	}
	SAFE_DUNGEON_REGISTRY.set(id, dungeon);
}

/**
 * Unregister a dungeon from the registry.
 * @param id The dungeon ID to unregister
 */
export function unregisterDungeon(id: string): void {
	SAFE_DUNGEON_REGISTRY.delete(id);
}

/**
 * Check if a dungeon ID is registered.
 * @param id The dungeon ID to check
 * @returns true if the ID is registered
 */
export function hasDungeon(id: string): boolean {
	return SAFE_DUNGEON_REGISTRY.has(id);
}

/**
 * Lookup a dungeon previously registered with an ID.
 *
 * Only dungeons that were created with an `id` option or had their `id`
 * property set will be present in the registry. This function provides a
 * global lookup mechanism for retrieving dungeon instances by their unique
 * identifier, which is useful for serialization, room references, and
 * cross-dungeon navigation.
 *
 * @param id The dungeon id to look up
 * @returns The Dungeon instance or undefined when not found
 *
 * @example
 * ```typescript
 * // Create a dungeon with an ID
 * const dungeon = new Dungeon({
 *   id: "midgar",
 *   dimensions: { width: 10, height: 10, layers: 3 }
 * });
 *
 * // Look it up later from anywhere
 * const found = getDungeonById("midgar");
 * console.log(found === dungeon); // true
 * ```
 */
export function getDungeonById(id: string): Dungeon | undefined {
	return SAFE_DUNGEON_REGISTRY.get(id);
}

/**
 * Get all registered dungeon IDs.
 * @returns Array of all registered dungeon IDs
 */
export function getRegisteredDungeonIds(): string[] {
	return Array.from(SAFE_DUNGEON_REGISTRY.keys());
}

/**
 * Get all registered dungeons.
 * @returns Array of all registered dungeon instances
 */
export function getAllDungeons(): Dungeon[] {
	return Array.from(SAFE_DUNGEON_REGISTRY.values());
}

/**
 * Parse a room reference string and return the corresponding Room.
 * The format is `@dungeon-id{x,y,z}` where dungeon-id is the registered
 * dungeon identifier and x,y,z are the numeric coordinates.
 *
 * @param roomRef The room reference string in format `@dungeon-id{x,y,z}`
 * @returns The Room instance if found, undefined if the format is invalid,
 *          the dungeon doesn't exist, or the coordinates are out of bounds
 *
 * @example
 * ```typescript
 * // Register a dungeon with an id
 * const dungeon = Dungeon.generateEmptyDungeon({
 *   id: "midgar",
 *   dimensions: { width: 10, height: 10, layers: 3 }
 * });
 *
 * // Look up a room using the reference format
 * const room = getRoomByRef("@midgar{5,3,1}");
 * if (room) {
 *   console.log(`Found room at ${room.x},${room.y},${room.z}`);
 * }
 * ```
 */
export function getRoomByRef(roomRef: string): Room | undefined {
	// Match pattern: @dungeon-id{x,y,z}
	const match = roomRef.match(/^@([^{]+)\{(\d+),(\d+),(\d+)\}$/);
	if (!match) return undefined;

	const [, dungeonId, xStr, yStr, zStr] = match;
	const dungeon = getDungeonById(dungeonId);
	if (!dungeon) return undefined;

	const x = parseInt(xStr, 10);
	const y = parseInt(yStr, 10);
	const z = parseInt(zStr, 10);

	return dungeon.getRoom(x, y, z);
}

/**
 * Add a mob to the wandering mobs cache.
 * @param mob The mob to add
 */
export function addWanderingMob(mob: Mob): void {
	SAFE_WANDERING_MOBS.add(mob);
}

/**
 * Remove a mob from the wandering mobs cache.
 * @param mob The mob to remove
 */
export function removeWanderingMob(mob: Mob): void {
	SAFE_WANDERING_MOBS.delete(mob);
}

/**
 * Add a room link to the registry.
 * @param link The room link to add
 */
export function addRoomLink(link: RoomLink): void {
	SAFE_ROOM_LINKS.push(link);
}

/**
 * Remove a room link from the registry.
 * @param link The room link to remove
 */
export function removeRoomLink(link: RoomLink): void {
	const index = SAFE_ROOM_LINKS.indexOf(link);
	if (index !== -1) {
		SAFE_ROOM_LINKS.splice(index, 1);
	}
}

/**
 * Clear all room links from the registry.
 * Primarily used for testing.
 */
export function clearRoomLinks(): void {
	SAFE_ROOM_LINKS.length = 0;
}

/**
 * Clear all dungeons from the registry.
 * Primarily used for testing.
 */
export function clearDungeons(): void {
	SAFE_DUNGEON_REGISTRY.clear();
}

/**
 * Clear all wandering mobs from the cache.
 * Primarily used for testing.
 */
export function clearWanderingMobs(): void {
	SAFE_WANDERING_MOBS.clear();
}
