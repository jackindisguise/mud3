#!/usr/bin/env node

/**
 * Converter script: .are -> JSON -> dungeon YAML
 *
 * This script:
 * 1. Parses the .are file to JSON (using analyze-are-file.ts)
 * 2. Converts the JSON to dungeon YAML format
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import YAML from "js-yaml";
import {
	parseAreFile,
	type AreFile,
	type Room,
	type RoomExit,
} from "./analyze-are-file.js";

// Direction offsets for grid placement
const DIRECTION_OFFSETS: Record<string, { x: number; y: number; z: number }> = {
	north: { x: 0, y: -1, z: 0 },
	south: { x: 0, y: 1, z: 0 },
	east: { x: 1, y: 0, z: 0 },
	west: { x: -1, y: 0, z: 0 },
	up: { x: 0, y: 0, z: 1 },
	down: { x: 0, y: 0, z: -1 },
	northeast: { x: 1, y: -1, z: 0 },
	northwest: { x: -1, y: -1, z: 0 },
	southeast: { x: 1, y: 1, z: 0 },
	southwest: { x: -1, y: 1, z: 0 },
};

/**
 * Collision information for a room that couldn't be placed
 */
interface Collision {
	vnum: number;
	fromVnum: number;
	direction: string;
	expectedCoords: { x: number; y: number; z: number };
}

/**
 * Block of rooms that have been mapped together
 */
interface RoomBlock {
	rooms: Set<number>; // vnums in this block
	coordinates: Map<number, { x: number; y: number; z: number }>;
	collisions: Collision[]; // collisions encountered during mapping
	offsetX: number; // horizontal offset for this block
	offsetY: number; // vertical offset for this block
	offsetZ: number; // layer offset for this block
}

/**
 * Map rooms to a 3D grid, handling collisions as separate blocks
 */
