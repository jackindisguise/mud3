import { COLOR, colorToTag, stickyColor } from "./color.js";

/**
 * Predefined communication channels that players can subscribe to.
 * Using an enum ensures type safety and restricts channels to a known set.
 */
export enum CHANNEL {
	OOC = "OOC",
	NEWBIE = "NEWBIE",
	TRADE = "TRADE",
	GOSSIP = "GOSSIP",
	SAY = "SAY",
}

/**
 * Configuration information for a communication channel.
 */
export interface ChannelInfo {
	/** Full name of the channel */
	channelName: string;
	/** Short tag displayed in brackets (e.g., "OOC") */
	channelTag: string;
	/** Primary color for the channel tag */
	primaryColor: COLOR;
	/** Highlight color for usernames or important text */
	highlightColor: COLOR;
}

/**
 * Default channel configurations with color schemes.
 */
export const CHANNEL_INFO: Record<CHANNEL, ChannelInfo> = {
	[CHANNEL.OOC]: {
		channelName: "Out of Character",
		channelTag: "OOC",
		primaryColor: COLOR.CYAN,
		highlightColor: COLOR.WHITE,
	},
	[CHANNEL.NEWBIE]: {
		channelName: "Newbie Help",
		channelTag: "NEWBIE",
		primaryColor: COLOR.LIME,
		highlightColor: COLOR.YELLOW,
	},
	[CHANNEL.TRADE]: {
		channelName: "Trading",
		channelTag: "TRADE",
		primaryColor: COLOR.YELLOW,
		highlightColor: COLOR.WHITE,
	},
	[CHANNEL.GOSSIP]: {
		channelName: "Gossip",
		channelTag: "GOSSIP",
		primaryColor: COLOR.PINK,
		highlightColor: COLOR.WHITE,
	},
	[CHANNEL.SAY]: {
		channelName: "Say",
		channelTag: "SAY",
		primaryColor: COLOR.WHITE,
		highlightColor: COLOR.YELLOW,
	},
};

/**
 * Array of all channel values for convenient runtime iteration.
 */
export const CHANNELS: readonly CHANNEL[] = Object.values(CHANNEL);

/**
 * Formats a channel message with appropriate colors.
 * @param channel The channel enum value
 * @param username The username of the speaker
 * @param message The message text
 * @returns A formatted string with color tags
 *
 * @example
 * formatChannelMessage(CHANNEL.OOC, "Alice", "Hello everyone!")
 * // returns "{C[OOC] {WAlice{x: Hello everyone!{x"
 */
export function formatChannelMessage(
	channel: CHANNEL,
	username: string,
	message: string
): string {
	const info = CHANNEL_INFO[channel];
	const highlight = colorToTag(info.highlightColor);
	const formattedMessage = `[${info.channelTag}] ${highlight}${username}{x: ${highlight}${message}{x`;
	return stickyColor(formattedMessage, info.primaryColor);
}
