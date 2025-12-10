import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import type { CommandObject } from "../package/commands.js";

const WORK_COOLDOWN_MS = 3_000;

export const command = {
	pattern: "work",
	cooldown: WORK_COOLDOWN_MS,
	execute(context: CommandContext): void {
		context.actor.sendMessage(
			"You knuckle down and get to work.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;
