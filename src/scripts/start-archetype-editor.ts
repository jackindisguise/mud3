/**
 * Start the archetype editor server
 *
 * Run this script to start the HTTP server for the web-based archetype editor.
 * The server will be available at http://localhost:3001
 */

import { createArchetypeEditorServer } from "../editors/archetype-editor/archetype-editor-server.js";
import logger from "../logger.js";

const server = createArchetypeEditorServer();

async function start() {
	try {
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
