/**
 * Copyover command (admin only).
 *
 * Initiates a copyover operation, which saves all characters, shuts down
 * the game server, and restarts it while preserving all connected clients.
 *
 * @example
 * ```
 * copyover
 * ```
 *
 * **Security:** This command is restricted to admin users only.
 * **Pattern:** `copyover`
 * @module commands/copyover
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { Game } from "../game.js";

export default {
	pattern: "copyover",
	/**
	 * Initiate a copyover operation.
	 */
	async execute(
		context: CommandContext,
		args: Map<string, any>
	): Promise<void> {
		const { actor } = context;
		const character = actor.character;

		// Security check: only admins can use this command
		if (!character || !character.isAdmin()) {
			actor.sendMessage(
				"You do not have permission to use this command.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if running under instance manager
		if (process.env.INSTANCE_MANAGER_MODE !== "true") {
			actor.sendMessage(
				"Copyover is only available when running under instance manager.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const game = Game.game;
		if (!game) {
			actor.sendMessage(
				"Game instance not found.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		actor.sendMessage(
			"Initiating copyover... All players will be reconnected automatically.",
			MESSAGE_GROUP.SYSTEM
		);

		// Broadcast to all players
		game.broadcast(
			"Server copyover initiated. You will be reconnected automatically.",
			MESSAGE_GROUP.SYSTEM
		);

		try {
			await game.initiateCopyover();
		} catch (error: any) {
			actor.sendMessage(
				`Error initiating copyover: ${error.message}`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
		}
	},
} as CommandObject;
