/**
 * Quit command for saving and disconnecting from the game.
 *
 * Saves the character and disconnects from the game.
 *
 * @example
 * ```
 * quit
 * savequit
 * ```
 *
 * **Patterns:**
 * - `quit` - Save and quit
 * @module commands/quit
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { saveCharacter } from "../package/character.js";
import logger from "../logger.js";

export default {
	pattern: "quit~",
	aliases: ["savequit"],
	execute(context: CommandContext): void {
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"You are not logged in.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if character has an active session
		if (!character.session) {
			actor.sendMessage(
				"You are not in an active session.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Save the character
		saveCharacter(character)
			.then(() => {
				actor.sendMessage(
					"Character saved. Goodbye!",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);

				// Close the client connection (this will trigger handleDisconnection
				// which calls endPlayerSession and cleans up properly)
				const client = character.session?.client;
				if (client) {
					// Small delay to ensure the save message is sent before disconnecting
					setTimeout(() => {
						client.close();
					}, 100);
				}
			})
			.catch((error) => {
				actor.sendMessage(
					"Error saving character. Please try again.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				// Log the error but don't disconnect on save failure
				logger.error(
					`Failed to save character ${character.credentials.username}: ${error}`
				);
			});
	},
} satisfies CommandObject;
