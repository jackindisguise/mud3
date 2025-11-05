import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { Game } from "../game.js";

export default {
	pattern: "who",

	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor } = context;
		const game = Game.game!;
		console.log(Game, game);

		const stats = game.getGameStats();
		console.log(stats);
		const players: string[] = [];

		// Collect all active player names
		game.forEachCharacter((character) => {
			players.push(character.credentials.username);
		});

		// Build the output
		const lines: string[] = [];
		lines.push("=== Players Online ===");

		if (players.length === 0) {
			lines.push("No players currently online.");
		} else {
			players.forEach((name) => {
				lines.push(`> ${name}`);
			});
		}

		lines.push("");
		lines.push(`Total Players: ${stats.playersOnline}`);
		lines.push(`Total Connections: ${stats.activeConnections}`);

		// Send the formatted output
		actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
