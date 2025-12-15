/**
 * Package: lockfile - single-instance process lock
 *
 * Ensures only one instance of the app runs at a time by maintaining a
 * `.lock` file in the project root. On startup, the loader checks for an
 * existing lock and whether the recorded PID is still alive, removing stale
 * locks automatically. It creates a new lock for the current process and
 * cleans it up on normal exit or common failure signals.
 *
 * Exports utility functions for direct use when needed:
 * - `isProcessRunning(pid)` - probe whether a process exists
 * - `createLock()` / `removeLock()` - manage the lock file
 * - `checkLock()` - check and prune stale locks
 *
 * @module package/lockfile
 */
import { Package } from "package-loader";
import { join } from "path";
import { readFile, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { hostname } from "node:os";
import logger from "../utils/logger.js";
import { unlinkSync } from "node:fs";
import { getSafeRootDirectory } from "../utils/path.js";

export type LockInfo = {
	pid: number;
	startTime: string;
	hostname: string;
};

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
export const LOCKFILE_PATH = join(DATA_DIRECTORY, ".lock");

let isLocked = false;

/**
 * Check if a process with the given PID is still running
 */
export function isProcessRunning(pid: number): boolean {
	try {
		// process.kill with signal 0 doesn't actually kill the process,
		// it just checks if it exists and we have permission to signal it
		process.kill(pid, 0);
		return true;
	} catch (err: any) {
		// ESRCH means the process doesn't exist
		// EPERM means the process exists but we don't have permission
		return err.code === "EPERM";
	}
}

/**
 * Create a lockfile for this instance
 */
export async function createLock() {
	const lockInfo: LockInfo = {
		pid: process.pid,
		startTime: new Date().toISOString(),
		hostname: hostname(),
	};

	await writeFile(LOCKFILE_PATH, JSON.stringify(lockInfo, null, 2), "utf-8");
	isLocked = true;
	logger.debug(`Lockfile created: PID ${process.pid}`);
}

/**
 * Remove the lockfile
 */
export async function removeLock() {
	if (isLocked && existsSync(LOCKFILE_PATH)) {
		await unlink(LOCKFILE_PATH);
		isLocked = false;
		logger.info("Lockfile removed");
	}
}

/**
 * Check if another instance is running
 */
export async function checkLock() {
	if (!existsSync(LOCKFILE_PATH)) {
		return false; // No lock exists
	}

	try {
		const content = await readFile(LOCKFILE_PATH, "utf-8");
		const lockInfo: LockInfo = JSON.parse(content);

		// Check if the process from the lockfile is still running
		if (isProcessRunning(lockInfo.pid)) {
			logger.error(
				`Another instance is already running (PID: ${lockInfo.pid}, started: ${lockInfo.startTime}, host: ${lockInfo.hostname})`
			);
			return true; // Lock is valid, another instance is running
		} else {
			// Stale lockfile (process no longer exists)
			logger.warn(
				`Removing stale lockfile from PID ${lockInfo.pid} (process no longer running)`
			);
			await unlink(LOCKFILE_PATH);
			return false;
		}
	} catch (error) {
		logger.warn(`Failed to read lockfile, assuming it's corrupted: ${error}`);
		// If we can't read the lockfile, remove it and continue
		try {
			await unlink(LOCKFILE_PATH);
		} catch (unlinkError) {
			// Ignore unlink errors
		}
		return false;
	}
}

export default {
	name: "lockfile",
	loader: async () => {
		logger.debug("Checking for existing instance...");

		// Check if another instance is running
		const isRunning = await checkLock();
		if (isRunning) {
			logger.error(
				"Cannot start: another instance is already running. Exiting."
			);
			process.exit(1);
		}

		// Create lock for this instance
		await createLock();

		// Clean up lockfile on exit
		const cleanup = async () => {
			await removeLock();
		};

		// Handle various exit scenarios
		process.on("exit", () => {
			// Synchronous cleanup on exit
			if (isLocked && existsSync(LOCKFILE_PATH)) {
				try {
					unlinkSync(LOCKFILE_PATH);
					logger.info("Lockfile removed (exit)");
				} catch (error) {
					logger.error(`Failed to remove lockfile on exit: ${error}`);
				}
			}
		});

		process.on("SIGINT", async () => {
			logger.debug("Received SIGINT, cleaning up...");
			await cleanup();
			process.exit(0);
		});

		process.on("SIGTERM", async () => {
			logger.debug("Received SIGTERM, cleaning up...");
			await cleanup();
			process.exit(0);
		});

		process.on("uncaughtException", async (error) => {
			logger.error("Uncaught exception:", error);
			await cleanup();
			process.exit(1);
		});

		process.on("unhandledRejection", async (reason, promise) => {
			logger.error("Unhandled rejection:", { reason, promise });
			await cleanup();
			process.exit(1);
		});

		logger.info("Instance lock acquired successfully");
	},
} as Package;
