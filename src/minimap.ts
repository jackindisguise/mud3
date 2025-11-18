/**
 * Minimap generation and vision blocking utilities.
 *
 * Provides functions for generating minimaps that show rooms around a center room,
 * with support for vision blocking by dense rooms and non-existent rooms.
 *
 * @module commands/minimap
 */

import { Room, Dungeon, DungeonObject } from "./dungeon.js";
import { Mob } from "./dungeon.js";
import { COLOR, color, SIZER } from "./color.js";
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
 * @param dungeon The dungeon to check
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
	const gridSize = size * 2 + 1;
	const lines: string[] = [];

	// Build the grid from top to bottom (north to south)
	for (let y = coords.y - size; y <= coords.y + size; y++) {
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
		width: gridSize + 2,
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
