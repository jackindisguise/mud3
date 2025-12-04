/**
 * Start the helpfile editor server
 *
 * Run this script to start the HTTP server for the web-based helpfile editor.
 * The server will be available at http://localhost:3002
 */

import { createHelpfileEditorServer } from "../helpfile-editor/helpfile-editor-server.js";
import logger from "../logger.js";

async function start() {
	try {
		const server = createHelpfileEditorServer();
		await server.start();
		logger.info("Helpfile editor server is running. Press Ctrl+C to stop.");

		// Handle graceful shutdown
		process.on("SIGINT", async () => {
			logger.info("Shutting down helpfile editor server...");
			await server.stop();
			process.exit(0);
		});

		process.on("SIGTERM", async () => {
			logger.info("Shutting down helpfile editor server...");
			await server.stop();
			process.exit(0);
		});
	} catch (error) {
		logger.error(`Failed to start helpfile editor server: ${error}`);
		process.exit(1);
	}
}

start();

