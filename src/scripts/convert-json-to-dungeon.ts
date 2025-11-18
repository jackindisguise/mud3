#!/usr/bin/env node

/**
 * Converter script to convert .are JSON files to dungeon YAML format.
 *
 * This script reads the JSON output from analyze-are-file.ts and converts it
 * to the dungeon YAML format with a 3D grid layout.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import YAML from "js-yaml";
import type { AreFile, Room, RoomExit, Reset } from "./analyze-are-file.js";

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
 * Find all connected room clusters (separate universes)
 */
function findRoomClusters(rooms: Map<number, Room>): number[][] {
	const clusters: number[][] = [];
	const visited = new Set<number>();

	for (const startVnum of rooms.keys()) {
		if (visited.has(startVnum)) continue;

		// BFS to find all connected rooms
		const cluster: number[] = [];
		const queue = [startVnum];
		cluster.push(startVnum);
		visited.add(startVnum);

		while (queue.length > 0) {
			const vnum = queue.shift()!;
			const room = rooms.get(vnum);
			if (!room) continue;

			// Add all connected rooms
			for (const exit of room.exits) {
				const destVnum = exit.destVnum;
				if (destVnum && !visited.has(destVnum) && rooms.has(destVnum)) {
					cluster.push(destVnum);
					visited.add(destVnum);
					queue.push(destVnum);
				}
			}
		}

		clusters.push(cluster);
	}

	return clusters;
}

/**
 * Assign coordinates to a room cluster using BFS
 * Returns coordinates map and conflicts map
 */
function assignClusterCoordinates(
	cluster: number[],
	rooms: Map<number, Room>
): {
	coordinates: Map<number, { x: number; y: number; z: number }>;
	conflicts: Map<
		number,
		Array<{
			fromVnum: number;
			direction: string;
			expectedCoords: { x: number; y: number; z: number };
		}>
	>;
} {
	const coordinates = new Map<number, { x: number; y: number; z: number }>();
	const conflicts = new Map<
		number,
		Array<{
			fromVnum: number;
			direction: string;
			expectedCoords: { x: number; y: number; z: number };
		}>
	>();

	if (cluster.length === 0) return { coordinates, conflicts };

	// Start from first room in cluster
	const startVnum = cluster[0];
	const queue: Array<{ vnum: number; x: number; y: number; z: number }> = [
		{ vnum: startVnum, x: 0, y: 0, z: 0 },
	];
	coordinates.set(startVnum, { x: 0, y: 0, z: 0 });

	while (queue.length > 0) {
		const current = queue.shift()!;
		const room = rooms.get(current.vnum);

		if (!room) continue;

		// Process each exit
		for (const exit of room.exits) {
			const destVnum = exit.destVnum;
			if (!destVnum || !cluster.includes(destVnum)) continue;

			const dir = exit.direction;
			const offset = DIRECTION_OFFSETS[dir];
			if (!offset) continue;

			const expectedCoords = {
				x: current.x + offset.x,
				y: current.y + offset.y,
				z: current.z + offset.z,
			};

			// Check if destination is already placed
			if (coordinates.has(destVnum)) {
				const actualCoords = coordinates.get(destVnum)!;

				// Check if expected coords match actual coords
				if (
					actualCoords.x !== expectedCoords.x ||
					actualCoords.y !== expectedCoords.y ||
					actualCoords.z !== expectedCoords.z
				) {
					// Conflict! Mark for room link
					if (!conflicts.has(destVnum)) {
						conflicts.set(destVnum, []);
					}
					conflicts.get(destVnum)!.push({
						fromVnum: current.vnum,
						direction: dir,
						expectedCoords,
					});
				}
				continue;
			}

			// Check if this coordinate is already taken by another room
			let conflict = false;
			for (const [, existingCoords] of coordinates) {
				if (
					existingCoords.x === expectedCoords.x &&
					existingCoords.y === expectedCoords.y &&
					existingCoords.z === expectedCoords.z
				) {
					conflict = true;
					break;
				}
			}

			if (conflict) {
				// Mark as conflict - will use room link
				if (!conflicts.has(destVnum)) {
					conflicts.set(destVnum, []);
				}
				conflicts.get(destVnum)!.push({
					fromVnum: current.vnum,
					direction: dir,
					expectedCoords,
				});
			} else {
				// No conflict, place normally
				coordinates.set(destVnum, expectedCoords);
				queue.push({ vnum: destVnum, ...expectedCoords });
			}
		}
	}

	return { coordinates, conflicts };
}

/**
 * Convert AreFile JSON to dungeon YAML format
 */
