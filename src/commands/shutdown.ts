/**
 * Shutdown command (admin only).
 *
 * Gracefully shuts down the game server. This command is restricted to admin users only.
 *
 * @module commands/shutdown
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { getStopGameFunction } from "../game.js";

export default {
	pattern: "shutdown~",
	adminOnly: true,
	/**
	 * Shutdown the game server gracefully.
	 */
	async execute(context: CommandContext): Promise<void> {
		const { actor } = context;
		const character = actor.character;

		// Double-check admin status (shouldn't be needed due to adminOnly flag, but safety check)
		if (!character || !character.isAdmin()) {
			actor.sendMessage(
				"You do not have permission to use this command.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const stopGame = getStopGameFunction();
		if (!stopGame) {
			actor.sendMessage(
				"Shutdown function not available.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		actor.sendMessage("Shutting down the game server...", MESSAGE_GROUP.SYSTEM);

		// Shutdown gracefully, then exit with code 2 to signal intentional shutdown
		// Exit code 2 tells the keep-alive script not to restart
		setTimeout(async () => {
			try {
				await stopGame();
				process.exit(2); // Exit code 2 = intentional shutdown, don't restart
			} catch (error) {
				console.error("Error during shutdown:", error);
				process.exit(1);
			}
		}, 100); // Small delay to allow message to be sent
	},
};
