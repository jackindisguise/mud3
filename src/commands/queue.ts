import { MESSAGE_GROUP } from "../core/character.js";
import type { CommandObject } from "../package/commands.js";
import { LINEBREAK } from "../core/telnet.js";

export default {
	pattern: "queue",
	execute(context): void {
		const actor = context.actor;
		const character = actor.character;
		const state = character?.actionState;
		const queue = state?.queue ?? [];

		if (!queue.length) {
			actor.sendMessage(
				"Your action queue is empty.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const lines = [];
		lines.push(`Queued actions (${queue.length}):`);
		queue.forEach((entry, index) => {
			const fixed = index + 1;
			const entryNumber = fixed.toString().padStart(2, "0");
			lines.push(`#${entryNumber}: '${entry.input}'`);
		});
		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