export function convertJsonToDungeon(areFile: AreFile) {
	// Convert rooms array to Map for easier lookup
	const roomsMap = new Map<number, Room>();
	for (const room of areFile.rooms) {
		roomsMap.set(room.vnum, room);
	}

	// Find room clusters
	const clusters = findRoomClusters(roomsMap);
	console.log(`  Found ${clusters.length} room cluster(s)`);

	// Assign coordinates to each cluster
	const clusterData: Array<{
		cluster: number[];
		coordinates: Map<number, { x: number; y: number; z: number }>;
		conflicts: Map<
			number,
			Array<{
				fromVnum: number;
				direction: string;
				expectedCoords: { x: number; y: number; z: number };
			}>
		>;
		width: number;
		height: number;
		layers: number;
		offsetX: number;
	}> = [];

	for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
		const cluster = clusters[clusterIdx];
		const { coordinates, conflicts } = assignClusterCoordinates(
			cluster,
			roomsMap
		);

		// Calculate cluster dimensions
		let minX = Infinity,
			maxX = -Infinity;
		let minY = Infinity,
			maxY = -Infinity;
		let minZ = Infinity,
			maxZ = -Infinity;

		for (const coords of coordinates.values()) {
			minX = Math.min(minX, coords.x);
			maxX = Math.max(maxX, coords.x);
			minY = Math.min(minY, coords.y);
			maxY = Math.max(maxY, coords.y);
			minZ = Math.min(minZ, coords.z);
			maxZ = Math.max(maxZ, coords.z);
		}

		const width = maxX - minX + 1;
		const height = maxY - minY + 1;
		const layers = maxZ - minZ + 1;

		// Normalize coordinates to start at 0,0,0
		const normalizedCoords = new Map<
			number,
			{ x: number; y: number; z: number }
		>();
		for (const [vnum, coords] of coordinates) {
			normalizedCoords.set(vnum, {
				x: coords.x - minX,
				y: coords.y - minY,
				z: coords.z - minZ,
			});
		}

		clusterData.push({
			cluster,
			coordinates: normalizedCoords,
			conflicts,
			width,
			height,
			layers,
			offsetX: clusterIdx * 200, // Separate clusters horizontally
		});
	}

	// Calculate overall dungeon dimensions
	let maxWidth = 0;
	let maxHeight = 0;
	let maxLayers = 0;

	for (const data of clusterData) {
		maxWidth = Math.max(maxWidth, data.offsetX + data.width);
		maxHeight = Math.max(maxHeight, data.height);
		maxLayers = Math.max(maxLayers, data.layers);
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

	// Process conflicts to build room links
	for (const data of clusterData) {
		for (const [destVnum, conflictList] of data.conflicts) {
			for (const conflict of conflictList) {
				const fromVnum = conflict.fromVnum;
				const destCoords = data.coordinates.get(destVnum);
				if (destCoords) {
					const dungeonId = areFile.area.areaName
						.toLowerCase()
						.replace(/\s+/g, "-");
					const roomRef = `@${dungeonId}{${data.offsetX + destCoords.x},${
						destCoords.y
					},${destCoords.z}}`;

					if (!roomLinksMap.has(fromVnum)) {
						roomLinksMap.set(fromVnum, {});
					}
					roomLinksMap.get(fromVnum)![conflict.direction] = roomRef;
				}
			}
		}
	}

	// Process all rooms and create templates
	for (const data of clusterData) {
		for (const vnum of data.cluster) {
			const room = roomsMap.get(vnum);
			if (!room) continue;

			const coords = data.coordinates.get(vnum);
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

				// Find which cluster the destination is in
				let destClusterData = null;
				for (const clusterDataItem of clusterData) {
					if (clusterDataItem.cluster.includes(destVnum)) {
						destClusterData = clusterDataItem;
						break;
					}
				}

				if (!destClusterData) continue; // Skip if destination not in any cluster

				const destCoords = destClusterData.coordinates.get(destVnum);
				if (!destCoords) continue;

				// Check if destination is in expected position
				const expectedCoords = {
					x: coords.x + offset.x,
					y: coords.y + offset.y,
					z: coords.z + offset.z,
				};

				// If destination is in a different cluster or not in expected position, use room link
				if (
					destClusterData !== data ||
					destCoords.x !== expectedCoords.x ||
					destCoords.y !== expectedCoords.y ||
					destCoords.z !== expectedCoords.z
				) {
					const dungeonId = areFile.area.areaName
						.toLowerCase()
						.replace(/\s+/g, "-");
					const roomRef = `@${dungeonId}{${
						destClusterData.offsetX + destCoords.x
					},${destCoords.y},${destCoords.z}}`;
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
			const gridX = data.offsetX + coords.x;
			const gridY = maxHeight - 1 - coords.y;
			grid[coords.z][gridY][gridX] = templateIndex + 1;
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

	const dungeonId = areFile.area.areaName.toLowerCase().replace(/\s+/g, "-");

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
	const jsonPath = process.argv[2] || "midgard.json";

	console.log(`Reading ${jsonPath}...`);
	const jsonContent = readFileSync(jsonPath, "utf-8");
	const areFile: AreFile = JSON.parse(jsonContent);

	console.log(`  Area: ${areFile.area.areaName}`);
	console.log(`  Rooms: ${areFile.rooms.length}`);
	console.log(`  Resets: ${areFile.resets.length}`);

	console.log("Converting to dungeon format...");
	const dungeonData = convertJsonToDungeon(areFile);

	const outputPath = join(
		process.cwd(),
		"data",
		"dungeons",
		`${dungeonData.dungeon.id}.yaml`
	);
	console.log(`Writing to ${outputPath}...`);

	const yaml = YAML.dump(dungeonData, {
		noRefs: true,
		lineWidth: 120,
	});

	writeFileSync(outputPath, yaml, "utf-8");
	console.log("Conversion complete!");
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
	process.argv[1]?.endsWith("convert-json-to-dungeon.ts");

if (isMainModule) {
	main();
}
