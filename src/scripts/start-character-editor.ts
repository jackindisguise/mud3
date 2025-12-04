/**
 * Start the character editor server
 *
 * Run this script to start the HTTP server for the web-based character editor.
 * The server will be available at http://localhost:3003
 */

import { createCharacterEditorServer } from "../character-editor/character-editor-server.js";
import logger from "../logger.js";

async function start() {
	try {
		const server = createCharacterEditorServer();
		await server.start();
		logger.info("Character editor server is running. Press Ctrl+C to stop.");

		// Handle graceful shutdown
		process.on("SIGINT", async () => {
			logger.info("Shutting down character editor server...");
			await server.stop();
			process.exit(0);
		});

		process.on("SIGTERM", async () => {
			logger.info("Shutting down character editor server...");
			await server.stop();
			process.exit(0);
		});
	} catch (error) {
		logger.error(`Failed to start character editor server: ${error}`);
		process.exit(1);
	}
}

start();

