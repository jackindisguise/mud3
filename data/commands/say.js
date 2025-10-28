export default {
	pattern: "say <message:text>",
	aliases: ["s <message:text>", "'<message:text>"],
	execute: function (context, args) {
		const message = args.get("message");
		console.log(`You say: ${message}`);
	},

	onError: function (context, result) {
		if (!result.args.message) {
			console.log("What do you want to say?");
		}
	},
};
