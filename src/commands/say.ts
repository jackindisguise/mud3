/**
 * Say command for in-character speech.
 *
 * Sends a message to all mobs in the same room as the actor. Used for in-character
 * dialogue and communication with other players/NPCs in the immediate vicinity.
 *
 * @example
 * ```
 * say Hello, traveler!
 * s How are you doing today? // (autocomplete to "say")
 * 'This is a shortcut for say
 * ```
 *
 * **Aliases:** `'`
 * **Pattern:** `say~ <message:text>`
 * @module commands/say
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { CHANNEL } from "../core/channel.js";

export default {
	pattern: "say~ <message:text>",
	aliases: ["'<message:text>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const message = args.get("message") as string;
		const { actor, room } = context;
		const character = actor.character;

		// For characters, check channel subscription
		if (character) {
			if (!character.isInChannel(CHANNEL.SAY)) {
				actor.sendMessage(
					"You are not subscribed to the SAY channel.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
		}

		// Send to all mobs in the same room
		for (const mob of [actor, ...(room?.contents || [])]) {
			if (!(mob instanceof Mob)) continue;
			if (mob.character) {
				// Send chat message to character mobs
				if (character) {
					mob.character.sendChat(character, message, CHANNEL.SAY);
				}
			} else {
				// For NPCs, emit say event for AI to handle
				const npcEmitter = mob.aiEvents;
				if (npcEmitter) {
					npcEmitter.emit("say", actor, message);
				}
			}
		}

		// Emit say event for the speaking mob (if NPC)
		if (!character) {
			const actorEmitter = actor.aiEvents;
			if (actorEmitter) {
				actorEmitter.emit("say", actor, message);
			}
		}
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: message") {
			context.actor.sendMessage(
				"What do you want to say?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
