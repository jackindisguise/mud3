/**
 * Scan command - Shows all visible mobs and objects in nearby rooms.
 *
 * Uses the same visibility system as the minimap to determine what can be seen.
 * Displays mobs and objects (items/props) in all visible rooms within scan range.
 *
 * @example
 * ```
 * scan
 * ```
 *
 * **Pattern:** `scan~`
 * @module commands/scan
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { Room, DungeonObject, Mob, Item, Prop } from "../core/dungeon.js";
import { color, COLOR } from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";
import { hasLineOfSight } from "../minimap.js";
import { DIRECTION, dir2text } from "../direction.js";

export const command = {
	pattern: "scan~",
	execute(context: CommandContext): void {
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You cannot scan here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const dungeon = room.dungeon;
		if (!dungeon) {
			actor.sendMessage(
				"You cannot scan here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const coords = room.coordinates;
		const scanRadius = 5; // Scan up to 5 rooms away in each direction

		/**
		 * Calculate the direction from source coordinates to target coordinates.
		 * Returns the primary direction (cardinal or diagonal) based on dx/dy.
		 */
		function calculateDirection(
			fromX: number,
			fromY: number,
			toX: number,
			toY: number
		): DIRECTION | undefined {
			const dx = toX - fromX;
			const dy = toY - fromY;

			// Same coordinates - no direction
			if (dx === 0 && dy === 0) return undefined;

			// Determine primary direction based on dx and dy
			// For diagonal directions, check both axes
			if (dx > 0 && dy < 0) return DIRECTION.NORTHEAST;
			if (dx < 0 && dy < 0) return DIRECTION.NORTHWEST;
			if (dx > 0 && dy > 0) return DIRECTION.SOUTHEAST;
			if (dx < 0 && dy > 0) return DIRECTION.SOUTHWEST;
			if (dx > 0 && dy === 0) return DIRECTION.EAST;
			if (dx < 0 && dy === 0) return DIRECTION.WEST;
			if (dx === 0 && dy < 0) return DIRECTION.NORTH;
			if (dx === 0 && dy > 0) return DIRECTION.SOUTH;

			return undefined;
		}

		/**
		 * Capitalize the first letter of a string.
		 */
		function capitalize(text: string): string {
			if (text.length === 0) return text;
			return text.charAt(0).toUpperCase() + text.slice(1);
		}

		// Store visible rooms with their contents
		const visibleRooms: Array<{
			room: Room;
			distance: number;
			direction: DIRECTION | undefined;
			mobs: Mob[];
			items: Item[];
			props: Prop[];
		}> = [];

		// Calculate scan bounds
		const heightSize = scanRadius - 2; // Match minimap height calculation
		for (let y = coords.y - heightSize; y <= coords.y + heightSize; y++) {
			for (let x = coords.x - scanRadius; x <= coords.x + scanRadius; x++) {
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
						// Calculate distance (chebyshev distance)
						const dx = Math.abs(x - coords.x);
						const dy = Math.abs(y - coords.y);
						const distance = Math.max(dx, dy);

						// Skip if same room (we already see what's in our room)
						if (distance === 0) continue;

						// Calculate direction from current room to target room
						const direction = calculateDirection(coords.x, coords.y, x, y);

						// Filter contents
						const mobs = targetRoom.contents.filter(
							(obj): obj is Mob => obj instanceof Mob && obj !== actor
						);
						const items = targetRoom.contents.filter(
							(obj): obj is Item => obj instanceof Item
						);
						const props = targetRoom.contents.filter(
							(obj): obj is Prop => obj instanceof Prop
						);

						// Only include rooms that have visible contents
						if (mobs.length > 0 || items.length > 0 || props.length > 0) {
							visibleRooms.push({
								room: targetRoom,
								distance,
								direction,
								mobs,
								items,
								props,
							});
						}
					}
				}
			}
		}

		// Sort by distance (closest first)
		visibleRooms.sort((a, b) => a.distance - b.distance);

		// Build output
		const lines: string[] = [];

		if (visibleRooms.length === 0) {
			lines.push(
				color("You scan the area but find nothing of interest.", COLOR.CYAN)
			);
		} else {
			lines.push(color("Scanning the area...", COLOR.CYAN));
			lines.push("");

			for (const {
				room: targetRoom,
				distance,
				direction,
				mobs,
				items,
				props,
			} of visibleRooms) {
				// Format direction header
				const distanceText =
					distance === 1 ? "1 room away" : `${distance} rooms away`;
				const directionText = direction
					? capitalize(dir2text(direction))
					: "Unknown";
				const header = `${directionText} (${distanceText}):`;

				lines.push(header);

				// List mobs (no label, just the description)
				if (mobs.length > 0) {
					for (const mob of mobs) {
						const mobDisplay =
							mob.roomDescription || mob.display || mob.keywords;
						lines.push(`  ${mobDisplay}`);
					}
				}

				// List items (no label, just the description)
				if (items.length > 0) {
					for (const item of items) {
						const itemDisplay =
							item.roomDescription || item.display || item.keywords;
						lines.push(`  ${itemDisplay}`);
					}
				}

				// List props (no label, just the description)
				if (props.length > 0) {
					for (const prop of props) {
						const propDisplay =
							prop.roomDescription || prop.display || prop.keywords;
						lines.push(`  ${propDisplay}`);
					}
				}

				lines.push("");
			}
		}

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
