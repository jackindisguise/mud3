import { loadAllPackages } from "./package.js";
import logger from "./src/logger.js";
import {
	buildDungeonGraph,
	findDirectionsBetweenRooms,
} from "./src/pathfinding.js";
import { DUNGEON_REGISTRY, DIRECTIONS } from "./src/dungeon.js";
import { startGame } from "./src/game.js";

await logger.block("packages", async () => {
	logger.info("Loading packages...");
	await loadAllPackages();
});

await logger.block("pathfinding", async () => {
	await logger.block("graph-building", async () => {
		logger.info("Pre-building dungeon graph.");
		const graph = buildDungeonGraph();
		logger.info(`Dungeon graph built: ${graph.size} dungeons.`);
		for (let [dungeonId, edges] of graph.entries()) {
			logger.info(`Dungeon ${dungeonId} has ${edges.length} edges.`);
			for (let edge of edges) {
				logger.info(
					`Edge to dungeon ${edge.toDungeonId} via ${edge.via.length} rooms.`
				);
			}
		}
	});

	await logger.block("path-cache", async () => {
		logger.info("Pre-caching paths between dungeon gateway edges...");

		// Identify gateway rooms per dungeon (rooms that step into a different dungeon)
		const gatewaysByDungeon = new Map<string, Array<any>>();
		for (const d of DUNGEON_REGISTRY.values()) {
			const id = d.id;
			if (!id) continue;
			const gateways: any[] = [];
			for (let z = 0; z < d.dimensions.layers; z++) {
				for (let y = 0; y < d.dimensions.height; y++) {
					for (let x = 0; x < d.dimensions.width; x++) {
						const room = d.getRoom({ x, y, z });
						if (!room) continue;
						for (const dir of DIRECTIONS) {
							const n = room.getStep(dir);
							if (n && n.dungeon && n.dungeon !== d) {
								gateways.push(room);
								break;
							}
						}
					}
				}
			}
			gatewaysByDungeon.set(id, gateways);
		}

		// For each pair of dungeons, pre-cache between their gateway rooms
		for (const [fromId, fromGateways] of gatewaysByDungeon.entries()) {
			for (const [toId, toGateways] of gatewaysByDungeon.entries()) {
				if (fromId === toId) continue;
				for (const fromRoom of fromGateways) {
					for (const toRoom of toGateways) {
						findDirectionsBetweenRooms(fromRoom, toRoom, { maxNodes: 5000 });
					}
				}
			}
		}

		logger.info("Finished pre-caching dungeon gateway paths.");
	});
});

// Start the game using startGame() to properly set Game.game singleton
const game = await startGame();
const timeout = 1000 * 6000;
logger.info(
	`Game server started. It will shut down automatically in ${
		timeout / 1000
	} seconds...`
);

setTimeout(async () => {
	try {
		logger.info("Auto-shutdown timer reached. Stopping game server...");
		await game.stop();
		logger.info("Game server stopped. Exiting process.");
	} catch (err) {
		logger.error("Error during auto-shutdown:", err);
	} finally {
		process.exit(0);
	}
}, timeout);
