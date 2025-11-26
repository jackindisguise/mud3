/**
 * Block (ignore) command for blocking communication from other players.
 *
 * Allows players to block other users from sending them messages on any channel.
 * Blocked players cannot send you whispers, see your messages, or interact with
 * you through the channel system.
 *
 * @example
 * ```
 * block                   // List all blocked users
 * block Alice             // Block user Alice
 * ignore Bob              // Block user Bob (alias)
 * ```
 *
 * **Aliases:** `ignore`
 * **Pattern:** `block <username:word?>`
 * @module commands/block
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR } from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";

export default {
	pattern: "block <username:word?>",
	aliases: ["ignore <username:word?>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const username = args.get("username") as string | undefined;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can block other users.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// If no username provided, list blocked users
		if (!username) {
			const blockedUsers = character.settings.blockedUsers || new Set<string>();
			if (blockedUsers.size === 0) {
				actor.sendMessage(
					"You are not blocking anyone.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			const lines: string[] = [
				color("Blocked users:", COLOR.YELLOW),
				...Array.from(blockedUsers).map((u) => `  - ${u}`),
			];
			actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
			return;
		}

		// Can't block yourself
		if (
			username.toLowerCase() === character.credentials.username.toLowerCase()
		) {
			actor.sendMessage(
				"You cannot block yourself.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if already blocked
		if (character.isBlocking(username)) {
			actor.sendMessage(
				`You have already blocked ${color(username, COLOR.YELLOW)}. Use ${color(
					"unblock",
					COLOR.CYAN
				)} to unblock them.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Block the user
		character.block(username);
		actor.sendMessage(
			`You have blocked ${color(
				username,
				COLOR.CRIMSON
			)}. They can no longer send you messages.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		context.actor.sendMessage(
			`Error: ${result.error}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;
