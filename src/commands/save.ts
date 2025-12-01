/**
 * Save command for saving your character without quitting.
 *
 * Saves the character's current state to disk without disconnecting.
 *
 * @example
 * ```
 * save
 * ```
 *
 * **Patterns:**
 * - `save~` - Save character
 * @module commands/save
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { saveCharacter } from "../package/character.js";
import logger from "../logger.js";

export default {
	pattern: "save~",
	async execute(context: CommandContext): Promise<void> {
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"You are not logged in.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Save the character
		saveCharacter(character);
		actor.sendMessage("Character saved.", MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
