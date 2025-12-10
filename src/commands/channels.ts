/**
 * Channels command for managing channel subscriptions.
 *
 * Allows players to view their current channel subscriptions and enable/disable
 * specific channels. Without arguments, displays the current status of all channels.
 *
 * @example
 * ```
 * channels                    // List all channels with on/off status
 * channels on ooc             // Subscribe to OOC channel
 * channels off gossip         // Unsubscribe from GOSSIP channel
 * channels enable newbie      // Subscribe to NEWBIE channel
 * channels disable trade      // Unsubscribe from TRADE channel
 * ```
 *
 * **Pattern:** `channels <action:word?> <channel:word?>`
 * @module commands/channels
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { CHANNEL, CHANNELS, CHANNEL_INFO } from "../core/channel.js";
import { color, COLOR } from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";

export const command = {
	pattern: "channels~ <action:word?> <channel:word?>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const action = args.get("action") as string | undefined;
		const channelName = args.get("channel") as string | undefined;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can manage channels.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// If no arguments, list all channels with their status
		if (!action) {
			const lines: string[] = ["Available channels:"];
			for (const channel of CHANNELS) {
				const info = CHANNEL_INFO[channel];
				const isSubscribed = character.isInChannel(channel);
				const status = isSubscribed
					? color("[*]", COLOR.LIME)
					: color("[ ]", COLOR.CRIMSON);
				const tag = color(info.channelTag.padEnd(10), info.primaryColor);
				const name = color(info.channelName, info.highlightColor);
				lines.push(`  ${status} ${tag} - ${name}`);
			}
			lines.push("", "Usage: channels <on|off|enable|disable> <channel>");
			actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
			return;
		}

		// Validate action
		const normalizedAction = action.toLowerCase();
		const isEnabling =
			normalizedAction === "on" || normalizedAction === "enable";
		const isDisabling =
			normalizedAction === "off" || normalizedAction === "disable";

		if (!isEnabling && !isDisabling) {
			actor.sendMessage(
				`Invalid action "${action}". Use: on, off, enable, or disable`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Require channel name
		if (!channelName) {
			actor.sendMessage(
				"Which channel? Available channels: " +
					CHANNELS.map((c) => CHANNEL_INFO[c].channelTag).join(", "),
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Find matching channel (case-insensitive)
		const normalizedChannelName = channelName.toUpperCase();
		const channel = CHANNELS.find(
			(c) =>
				c === normalizedChannelName ||
				CHANNEL_INFO[c].channelTag === normalizedChannelName
		);

		if (!channel) {
			actor.sendMessage(
				`Unknown channel "${channelName}". Available channels: ` +
					CHANNELS.map((c) => CHANNEL_INFO[c].channelTag).join(", "),
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const info = CHANNEL_INFO[channel];
		const isCurrentlySubscribed = character.isInChannel(channel);

		// Handle enabling
		if (isEnabling) {
			if (isCurrentlySubscribed) {
				actor.sendMessage(
					`You are already subscribed to the ${info.channelTag} channel.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			} else {
				character.joinChannel(channel);
				actor.sendMessage(
					`You are now subscribed to the ${info.channelTag} channel.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			}
			return;
		}

		// Handle disabling
		if (isDisabling) {
			if (!isCurrentlySubscribed) {
				actor.sendMessage(
					`You are not subscribed to the ${info.channelTag} channel.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			} else {
				character.leaveChannel(channel);
				actor.sendMessage(
					`You have unsubscribed from the ${info.channelTag} channel.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			}
			return;
		}
	},

	onError(context: CommandContext, result: ParseResult): void {
		context.actor.sendMessage(
			`Error: ${result.error}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;
