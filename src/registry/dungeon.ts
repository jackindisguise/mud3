/**
 * Registry: dungeon - centralized dungeon access
 *
 * Provides a centralized location for accessing registered dungeons,
 * room links, and wandering mobs. The registries are populated by the
 * dungeon classes and package layer.
 *
 * @module registry/dungeon
 */

import {
	Dungeon,
	Room,
	RoomLink,
	Mob,
	roomLinkReferencesDungeon,
	DungeonObjectTemplate,
	Reset,
	DungeonObject,
	ResetOptions,
} from "../core/dungeon.js";
import { DIRECTION, dir2reverse, dir2text } from "../utils/direction.js";
import logger from "../utils/logger.js";

export { READONLY_DUNGEON_REGISTRY as DUNGEON_REGISTRY };
export { READONLY_WANDERING_MOBS as WANDERING_MOBS };
export { READONLY_ROOM_LINKS as ROOM_LINKS };

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
 * Remove a room link from both connected rooms and the registry.
 *
 * This function detaches the link from any room that currently has it. The
 * operation is idempotent and safe to call multiple times: `removeLink`
 * on the rooms will simply ignore links that are not present.
 *
 * After calling this function there are no references to this link left in
 * the connected rooms' _links arrays, but the RoomLink object itself is
 * not modified further - callers may keep or discard the instance as they
 * wish.
 *
 * @param link The room link to remove
 */
