import { MESSAGE_GROUP } from "../core/character.js";
import type { CommandObject } from "../package/commands.js";
import type { ActionQueueEntry, ActionState } from "../core/command.js";

function describeCommand(entry: ActionQueueEntry | undefined): string {
	return entry?.command?.pattern ?? "action";
}

export default {
	pattern: "cancel <scope:word?>",
	execute(context, args): void {
		const actor = context.actor;
		const character = actor.character;
		if (!character) {
			actor.sendMessage(
				"You have no queued actions to cancel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const state = character.actionState;
		if (!state || state.queue.length === 0) {
			actor.sendMessage(
				"You have no queued actions to cancel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const scope = (args.get("scope") as string | undefined)?.toLowerCase();
		const cancelAll = scope === "all";

		let removedCount = 0;
		let removedCommand: string | undefined;

		if (cancelAll) {
			removedCount = state.queue.length;
			state.queue.length = 0;
		} else {
			const removed = state.queue.shift();
			if (removed) {
				removedCount = 1;
				removedCommand = describeCommand(removed);
			}
		}

		if (removedCount === 0) {
			actor.sendMessage(
				"You have no queued actions to cancel.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (cancelAll) {
			const plural = removedCount === 1 ? "" : "s";
			actor.sendMessage(
				`Cancelled ${removedCount} queued action${plural}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
		} else {
			actor.sendMessage(
				`Cancelled queued action '${removedCommand ?? "action"}'.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
		}
	},
} satisfies CommandObject;