function mapRoomsToGrid(rooms: Map<number, Room>): {
	blocks: RoomBlock[];
	allCoordinates: Map<
		number,
		{ x: number; y: number; z: number; block: RoomBlock }
	>;
} {
	const allCoordinates = new Map<
		number,
		{ x: number; y: number; z: number; block: RoomBlock }
	>();
	const blocks: RoomBlock[] = [];
	const processedVnums = new Set<number>();
	const pendingExits = new Map<
		number,
		Array<{ fromVnum: number; direction: string; destVnum: number }>
	>(); // destVnum -> list of exits waiting for it

	// Start with first unprocessed room
	for (const startVnum of rooms.keys()) {
		if (processedVnums.has(startVnum)) continue;

		// Create a new block starting from this room
		const block: RoomBlock = {
			rooms: new Set(),
			coordinates: new Map(),
			collisions: [],
			offsetX: 0,
			offsetY: 0,
			offsetZ: 0,
		};

		// BFS to map connected rooms
		const queue: Array<{
			vnum: number;
			x: number;
			y: number;
			z: number;
		}> = [{ vnum: startVnum, x: 0, y: 0, z: 0 }];

		block.rooms.add(startVnum);
		block.coordinates.set(startVnum, { x: 0, y: 0, z: 0 });
		allCoordinates.set(startVnum, {
			x: 0,
			y: 0,
			z: 0,
			block,
		});
		processedVnums.add(startVnum);

		while (queue.length > 0) {
			const current = queue.shift()!;
			const room = rooms.get(current.vnum);
			if (!room) continue;

			// Process each exit
			for (const exit of room.exits) {
				const destVnum = exit.destVnum;
				if (!destVnum || !rooms.has(destVnum)) continue;

				const dir = exit.direction;
				const offset = DIRECTION_OFFSETS[dir];
				if (!offset) continue;

				const expectedCoords = {
					x: current.x + offset.x,
					y: current.y + offset.y,
					z: current.z + offset.z,
				};

				// Check if destination is already mapped
				if (allCoordinates.has(destVnum)) {
					const destInfo = allCoordinates.get(destVnum)!;
					const actualCoords = {
						x: destInfo.x + destInfo.block.offsetX,
						y: destInfo.y + destInfo.block.offsetY,
						z: destInfo.z + destInfo.block.offsetZ,
					};

					// Check if expected coords match actual coords (within this block)
					if (destInfo.block === block) {
						// Same block - check if coords match
						if (
							destInfo.x !== expectedCoords.x ||
							destInfo.y !== expectedCoords.y ||
							destInfo.z !== expectedCoords.z
						) {
							// Collision within same block
							block.collisions.push({
								vnum: destVnum,
								fromVnum: current.vnum,
								direction: dir,
								expectedCoords,
							});
						}
					} else {
						// Different block - always a collision
						block.collisions.push({
							vnum: destVnum,
							fromVnum: current.vnum,
							direction: dir,
							expectedCoords,
						});
					}
					continue;
				}

				// Check if this coordinate is already taken in this block
				let conflict = false;
				for (const [, coords] of block.coordinates) {
					if (
						coords.x === expectedCoords.x &&
						coords.y === expectedCoords.y &&
						coords.z === expectedCoords.z
					) {
						conflict = true;
						break;
					}
				}

				if (conflict) {
					// Collision - mark it
					block.collisions.push({
						vnum: destVnum,
						fromVnum: current.vnum,
						direction: dir,
						expectedCoords,
					});
				} else {
					// No conflict, place in this block
					block.rooms.add(destVnum);
					block.coordinates.set(destVnum, expectedCoords);
					allCoordinates.set(destVnum, {
						x: expectedCoords.x,
						y: expectedCoords.y,
						z: expectedCoords.z,
						block,
					});
					processedVnums.add(destVnum);
					queue.push({ vnum: destVnum, ...expectedCoords });

					// Check if there were pending exits waiting for this room
					if (pendingExits.has(destVnum)) {
						const pending = pendingExits.get(destVnum)!;
						pendingExits.delete(destVnum);
						// These exits are now resolved, but we don't need to do anything
						// since the room is already placed
					}
				}
			}
		}

		blocks.push(block);
	}

	// Process collisions as new blocks
	let blockOffsetX = 0;
	for (const block of blocks) {
		// Calculate block dimensions to determine offset
		let minX = Infinity,
			maxX = -Infinity;
		let minY = Infinity,
			maxY = -Infinity;
		let minZ = Infinity,
			maxZ = -Infinity;

		for (const coords of block.coordinates.values()) {
			minX = Math.min(minX, coords.x);
			maxX = Math.max(maxX, coords.x);
			minY = Math.min(minY, coords.y);
			maxY = Math.max(maxY, coords.y);
			minZ = Math.min(minZ, coords.z);
			maxZ = Math.max(maxZ, coords.z);
		}

		const blockWidth = maxX - minX + 1;
		block.offsetX = blockOffsetX;
		block.offsetY = 0;
		block.offsetZ = 0;

		// Normalize coordinates within block
		const normalizedCoords = new Map<
			number,
			{ x: number; y: number; z: number }
		>();
		for (const [vnum, coords] of block.coordinates) {
			normalizedCoords.set(vnum, {
				x: coords.x - minX,
				y: coords.y - minY,
				z: coords.z - minZ,
			});
			// Update allCoordinates with normalized coords
			const info = allCoordinates.get(vnum)!;
			info.x = coords.x - minX;
			info.y = coords.y - minY;
			info.z = coords.z - minZ;
		}
		block.coordinates = normalizedCoords;

		blockOffsetX += blockWidth + 10; // Add spacing between blocks
	}

	// Process collisions: create new blocks for collision destinations
	const collisionQueue: Collision[] = [];
	for (const block of blocks) {
		collisionQueue.push(...block.collisions);
	}

	while (collisionQueue.length > 0) {
		const collision = collisionQueue.shift()!;
		const destVnum = collision.vnum;

		// Skip if already processed
		if (allCoordinates.has(destVnum)) continue;

		// Create new block for this collision room
		const newBlock: RoomBlock = {
			rooms: new Set(),
			coordinates: new Map(),
			collisions: [],
			offsetX: blockOffsetX,
			offsetY: 0,
			offsetZ: 0,
		};

		// Start mapping from the collision room
		const queue: Array<{
			vnum: number;
			x: number;
			y: number;
			z: number;
		}> = [{ vnum: destVnum, x: 0, y: 0, z: 0 }];

		newBlock.rooms.add(destVnum);
		newBlock.coordinates.set(destVnum, { x: 0, y: 0, z: 0 });
		allCoordinates.set(destVnum, {
			x: 0,
			y: 0,
			z: 0,
			block: newBlock,
		});
		processedVnums.add(destVnum);

		// BFS to map connected rooms in this collision block
		while (queue.length > 0) {
			const current = queue.shift()!;
			const room = rooms.get(current.vnum);
			if (!room) continue;

			for (const exit of room.exits) {
				const exitDestVnum = exit.destVnum;
				if (!exitDestVnum || !rooms.has(exitDestVnum)) continue;

				// Skip if already in another block
				if (allCoordinates.has(exitDestVnum)) {
					const destInfo = allCoordinates.get(exitDestVnum)!;
					if (destInfo.block !== newBlock) {
						// Different block - mark as collision
						newBlock.collisions.push({
							vnum: exitDestVnum,
							fromVnum: current.vnum,
							direction: exit.direction,
							expectedCoords: {
								x: current.x + DIRECTION_OFFSETS[exit.direction].x,
								y: current.y + DIRECTION_OFFSETS[exit.direction].y,
								z: current.z + DIRECTION_OFFSETS[exit.direction].z,
							},
						});
					}
					continue;
				}

				const dir = exit.direction;
				const offset = DIRECTION_OFFSETS[dir];
				if (!offset) continue;

				const expectedCoords = {
					x: current.x + offset.x,
					y: current.y + offset.y,
					z: current.z + offset.z,
				};

				// Check if coordinate is taken in this block
				let conflict = false;
				for (const [, coords] of newBlock.coordinates) {
					if (
						coords.x === expectedCoords.x &&
						coords.y === expectedCoords.y &&
						coords.z === expectedCoords.z
					) {
						conflict = true;
						break;
					}
				}

				if (conflict) {
					newBlock.collisions.push({
						vnum: exitDestVnum,
						fromVnum: current.vnum,
						direction: dir,
						expectedCoords,
					});
				} else {
					newBlock.rooms.add(exitDestVnum);
					newBlock.coordinates.set(exitDestVnum, expectedCoords);
					allCoordinates.set(exitDestVnum, {
						x: expectedCoords.x,
						y: expectedCoords.y,
						z: expectedCoords.z,
						block: newBlock,
					});
					processedVnums.add(exitDestVnum);
					queue.push({ vnum: exitDestVnum, ...expectedCoords });
				}
			}
		}

		// Normalize new block coordinates
		let minX = Infinity,
			maxX = -Infinity;
		let minY = Infinity,
			maxY = -Infinity;
		let minZ = Infinity,
			maxZ = -Infinity;

		for (const coords of newBlock.coordinates.values()) {
			minX = Math.min(minX, coords.x);
			maxX = Math.max(maxX, coords.x);
			minY = Math.min(minY, coords.y);
			maxY = Math.max(maxY, coords.y);
			minZ = Math.min(minZ, coords.z);
			maxZ = Math.max(maxZ, coords.z);
		}

		const blockWidth = maxX - minX + 1;
		const normalizedCoords = new Map<
			number,
			{ x: number; y: number; z: number }
		>();
		for (const [vnum, coords] of newBlock.coordinates) {
			normalizedCoords.set(vnum, {
				x: coords.x - minX,
				y: coords.y - minY,
				z: coords.z - minZ,
			});
			const info = allCoordinates.get(vnum)!;
			info.x = coords.x - minX;
			info.y = coords.y - minY;
			info.z = coords.z - minZ;
		}
		newBlock.coordinates = normalizedCoords;

		blocks.push(newBlock);
		blockOffsetX += blockWidth + 10;

		// Add new collisions to queue
		collisionQueue.push(...newBlock.collisions);
	}

	return { blocks, allCoordinates };
}

