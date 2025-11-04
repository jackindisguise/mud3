import { CommandContext, ParseResult } from "../command.js";
import { CommandObject } from "../package/commands.js";

export default {
	pattern: "say <message:text>",
	aliases: ["s <message:text>", "'<message:text>"],

	execute(context: CommandContext, args: Map<string, any>): void {
		const message = args.get("message") as string;
		console.log(`You say: ${message}`);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: message") {
			console.log("What do you want to say?");
			return;
		}
	},
} satisfies CommandObject;
