import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Mob } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Game } from "../game.js";

export default {
	pattern: "ooc <message:text>",
	aliases: ["o <message:text>", '" <message:text>'],

	execute(context: CommandContext, args: Map<string, any>): void {
		const message = args.get("message") as string;
		const { actor } = context;

		actor.sendMessage(`You OOC: "${message}"`, MESSAGE_GROUP.CHANNELS);
		Game.game!.forEachCharacter((character) => {
			character.sendMessage(
				`${actor} OOC: "${message}"`,
				MESSAGE_GROUP.CHANNELS
			);
		});
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: message") {
			context.actor.sendLine("What do you want to OOC?");
			return;
		}
	},
} satisfies CommandObject;
