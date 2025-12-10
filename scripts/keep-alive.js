/**
 * Keep-alive script for the game server
 *
 * Monitors the game process and automatically restarts it if it crashes or exits.
 * Handles graceful shutdown on SIGINT/SIGTERM.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { existsSync } from "node:fs";
import logger from "../dist/src/logger.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIRECTORY = path.resolve(__dirname, "..");
const GAME_SCRIPT = path.join(ROOT_DIRECTORY, "dist", "index.js");

// Configuration
const RESTART_DELAY = 5000; // 5 seconds
const MAX_RESTARTS_PER_MINUTE = 5;
const RESTART_ON_NORMAL_EXIT = true;

// State
let gameProcess = null;
let restartCount = 0;
let restartTimes = [];
let isShuttingDown = false;

/**
 * Start the game process and monitor it
 */
function start() {
	if (isShuttingDown) {
		logger.warn("Cannot start: keep-alive is shutting down");
		return;
	}

	// Check if game is built
	if (!existsSync(GAME_SCRIPT)) {
		logger.error(
			`Game script not found at ${GAME_SCRIPT}. Please run 'npm run build' first.`
		);
		process.exit(1);
		return;
	}

	logger.info("Starting game server...");
	gameProcess = spawn("node", [GAME_SCRIPT], {
		cwd: ROOT_DIRECTORY,
		stdio: "inherit",
		env: { ...process.env },
	});

	gameProcess.on("exit", (code, signal) => {
		gameProcess = null;

		if (isShuttingDown) {
			logger.info("Game server stopped (shutdown requested)");
			return;
		}

		const exitReason = signal
			? `signal ${signal}`
			: code !== null
			? `exit code ${code}`
			: "unknown reason";

		logger.warn(`Game server exited: ${exitReason}`);

		// Exit code 2 = intentional shutdown from within the game (e.g., shutdown command)
		// Don't restart in this case
		if (code === 2) {
			logger.info(
				"Game server shut down intentionally (shutdown command), not restarting"
			);
			process.exit(0);
			return;
		}

		if (!RESTART_ON_NORMAL_EXIT && code === 0 && !signal) {
			logger.info("Game server exited normally, not restarting");
			return;
		}

		// Check restart rate limit
		const now = Date.now();
		const oneMinuteAgo = now - 60000;
		restartTimes = restartTimes.filter((time) => time > oneMinuteAgo);

		if (restartTimes.length >= MAX_RESTARTS_PER_MINUTE) {
			logger.error(
				`Too many restarts (${restartTimes.length} in the last minute). Stopping keep-alive.`
			);
			process.exit(1);
			return;
		}

		restartCount++;
		restartTimes.push(now);

		logger.info(
			`Restarting game server in ${
				RESTART_DELAY / 1000
			} seconds... (restart #${restartCount})`
		);

		setTimeout(() => {
			if (!isShuttingDown) {
				start();
			}
		}, RESTART_DELAY);
	});

	gameProcess.on("error", (error) => {
		logger.error("Failed to spawn game process:", error);
		if (!isShuttingDown) {
			setTimeout(() => {
				if (!isShuttingDown) {
					start();
				}
			}, RESTART_DELAY);
		}
	});
}

/**
 * Stop the game process and keep-alive monitor
 */
async function stop() {
	if (isShuttingDown) {
		return;
	}

	logger.info("Shutting down keep-alive...");
	isShuttingDown = true;

	if (gameProcess) {
		logger.info("Stopping game server...");
		// Send SIGINT for graceful shutdown
		gameProcess.kill("SIGINT");

		// Wait for process to exit (with timeout)
		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				if (gameProcess) {
					logger.warn(
						"Game server did not exit gracefully, forcing termination..."
					);
					gameProcess.kill("SIGKILL");
				}
				resolve();
			}, 10000); // 10 second timeout

			if (gameProcess) {
				gameProcess.once("exit", () => {
					clearTimeout(timeout);
					resolve();
				});
			} else {
				clearTimeout(timeout);
				resolve();
			}
		});
	}
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
	logger.info("Received SIGINT, shutting down...");
	await stop();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	logger.info("Received SIGTERM, shutting down...");
	await stop();
	process.exit(0);
});

// Start monitoring
start();
