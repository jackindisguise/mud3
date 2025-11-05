import { loadPackage } from "package-loader";
import commands from "./src/package/commands.js";
import config from "./src/package/config.js";
import character from "./src/package/character.js";
import lockfile from "./src/package/lockfile.js";
import logger from "./src/logger.js";
import { Game } from "./src/game.js";

await loadPackage(lockfile); // always load first
await loadPackage(lockfile); // always load first
await loadPackage(lockfile); // always load first
await loadPackage(commands);
await loadPackage(config);
await loadPackage(character);

// Start a game instance and automatically stop after 10 seconds
const game = new Game();
const timeout = 1000 * 10;
await game.start();
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