/**
 * Convert AreFile JSON to dungeon YAML format
 */
function convertJsonToDungeon(areFile: AreFile) {
	// Convert rooms array to Map for easier lookup
	const roomsMap = new Map<number, Room>();
	for (const room of areFile.rooms) {
		roomsMap.set(room.vnum, room);
	}

	// Map rooms to 3D grid with collision handling
	console.log("  Mapping rooms to 3D grid...");
	const { blocks, allCoordinates } = mapRoomsToGrid(roomsMap);
	console.log(`  Created ${blocks.length} room block(s)`);

	// Calculate overall dungeon dimensions
	let maxWidth = 0;
	let maxHeight = 0;
	let maxLayers = 0;

	for (const block of blocks) {
		let blockWidth = 0;
		let blockHeight = 0;
		let blockLayers = 0;

		for (const coords of block.coordinates.values()) {
			blockWidth = Math.max(blockWidth, coords.x + 1);
			blockHeight = Math.max(blockHeight, coords.y + 1);
			blockLayers = Math.max(blockLayers, coords.z + 1);
		}

		maxWidth = Math.max(maxWidth, block.offsetX + blockWidth);
		maxHeight = Math.max(maxHeight, block.offsetY + blockHeight);
		maxLayers = Math.max(maxLayers, block.offsetZ + blockLayers);
	}

	// Build room templates and grid
	const roomTemplates: Array<{
		display: string;
		description: string;
		roomLinks?: Record<string, string>;
	}> = [];
	const vnumToTemplateIndex = new Map<number, number>();
	const grid: number[][][] = [];

	// Initialize grid with zeros
	for (let z = 0; z < maxLayers; z++) {
		const layer: number[][] = [];
		for (let y = 0; y < maxHeight; y++) {
			const row: number[] = [];
			for (let x = 0; x < maxWidth; x++) {
				row.push(0);
			}
			layer.push(row);
		}
		grid.push(layer);
	}

	// Build room links map: fromVnum -> { direction -> destRoomRef }
	const roomLinksMap = new Map<number, Record<string, string>>();
	const dungeonId = areFile.area.areaName.toLowerCase().replace(/\s+/g, "-");

	// Process collisions to build room links
	for (const block of blocks) {
		for (const collision of block.collisions) {
			const fromVnum = collision.fromVnum;
			const destVnum = collision.vnum;

			// Get destination coordinates
			const destInfo = allCoordinates.get(destVnum);
			if (!destInfo) continue;

			const roomRef = `@${dungeonId}{${destInfo.block.offsetX + destInfo.x},${
				destInfo.block.offsetY + destInfo.y
			},${destInfo.block.offsetZ + destInfo.z}}`;

			if (!roomLinksMap.has(fromVnum)) {
				roomLinksMap.set(fromVnum, {});
			}
			roomLinksMap.get(fromVnum)![collision.direction] = roomRef;
		}
	}

	// Process all rooms and create templates
	for (const block of blocks) {
		for (const vnum of block.rooms) {
			const room = roomsMap.get(vnum);
			if (!room) continue;

			const coords = block.coordinates.get(vnum);
			if (!coords) continue;

			// Get room links for this room (if any)
			const roomLinks: Record<string, string> = roomLinksMap.get(vnum) || {};

			// Check for exits that need room links (destinations not in expected grid position)
			for (const exit of room.exits) {
				const destVnum = exit.destVnum;
				if (!destVnum) continue;

				const dir = exit.direction;
				const offset = DIRECTION_OFFSETS[dir];
				if (!offset) continue;

				// Get destination coordinates
				const destInfo = allCoordinates.get(destVnum);
				if (!destInfo) continue; // Skip if destination not mapped

				// Check if destination is in expected position within this block
				const expectedCoords = {
					x: coords.x + offset.x,
					y: coords.y + offset.y,
					z: coords.z + offset.z,
				};

				// If destination is in a different block or not in expected position, use room link
				if (
					destInfo.block !== block ||
					destInfo.x !== expectedCoords.x ||
					destInfo.y !== expectedCoords.y ||
					destInfo.z !== expectedCoords.z
				) {
					const roomRef = `@${dungeonId}{${
						destInfo.block.offsetX + destInfo.x
					},${destInfo.block.offsetY + destInfo.y},${
						destInfo.block.offsetZ + destInfo.z
					}}`;
					roomLinks[dir] = roomRef;
				}
			}

			// Create room template
			const template: {
				display: string;
				description: string;
				roomLinks?: Record<string, string>;
			} = {
				display: room.name,
				description: room.description,
			};

			// Add room links if any
			if (Object.keys(roomLinks).length > 0) {
				template.roomLinks = roomLinks;
			}

			// Check if this template already exists
			let templateIndex = roomTemplates.findIndex(
				(t) =>
					t.display === template.display &&
					t.description === template.description &&
					JSON.stringify(t.roomLinks || {}) ===
						JSON.stringify(template.roomLinks || {})
			);

			if (templateIndex === -1) {
				templateIndex = roomTemplates.length;
				roomTemplates.push(template);
			}

			vnumToTemplateIndex.set(vnum, templateIndex + 1);

			// Place in grid (note: YAML grid is reversed in Y axis)
			const gridX = block.offsetX + coords.x;
			const gridY = maxHeight - 1 - (block.offsetY + coords.y);
			const gridZ = block.offsetZ + coords.z;
			grid[gridZ][gridY][gridX] = templateIndex + 1;
		}
	}

	// Convert resets (simplified - just pass through for now)
	const resets: Array<{
		type: string;
		ifFlag: number;
		limit: number;
		arg1: number;
		arg2: number;
		arg3: number;
		comment?: string;
	}> = [];

	for (const reset of areFile.resets) {
		resets.push({
			type: reset.type,
			ifFlag: reset.ifFlag,
			limit: reset.limit,
			arg1: reset.arg1,
			arg2: reset.arg2,
			arg3: reset.arg3,
			comment: reset.comment,
		});
	}

	return {
		dungeon: {
			id: dungeonId,
			dimensions: {
				width: maxWidth,
				height: maxHeight,
				layers: maxLayers,
			},
			grid,
			rooms: roomTemplates,
			resets: resets.length > 0 ? resets : undefined,
		},
	};
}

