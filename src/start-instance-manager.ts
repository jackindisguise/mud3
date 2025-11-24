/**
 * Entry point for the instance manager.
 *
 * This script starts the instance manager which acts as a proxy between
 * clients and the game server, managing game instances and handling copyover.
 *
 * Usage:
 *   node dist/src/start-instance-manager.js
 */

import { loadPackage } from "package-loader";
import config from "./package/config.js";
import logger from "./logger.js";
import { InstanceManager } from "./instance-manager.js";

// Load required packages
await logger.block("packages", async () => {
	logger.info("Loading packages for instance manager...");
	await loadPackage(config);
});

// Create and start instance manager
const instanceManager = new InstanceManager();

// Handle graceful shutdown
process.on("SIGINT", async () => {
	logger.info("Shutting down instance manager gracefully...");
	await instanceManager.stop();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	logger.info("Shutting down instance manager gracefully...");
	await instanceManager.stop();
	process.exit(0);
});

// Start the instance manager
try {
	await instanceManager.start();
	logger.info("Instance manager started successfully");
} catch (error) {
	logger.error(`Failed to start instance manager: ${error}`);
	process.exit(1);
}
