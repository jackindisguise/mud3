/**
 * Minimap generation and vision blocking utilities.
 *
 * Provides functions for generating minimaps that show rooms around a center room,
 * with support for vision blocking by dense rooms and non-existent rooms.
 *
 * @module commands/minimap
 */

import {
	Room,
	Dungeon,
	DungeonObject,
	DIRECTION,
	DIRECTIONS,
	isNorthward,
	isSouthward,
	isEastward,
	isWestward,
} from "./core/dungeon.js";
import { Mob } from "./core/dungeon.js";
import { COLOR, color, SIZER } from "./core/color.js";
import { string } from "mud-ext";

const ALTERNATING_MINIMAP_CHARS = [",", "'"];
const ALTERNATING_MINIMAP_COLORS = [COLOR.DARK_GREEN, COLOR.TEAL];

/**
 * Checks if a cell blocks vision (non-existent room or dense room).
 * @param dungeon The dungeon to check
 * @param x X coordinate
 * @param y Y coordinate
 * @param z Z coordinate
 * @returns true if the cell blocks vision, false otherwise
 */
export function blocksVision(
	dungeon: Dungeon | null,
	x: number,
	y: number,
	z: number
): boolean {
	if (!dungeon) return true;
	const room = dungeon.getRoom({ x, y, z });
	// Blocks vision if no room exists or room is dense
	return !room || room.dense;
}

/**
 * Checks if there's a clear line of sight from the center room to a target cell.
 * Traces the path from center to target and checks for blocking cells.
 * Dense rooms and non-existent rooms block vision of rooms behind them.
 * Directions without allowed exits or room links also block vision.
 * @param dungeon The dungeon to check
 * @param fromRoom The source room (for checking exits/links)
 * @param fromX Starting X coordinate
 * @param fromY Starting Y coordinate
 * @param toX Target X coordinate
 * @param toY Target Y coordinate
 * @param z Z coordinate (same for both)
 * @returns true if there's clear line of sight, false if vision is blocked
 */
export function hasLineOfSight(
	dungeon: Dungeon | null,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	z: number
): boolean {
	if (!dungeon) return false;

	// Always visible if it's the same cell
	if (fromX === toX && fromY === toY) return true;

	// Calculate the distance and direction
	const dx = toX - fromX;
	const dy = toY - fromY;
	const steps = Math.max(Math.abs(dx), Math.abs(dy));

	// If no steps needed, we're at the same cell (already handled above)
	if (steps === 0) return true;

	// Trace the path from center to target
	for (let i = 1; i <= steps; i++) {
		// Calculate the current position along the line
		const x = Math.round(fromX + (dx * i) / steps);
		const y = Math.round(fromY + (dy * i) / steps);

		// Check if this cell blocks vision (but don't check the starting cell)
		if (blocksVision(dungeon, x, y, z)) {
			// If we hit a blocking cell before reaching the target, vision is blocked
			// But if this IS the target cell and it blocks, we still show it (it's the wall itself)
			if (x === toX && y === toY) {
				// This is the target cell - show it even if it blocks
				return true;
			}
			// Otherwise, vision is blocked
			return false;
		}
	}

	return true;
}

/**
 * Generates a minimap showing rooms around the current room.
 * Displays a grid of rooms with the current room marked.
 * Dense rooms and non-existent rooms block vision of rooms behind them.
 *
 * @param room The center room for the minimap
 * @param mob The mob viewing the minimap (for checking exits)
 * @param size The number of tiles to show in each direction (size 1 = 3x3, size 2 = 5x5)
 * @returns A string representation of the minimap, or undefined if no dungeon
 */