/**
 * Main function
 */
function main() {
	const arePath = process.argv[2] || "midgard.are";

	console.log("Step 1: Converting .are to JSON...");
	const areFile = parseAreFile(arePath);

	// Optionally save intermediate JSON
	const jsonPath = arePath.replace(/\.are$/, ".json");
	console.log(`  Writing intermediate JSON to ${jsonPath}...`);
	const jsonContent = JSON.stringify(areFile, null, 2);
	writeFileSync(jsonPath, jsonContent, "utf-8");

	console.log("\nStep 2: Converting JSON to dungeon YAML...");
	const dungeonData = convertJsonToDungeon(areFile);

	const outputPath = join(
		process.cwd(),
		"data",
		"dungeons",
		`${dungeonData.dungeon.id}.yaml`
	);
	console.log(`  Writing dungeon YAML to ${outputPath}...`);

	const yaml = YAML.dump(dungeonData, {
		noRefs: true,
		lineWidth: 120,
	});

	writeFileSync(outputPath, yaml, "utf-8");

	console.log("\nConversion complete!");
	console.log(`  Area: ${areFile.area.areaName}`);
	console.log(
		`  Dimensions: ${dungeonData.dungeon.dimensions.width}x${dungeonData.dungeon.dimensions.height}x${dungeonData.dungeon.dimensions.layers}`
	);
	console.log(`  Room templates: ${dungeonData.dungeon.rooms.length}`);
	if (dungeonData.dungeon.resets) {
		console.log(`  Resets: ${dungeonData.dungeon.resets.length}`);
	}
}

// Run if executed directly
const scriptPath = new URL(import.meta.url).pathname;
const isMainModule =
	process.argv[1] === scriptPath ||
	process.argv[1]?.endsWith("convert-are-to-dungeon.ts");

if (isMainModule) {
	main();
}
