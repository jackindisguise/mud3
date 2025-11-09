import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR, SIZER } from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { string } from "mud-ext";

export default {
	pattern: "score",
	aliases: ["info", "me"],
	execute(context: CommandContext): void {
		const { actor } = context;
		const character = actor.character;
		if (!character) {
			actor.sendMessage(
				"Only players have a score.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		const mob = character.mob;
		const lines: string[] = [];
		lines.push(color("-- Character Info --", COLOR.YELLOW));
		lines.push(
			`${color("Username:", COLOR.CYAN)} ${character.credentials.username}`
		);
		lines.push(
			`${color("Active:", COLOR.CYAN)} ${
				character.credentials.isActive ? "Yes" : "No"
			}`
		);
		lines.push(
			`${color("Admin:", COLOR.CYAN)} ${
				character.credentials.isAdmin ? "Yes" : "No"
			}`
		);
		lines.push(
			`${color("Banned:", COLOR.CYAN)} ${
				character.credentials.isBanned ? "Yes" : "No"
			}`
		);
		lines.push(
			`${color(
				"Created:",
				COLOR.CYAN
			)} ${character.credentials.createdAt.toLocaleString()}`
		);
		lines.push(
			`${color(
				"Last Login:",
				COLOR.CYAN
			)} ${character.credentials.lastLogin.toLocaleString()}`
		);
		lines.push("");
		lines.push(color("-- Stats --", COLOR.YELLOW));
		lines.push(
			`${color("Playtime:", COLOR.LIME)} ${character.getFormattedPlaytime()}`
		);
		lines.push(`${color("Deaths:", COLOR.LIME)} ${character.stats.deaths}`);
		lines.push(`${color("Kills:", COLOR.LIME)} ${character.stats.kills}`);
		lines.push("");
		lines.push(color("-- Mob Info --", COLOR.YELLOW));
		lines.push(`${color("Display:", COLOR.PINK)} ${mob.display}`);
		lines.push(
			`${color("Location:", COLOR.PINK)} ${
				mob.location && mob.location.display ? mob.location.display : "(none)"
			}`
		);
		lines.push(
			`${color("Keywords:", COLOR.PINK)} ${
				mob.keywords ? mob.keywords : "(none)"
			}`
		);
		const box = string.box({
			input: lines,
			width: 80,
			style: {
				...string.BOX_STYLES.ROUNDED,
				titleHAlign: string.PAD_SIDE.CENTER,
				titleBorder: {
					left: ">",
					right: "<",
				},
			},
			title: `${actor.display}`,
			sizer: SIZER,
		});
		actor.sendMessage(box.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