export function generateMinimap(
	room: Room,
	mob: Mob,
	size: number
): string[] | undefined {
	const dungeon = room.dungeon;
	if (!dungeon) return undefined;

	const coords = room.coordinates;
	const gridWidth = size * 2 + 1;
	const gridHeight = (size - 2) * 2 + 1;
	const lines: string[] = [];

	// Build the grid from top to bottom (north to south)
	// Height is reduced: (size - 2) * 2 + 1 instead of size * 2 + 1
	const heightSize = size - 2;
	for (let y = coords.y - heightSize; y <= coords.y + heightSize; y++) {
		const row: string[] = [];
		for (let x = coords.x - size; x <= coords.x + size; x++) {
			let mapText = " ";
			let mapColor = COLOR.DARK_GREEN;

			// Check if there's line of sight to this cell
			const visible = hasLineOfSight(
				dungeon,
				coords.x,
				coords.y,
				x,
				y,
				coords.z
			);

			if (visible) {
				const targetRoom = dungeon.getRoom({ x, y, z: coords.z });
				if (targetRoom) {
					// Priority: current room marker > mob > object > room (including dense rooms)
					if (targetRoom === room) {
						mapText = "@";
						mapColor = COLOR.PINK;
					} else {
						// Check if room has a mob (highest priority after current room)
						const mobInRoom = targetRoom.contents.find(
							(obj) => obj instanceof Mob
						) as Mob | undefined;
						if (mobInRoom) {
							// Room with mob - use mob's mapText/mapColor or default to !
							mapText = mobInRoom.mapText ?? "!";
							mapColor = mobInRoom.mapColor ?? COLOR.YELLOW;
						} else {
							// Check if room has an object
							const objectInRoom = targetRoom.contents.find(
								(obj) => !(obj instanceof Mob)
							) as DungeonObject | undefined;
							if (objectInRoom && objectInRoom.mapText !== undefined) {
								// Room with object that has mapText - use object's mapText/mapColor
								mapText = objectInRoom.mapText;
								mapColor = objectInRoom.mapColor ?? COLOR.DARK_GREEN;
							} else {
								// Use room's mapText/mapColor (works for dense rooms too)
								mapText =
									targetRoom.mapText ??
									ALTERNATING_MINIMAP_CHARS[
										(targetRoom.x * targetRoom.y + targetRoom.z) % 2
									];
								mapColor =
									targetRoom.mapColor ??
									ALTERNATING_MINIMAP_COLORS[
										(targetRoom.x * targetRoom.y + targetRoom.z) % 2
									];
							}

							// Replace mapText with ^ for up exits or V for down exits
							// If both exist, default to ^
							const hasUp =
								targetRoom.canExit(mob, DIRECTION.UP) &&
								targetRoom.getStep(DIRECTION.UP);
							const hasDown =
								targetRoom.canExit(mob, DIRECTION.DOWN) &&
								targetRoom.getStep(DIRECTION.DOWN);
							if (hasUp) {
								mapText = "^";
							} else if (hasDown) {
								mapText = "V";
							}
						}
					}
				} else {
					// No room exists - show as blocking (but still visible if it's blocking vision)
					mapText = " ";
					mapColor = COLOR.DARK_GREEN;
				}
			} else {
				// Not visible - show as empty space
				mapText = " ";
				mapColor = COLOR.DARK_GREEN;
			}

			row.push(color(mapText, mapColor));
		}
		lines.push(row.join(""));
	}

	const box = string.box({
		input: lines,
		width: gridWidth + 2,
		sizer: SIZER,
		style: {
			...string.BOX_STYLES.PLAIN,
			hPadding: 0,
			titleHAlign: string.ALIGN.CENTER,
		},
		title: "Minimap",
	});
	return box;
}

/**
 * Maps a direction to its grid offset (dx, dy).
 * Used for building relative grids from room connections.
 */
function directionToOffset(dir: DIRECTION): { dx: number; dy: number } {
	if (dir === DIRECTION.NORTH) return { dx: 0, dy: -1 };
	if (dir === DIRECTION.SOUTH) return { dx: 0, dy: 1 };
	if (dir === DIRECTION.EAST) return { dx: 1, dy: 0 };
	if (dir === DIRECTION.WEST) return { dx: -1, dy: 0 };
	if (dir === DIRECTION.NORTHEAST) return { dx: 1, dy: -1 };
	if (dir === DIRECTION.NORTHWEST) return { dx: -1, dy: -1 };
	if (dir === DIRECTION.SOUTHEAST) return { dx: 1, dy: 1 };
	if (dir === DIRECTION.SOUTHWEST) return { dx: -1, dy: 1 };
	// UP and DOWN don't change x/y, but we'll treat them as no change for 2D grid
	return { dx: 0, dy: 0 };
}

/**
 * Generates a minimap showing rooms around the current room using room.getStep().
 * This version respects portals and room links by stepping from room to room
 * rather than using coordinate-based lookups.
 * Displays a grid of rooms with the current room marked.
 * Dense rooms block vision of rooms behind them.
 *
 * @param room The center room for the minimap
 * @param mob The mob viewing the minimap (for checking exits)
 * @param size The number of tiles to show in each direction (size 1 = 3x3, size 2 = 5x5)
 * @returns A string representation of the minimap, or undefined if no dungeon
 */