export function removeRoomLink(link: RoomLink): void {
	const fromRef =
		link.from.room.getRoomRef() ||
		`${link.from.room.x},${link.from.room.y},${link.from.room.z}`;
	const toRef =
		link.to.room.getRoomRef() ||
		`${link.to.room.x},${link.to.room.y},${link.to.room.z}`;
	const dirText = dir2text(link.from.direction);
	logger.debug("Removing room link", {
		type: link.oneWay ? "one-way" : "bidirectional",
		from: fromRef,
		direction: dirText,
		to: toRef,
	});

	// Remove from connected rooms
	link.from.room.removeLink(link);
	link.to.room.removeLink(link);

	// Remove from the global registry if present
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

/**
 * Remove all room links that reference rooms in the specified dungeon.
 *
 * @param dungeon The dungeon whose room links should be removed
 */
export function removeDungeonRoomLinks(dungeon: Dungeon): void {
	// Remove any room links that reference this dungeon's rooms
	// Make a copy to avoid modifying array during iteration
	const linksToRemove: RoomLink[] = [];
	for (const link of SAFE_ROOM_LINKS) {
		// Check if either end of the link is in this dungeon
		if (roomLinkReferencesDungeon(link, dungeon)) {
			linksToRemove.push(link);
		}
	}
	for (const link of linksToRemove) {
		removeRoomLink(link);
	}
}

/**
 * Safely destroy a room, removing all room links that reference it.
 *
 * This helper function should be used instead of calling room.destroy()
 * directly when you need to ensure room links are properly cleaned up.
 * It removes all links referencing the room from both the room's own
 * links array and the global ROOM_LINKS registry, then calls the
 * room's parent destroy method.
 *
 * @param room The room to destroy
 * @param destroyContents If true (default), recursively destroys all contained objects
 */
export function destroyRoom(room: Room, destroyContents: boolean = true): void {
	// Remove all RoomLinks that reference this room
	// Use the room's own links array if available, otherwise search all links
	if ((room as any)._links) {
		// Make a copy to avoid modifying array during iteration
		const linksToRemove = [...(room as any)._links];
		for (const link of linksToRemove) {
			removeRoomLink(link);
		}
	} else {
		// If _links is undefined, search all ROOM_LINKS for links referencing this room
		const linksToRemove: RoomLink[] = [];
		for (const link of SAFE_ROOM_LINKS) {
			if (link.from.room === room || link.to.room === room) {
				linksToRemove.push(link);
			}
		}
		for (const link of linksToRemove) {
			removeRoomLink(link);
		}
	}

	// Remove from dungeon grid if in a dungeon
	const dungeon = room.dungeon;
	if (dungeon) {
		const { x, y, z } = room.coordinates;
		// Check bounds before accessing grid
		if (
			z >= 0 &&
			z < dungeon.dimensions.layers &&
			y >= 0 &&
			y < dungeon.dimensions.height &&
			x >= 0 &&
			x < dungeon.dimensions.width
		) {
			const gridRoom = dungeon.getRoom({ x, y, z });
			if (gridRoom === room) {
				// Access private _rooms array to set to undefined
				(dungeon as any)._rooms[z][y][x] = undefined;
			}
		}
	}

	// Clear links array
	(room as any)._links = undefined;

	// Call parent DungeonObject.destroy() method
	// Access the parent class's destroy method through the prototype chain
	const DungeonObjectPrototype = Object.getPrototypeOf(
		Object.getPrototypeOf(room)
	);
	if (DungeonObjectPrototype && DungeonObjectPrototype.destroy) {
		DungeonObjectPrototype.destroy.call(room, destroyContents);
	}
}

/**
 * Resolve a template id into a DungeonObjectTemplate.
 * Supports fully-qualified ids of the form "@<dungeonId>:<id>".
 * If no dungeon prefix is provided, attempts to find a matching template
 * in any registered dungeon (first match wins).
 *
 * @param id The template ID to resolve (may include @dungeon:id format)
 * @returns The template if found, undefined otherwise
 */
export function resolveTemplateById(
	id: string
): DungeonObjectTemplate | undefined {
	// Parse @dungeon:id form
	const m = id.match(/^@([^:]+):(.+)$/);
	if (m) {
		const dungeonId = m[1];
		const templateId = m[2];
		const dungeon = getDungeonById(dungeonId);
		if (!dungeon) return undefined;
		// Templates are stored with globalized IDs, so use the full id
		return dungeon.templates.get(id);
	}

	// Fallback: scan all registered dungeons for a matching template id
	for (const dungeon of SAFE_DUNGEON_REGISTRY.values()) {
		const t = dungeon.templates.get(id);
		if (t) return t;
	}
	return undefined;
}

/**
 * Create and register a RoomLink between two rooms.
 *
 * This factory is the recommended way to create links because it performs
 * the necessary registration with the provided Room instances and infers
 * the reverse direction automatically. It never mutates the rooms in a way
 * that breaks invariants: the link is added to the `fromRoom` and, unless
 * `oneWay` is true, also to the `toRoom`.
 *
 * @param fromRoom The room which will act as the source endpoint
 * @param direction The direction (on `fromRoom`) that will lead to `toRoom`
 * @param toRoom The room which will act as the destination endpoint
 * @param oneWay When true only `fromRoom` will register the link; traversal back from `toRoom` will not use this link
 * @returns The created RoomLink instance (already registered on the appropriate rooms)
 *
 * @example
 * ```typescript
 * // Two-way link: moving NORTH from roomA goes to roomB, and moving SOUTH from roomB returns to roomA
 * const link = createTunnel(roomA, DIRECTION.NORTH, roomB);
 *
 * // One-way link: moving EAST from roomA goes to roomB, but moving WEST from roomB does not return to roomA
 * const oneWay = createTunnel(roomA, DIRECTION.EAST, roomB, true);
 * ```
 */
export function createTunnel(
	fromRoom: Room,
	direction: DIRECTION,
	toRoom: Room,
	oneWay: boolean = false
): RoomLink {
	// Infer the reverse direction automatically
	const reverse = dir2reverse(direction);

	const link: RoomLink = {
		from: { room: fromRoom, direction },
		to: { room: toRoom, direction: reverse },
		oneWay,
	};

	// Register with the "from" room always
	fromRoom.addLink(link);
	// Register with the "to" room only for two-way links
	if (!link.oneWay) toRoom.addLink(link);
	// Register in the global link registry for persistence/inspection
	addRoomLink(link);

	const fromRef =
		fromRoom.getRoomRef() || `${fromRoom.x},${fromRoom.y},${fromRoom.z}`;
	const toRef = toRoom.getRoomRef() || `${toRoom.x},${toRoom.y},${toRoom.z}`;
	const dirText = dir2text(direction);
	logger.debug("Created room link", {
		type: oneWay ? "one-way" : "bidirectional",
		from: fromRef,
		direction: dirText,
		to: toRef,
	});

	return link;
}

/**
 * Registry of spawned objects for each reset.
 * Maps Reset objects to arrays of spawned DungeonObjects.
 */
const SAFE_RESET_SPAWNED: WeakMap<Reset, DungeonObject[]> = new WeakMap();

/**
 * Create a new Reset instance from options.
 * Use this instead of instantiating Reset directly.
 *
 * @param options Reset configuration options
 * @returns A new Reset instance
 */
export function createReset(options: ResetOptions): Reset {
	return {
		templateId: options.templateId,
		roomRef: options.roomRef,
		minCount: options.minCount ?? 1,
		maxCount: options.maxCount ?? 1,
		equipped: options.equipped,
		inventory: options.inventory,
	};
}

/**
 * Get all spawned objects for a reset.
 *
 * @param reset The reset to get spawned objects for
 * @returns Array of spawned objects (readonly copy)
 */
export function getResetSpawned(reset: Reset): readonly DungeonObject[] {
	const spawned = SAFE_RESET_SPAWNED.get(reset);
	return spawned ? [...spawned] : [];
}

/**
 * Add a spawned object to a reset's tracking.
 * Also sets the object's spawnedByReset property.
 *
 * @param reset The reset to add the object to
 * @param obj The object to add
 */
export function addResetSpawned(reset: Reset, obj: DungeonObject): void {
	let spawned = SAFE_RESET_SPAWNED.get(reset);
	if (!spawned) {
		spawned = [];
		SAFE_RESET_SPAWNED.set(reset, spawned);
	}

	if (spawned.includes(obj)) return;
	spawned.push(obj);
	if (obj.spawnedByReset !== reset) {
		obj.spawnedByReset = reset;
	}
}

/**
 * Remove a spawned object from a reset's tracking.
 * Also unsets the object's spawnedByReset property if it points to this reset.
 *
 * @param reset The reset to remove the object from
 * @param obj The object to remove
 */
export function removeResetSpawned(reset: Reset, obj: DungeonObject): void {
	const spawned = SAFE_RESET_SPAWNED.get(reset);
	if (!spawned) return;

	const index = spawned.indexOf(obj);
	if (index === -1) return;
	spawned.splice(index, 1);

	if (obj.spawnedByReset === reset) {
		obj.spawnedByReset = undefined;
	}
}

/**
 * Count how many spawned objects still exist for a reset.
 *
 * @param reset The reset to count objects for
 * @returns The number of valid spawned objects
 */
export function countResetExisting(reset: Reset): number {
	const spawned = SAFE_RESET_SPAWNED.get(reset);
	return spawned ? spawned.length : 0;
}
