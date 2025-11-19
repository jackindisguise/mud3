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
	GOCIAL = "GOCIAL",
	SAY = "SAY",
	WHISPER = "WHISPER",
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
	/**
	 * Message format pattern with placeholders:
	 * - $tag: Channel tag (e.g., "OOC")
	 * - $speaker: Speaker's username
	 * - $message: The message text
	 * - $primary: Primary color tag
	 * - $highlight: Highlight color tag
	 * - $recipient: Recipient username (for whispers)
	 */
	messagePattern: string;
	/**
	 * Optional: pattern for recipient's view (used for WHISPER only)
	 */
	recipientMessagePattern?: string;
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
		messagePattern:
			"$primary[$tag] $highlight$speaker$primary: $highlight$message{x",
	},
	[CHANNEL.NEWBIE]: {
		channelName: "Newbie Help",
		channelTag: "NEWBIE",
		primaryColor: COLOR.LIME,
		highlightColor: COLOR.YELLOW,
		messagePattern:
			"$primary[$tag] $highlight$speaker$primary: $highlight$message{x",
	},
	[CHANNEL.TRADE]: {
		channelName: "Trading",
		channelTag: "TRADE",
		primaryColor: COLOR.OLIVE,
		highlightColor: COLOR.YELLOW,
		messagePattern:
			"$primary[$tag] $highlight$speaker$primary: $highlight$message{x",
	},
	[CHANNEL.GOSSIP]: {
		channelName: "Gossip",
		channelTag: "GOSSIP",
		primaryColor: COLOR.LIME,
		highlightColor: COLOR.WHITE,
		messagePattern:
			"$primary[$tag] $highlight$speaker$primary: $highlight$message{x",
	},
	[CHANNEL.GOCIAL]: {
		channelName: "Global Social",
		channelTag: "GOCIAL",
		primaryColor: COLOR.PURPLE,
		highlightColor: COLOR.WHITE,
		messagePattern: "$primary[$tag] $highlight$message{x",
	},
	[CHANNEL.SAY]: {
		channelName: "Say",
		channelTag: "SAY",
		primaryColor: COLOR.MAROON,
		highlightColor: COLOR.CRIMSON,
		messagePattern:
			"$primary[$tag] $highlight$speaker$primary: $highlight$message{x",
	},
	[CHANNEL.WHISPER]: {
		channelName: "Whisper",
		channelTag: "WHISPER",
		primaryColor: COLOR.PINK,
		highlightColor: COLOR.WHITE,
		messagePattern:
			"$primary[$tag] $highlight$speaker$primary: $highlight$message{x",
	},
};

/**
 * Array of all channel values for convenient runtime iteration.
 */
export const CHANNELS: readonly CHANNEL[] = Object.values(CHANNEL);

/**
 * Formats a channel message with appropriate colors using the channel's pattern.
 * @param channel The channel enum value
 * @param username The username of the speaker
 * @param message The message text
 * @param recipient The username of the recipient
 * @returns A formatted string with color tags
 *
 * @example
 * formatChannelMessage(CHANNEL.OOC, "Alice", "Hello everyone!")
 * // returns "{C[OOC] {WAlice{x: {WHello everyone!{x"
 *
 * formatChannelMessage(CHANNEL.SAY, "Bob", "Nice day!")
 * // returns "{rBob says, '{RNice day!{r'{x"
 */
export function formatChannelMessage(
	channel: CHANNEL,
	username: string,
	message: string
): string {
	const info = CHANNEL_INFO[channel];
	const primary = colorToTag(info.primaryColor);
	const highlight = colorToTag(info.highlightColor);

	let formatted = info.messagePattern
		.replace(/\$tag/g, info.channelTag)
		.replace(/\$speaker/g, username)
		.replace(/\$message/g, message)
		.replace(/\$primary/g, primary)
		.replace(/\$highlight/g, highlight);

	return formatted;
}
