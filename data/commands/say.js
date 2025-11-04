// @ts-check
/** @type {CommandObject} */
export default {
	pattern: "say <message:text>",
	aliases: ["s <message:text>", "'<message:text>"],

	execute(context, args) {
		const message = args.get("message");
		console.log(`You say: ${message}`);
	},

	onError(context, result) {
		if (result.error === "Missing required argument: message") {
			console.log("What do you want to say?");
			return;
		}
	},
};
