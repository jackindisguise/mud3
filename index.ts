import { loadPackage } from "package-loader";
import commands from "./src/package/commands.js";
import config from "./src/package/config.js";
import character from "./src/package/character.js";
import lockfile from "./src/package/lockfile.js";
import help from "./src/package/help.js";
import logger from "./src/logger.js";
import { startGame } from "./src/game.js";

await loadPackage(lockfile); // always load first
await loadPackage(commands);
await loadPackage(config);
await loadPackage(character);
await loadPackage(help);

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
