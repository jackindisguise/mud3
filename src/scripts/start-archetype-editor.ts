/**
 * Start the archetype editor server
 *
 * Run this script to start the HTTP server for the web-based archetype editor.
 * The server will be available at http://localhost:3001
 */

import { createArchetypeEditorServer } from "../archetype-editor/archetype-editor-server.js";
import logger from "../logger.js";
import { loadPackage } from "package-loader";

async function start() {
	try {
		// Load packages first (archetype, ability, effect) before creating server
		const archetype = await import("../package/archetype.js");
		const ability = await import("../package/ability.js");
		const effect = await import("../package/effect.js");

		await logger.block("archetype", async () => {
			await loadPackage(archetype.default);
		});
		await logger.block("ability", async () => {
			await loadPackage(ability.default);
		});
		await logger.block("effect", async () => {
			await loadPackage(effect.default);
		});

		// Load dungeon after the above packages
		const dungeon = await import("../package/dungeon.js");
		await logger.block("dungeon", async () => {
			await loadPackage(dungeon.default);
		});

		const server = createArchetypeEditorServer();
		await server.start();
		logger.info("Archetype editor server is running. Press Ctrl+C to stop.");

		// Handle graceful shutdown
		process.on("SIGINT", async () => {
			logger.info("Shutting down archetype editor server...");
			await server.stop();
			process.exit(0);
		});

		process.on("SIGTERM", async () => {
			logger.info("Shutting down archetype editor server...");
			await server.stop();
			process.exit(0);
		});
	} catch (error) {
		logger.error(`Failed to start archetype editor server: ${error}`);
		process.exit(1);
	}
}

start();
