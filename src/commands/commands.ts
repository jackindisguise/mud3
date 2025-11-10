import { CommandContext, CommandRegistry, Command } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";

export default {
	pattern: "commands",
	execute(context: CommandContext, args: Map<string, any>) {
		const commandLabelsSet = new Set<string>();
		CommandRegistry.default.getCommands().forEach((cmd: Command) => {
			// Helper to extract first word and clean it
			const extractWord = (pattern: string) => {
				let word = pattern.trim().split(/[ <]/)[0];
				if (word !== "?") word = word.replace(/[?~]/g, "");
				return word;
			};
			commandLabelsSet.add(extractWord(cmd.pattern));
			if (cmd.aliases && Array.isArray(cmd.aliases)) {
				for (const alias of cmd.aliases) {
					commandLabelsSet.add(extractWord(alias));
				}
			}
		});
		const commandLabels = Array.from(commandLabelsSet);

		const columns = 3;
		const rows = Math.ceil(commandLabels.length / columns);
		const table: string[] = ["Available commands:"];
		for (let r = 0; r < rows; r++) {
			const row: string[] = [];
			for (let c = 0; c < columns; c++) {
				const idx = r + c * rows;
				if (idx < commandLabels.length) {
					row.push(commandLabels[idx].padEnd(26));
				}
			}
			table.push(row.join(" "));
		}
		context.actor.sendMessage(table.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
};
