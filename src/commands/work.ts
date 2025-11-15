import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import type { CommandObject } from "../package/commands.js";

const WORK_COOLDOWN_MS = 3_000;

export default {
	pattern: "work",
	cooldown: WORK_COOLDOWN_MS,
	execute(context: CommandContext): void {
		context.actor.sendMessage(
			"You knuckle down and get to work.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;

