/**
 * Unblock command for unblocking communication from other players.
 *
 * Removes a user from your blocked list, allowing them to send you messages
 * on all channels again.
 *
 * @example
 * ```
 * unblock Alice           // Unblock user Alice
 * unignore Bob            // Unblock user Bob (alias)
 * ```
 *
 * **Aliases:** `unignore`
 * **Pattern:** `unblock <username:word>`
 * @module commands/unblock
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR } from "../core/color.js";

export const command = {
	pattern: "unblock <username:word>",
	aliases: ["unignore <username:word>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const username = args.get("username") as string;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can unblock other users.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if user is actually blocked
		if (!character.isBlocking(username)) {
			actor.sendMessage(
				`${color(username, COLOR.YELLOW)} is not on your blocked list.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Unblock the user
		character.unblock(username);
		actor.sendMessage(
			`You have unblocked ${color(
				username,
				COLOR.CYAN
			)}. They can now send you messages.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: username") {
			context.actor.sendMessage(
				"Who do you want to unblock?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		context.actor.sendMessage(
			`Error: ${result.error}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;