export function generateMinimapFromSteps(
	room: Room,
	mob: Mob,
	size: number
): string[] | undefined {
	const dungeon = room.dungeon;
	if (!dungeon) return undefined;

	// Map to store room at each relative grid position
	// Key: "dx,dy" where dx/dy are relative offsets from center
	const gridMap = new Map<string, Room>();
	// Map to store distance from center for each room
	const distanceMap = new Map<Room, number>();
	// Set to track visited rooms (to avoid cycles)
	const visited = new Set<Room>();
	// Map to track if a room was reached via portal (not coordinate-adjacent)
	const portalMap = new Map<Room, boolean>();

	// BFS queue: [room, dx, dy, distance]
	const queue: Array<[Room, number, number, number]> = [[room, 0, 0, 0]];
	gridMap.set("0,0", room);
	distanceMap.set(room, 0);
	visited.add(room);

	// Explore rooms using BFS up to 'size' steps away
	while (queue.length > 0) {
		const [currentRoom, dx, dy, distance] = queue.shift()!;

		// Stop if we've reached the maximum distance
		if (distance >= size) continue;

		// Try stepping in all directions
		for (const dir of DIRECTIONS) {
			// Calculate relative position
			const offset = directionToOffset(dir);
			const newDx = dx + offset.dx;
			const newDy = dy + offset.dy;
			const newDistance = distance + 1;
			const gridKey = `${newDx},${newDy}`;

			// First, try getStep() to respect portals (but it filters dense rooms)
			let nextRoom = currentRoom.getStep(dir);
			let isPortal = false;

			// Check if this was a portal connection
			if (nextRoom && dungeon) {
				const coords = currentRoom.coordinates;
				const expectedCoords = { ...coords };
				if (isNorthward(dir)) expectedCoords.y--;
				if (isSouthward(dir)) expectedCoords.y++;
				if (isEastward(dir)) expectedCoords.x++;
				if (isWestward(dir)) expectedCoords.x--;
				if (dir === DIRECTION.UP) expectedCoords.z++;
				if (dir === DIRECTION.DOWN) expectedCoords.z--;

				// If the room's actual coordinates don't match expected, it's a portal
				const actualCoords = nextRoom.coordinates;
				if (
					actualCoords.x !== expectedCoords.x ||
					actualCoords.y !== expectedCoords.y ||
					actualCoords.z !== expectedCoords.z
				) {
					isPortal = true;
				}
			}

			// Also check coordinate-based position for dense rooms
			// This ensures we see dense rooms even if getStep() filters them
			if (!nextRoom && dungeon) {
				const coords = currentRoom.coordinates;
				const targetCoords = { ...coords };
				if (isNorthward(dir)) targetCoords.y--;
				if (isSouthward(dir)) targetCoords.y++;
				if (isEastward(dir)) targetCoords.x++;
				if (isWestward(dir)) targetCoords.x--;
				if (dir === DIRECTION.UP) targetCoords.z++;
				if (dir === DIRECTION.DOWN) targetCoords.z--;

				const coordRoom = dungeon.getRoom(targetCoords);
				// Only use coordinate-based room if it's dense (getStep would have filtered it)
				// or if the direction is allowed and there's no portal
				if (coordRoom && coordRoom.dense) {
					nextRoom = coordRoom;
				} else if (coordRoom && (currentRoom.allowedExits & dir) !== 0) {
					// If direction is allowed and no portal, use coordinate room
					nextRoom = coordRoom;
				}
			}

			if (!nextRoom) continue;

			// Check if we've already found a shorter path to this grid position
			const existingRoom = gridMap.get(gridKey);
			if (existingRoom) {
				const existingDistance = distanceMap.get(existingRoom);
				if (existingDistance !== undefined && existingDistance <= newDistance) {
					// Already have this position with a shorter or equal path
					continue;
				}
			}

			// If room was already visited but we found it at a different/better grid position,
			// we should still update the grid and continue exploring from this position
			// This is especially important for portals which can place rooms at unexpected grid positions
			const wasVisited = visited.has(nextRoom);

			// Add/update the room in the grid
			visited.add(nextRoom);
			gridMap.set(gridKey, nextRoom);
			distanceMap.set(nextRoom, newDistance);
			portalMap.set(nextRoom, isPortal);

			// Check if dense room blocks vision
			// If the next room is dense, we can't see through it, so don't explore beyond it
			// But we still show the dense room itself
			if (nextRoom.dense) {
				// Don't explore beyond dense rooms
				continue;
			}

			// Continue exploring from non-dense rooms
			// Even if the room was already visited, we want to explore from this grid position
			// This ensures portal destinations continue mapping the grid
			queue.push([nextRoom, newDx, newDy, newDistance]);
		}
	}

	// Find the bounds of the grid
	let minDx = 0,
		maxDx = 0,
		minDy = 0,
		maxDy = 0;
	for (const key of gridMap.keys()) {
		const [dx, dy] = key.split(",").map(Number);
		minDx = Math.min(minDx, dx);
		maxDx = Math.max(maxDx, dx);
		minDy = Math.min(minDy, dy);
		maxDy = Math.max(maxDy, dy);
	}

	// Ensure center is included and grid is at least size*2+1
	const gridSize = size * 2 + 1;
	const actualWidth = Math.max(gridSize, maxDx - minDx + 1);
	const actualHeight = Math.max(gridSize, maxDy - minDy + 1);

	// Adjust bounds to center the grid
	const centerOffsetX = Math.floor((actualWidth - 1) / 2);
	const centerOffsetY = Math.floor((actualHeight - 1) / 2);

	const lines: string[] = [];

	// Build the grid from top to bottom (north to south)
	for (let gridY = 0; gridY < actualHeight; gridY++) {
		const row: string[] = [];
		for (let gridX = 0; gridX < actualWidth; gridX++) {
			// Convert grid position to relative offset
			const dx = gridX - centerOffsetX;
			const dy = gridY - centerOffsetY;

			// Check if this position is within the size limit
			const distance = Math.max(Math.abs(dx), Math.abs(dy));
			if (distance > size) {
				// Outside size limit - show empty
				row.push(color(" ", COLOR.DARK_GREEN));
				continue;
			}

			const gridKey = `${dx},${dy}`;
			const targetRoom = gridMap.get(gridKey);

			let mapText = " ";
			let mapColor = COLOR.DARK_GREEN;

			if (targetRoom) {
				// Check if there's a clear line of sight from grid center (0,0) to this room
				// Vision is determined by the GRID, not physical map coordinates
				// Dense rooms block vision of rooms behind them along the grid path
				let hasClearPath = true;
				if (distance > 0) {
					// Always check vision along the relative grid path from center (0,0) to target (dx,dy)
					// This works for both normal rooms and portal destinations
					const steps = Math.max(Math.abs(dx), Math.abs(dy));
					for (let step = 1; step < steps; step++) {
						// Calculate position along the line in relative grid space
						const stepDx = Math.round((dx * step) / steps);
						const stepDy = Math.round((dy * step) / steps);
						const stepKey = `${stepDx},${stepDy}`;
						const stepRoom = gridMap.get(stepKey);
						// If there's a dense room along the relative grid path, vision is blocked
						if (stepRoom && stepRoom.dense) {
							hasClearPath = false;
							break;
						}
					}
				}

				if (hasClearPath) {
					// Priority: current room marker > mob > object > room (including dense rooms)
					if (targetRoom === room) {
						mapText = "@";
						mapColor = COLOR.PINK;
					} else {
						// Check if room has a mob (highest priority after current room)
						const mobInRoom = targetRoom.contents.find(
							(obj) => obj instanceof Mob
						) as Mob | undefined;
						if (mobInRoom) {
							// Room with mob - use mob's mapText/mapColor or default to !
							mapText = mobInRoom.mapText ?? "!";
							mapColor = mobInRoom.mapColor ?? COLOR.YELLOW;
						} else {
							// Check if room has an object
							const objectInRoom = targetRoom.contents.find(
								(obj) => !(obj instanceof Mob)
							) as DungeonObject | undefined;
							if (objectInRoom && objectInRoom.mapText !== undefined) {
								// Room with object that has mapText - use object's mapText/mapColor
								mapText = objectInRoom.mapText;
								mapColor = objectInRoom.mapColor ?? COLOR.DARK_GREEN;
							} else {
								// Use room's mapText/mapColor (works for dense rooms too)
								mapText =
									targetRoom.mapText ??
									ALTERNATING_MINIMAP_CHARS[
										(targetRoom.x * targetRoom.y + targetRoom.z) % 2
									];
								mapColor =
									targetRoom.mapColor ??
									ALTERNATING_MINIMAP_COLORS[
										(targetRoom.x * targetRoom.y + targetRoom.z) % 2
									];
							}

							// Replace mapText with ^ for up exits or V for down exits
							// If both exist, default to ^
							const hasUp = targetRoom.getStep(DIRECTION.UP);
							const hasDown = targetRoom.getStep(DIRECTION.DOWN);
							if (hasUp) {
								mapText = "^";
							} else if (hasDown) {
								mapText = "V";
							}
						}
					}
				}
			}

			row.push(color(mapText, mapColor));
		}
		lines.push(row.join(""));
	}

	const box = string.box({
		input: lines,
		width: actualWidth + 2,
		sizer: SIZER,
		style: {
			...string.BOX_STYLES.PLAIN,
			hPadding: 0,
			titleHAlign: string.ALIGN.CENTER,
		},
		title: "Minimap",
	});
	return box;
}
