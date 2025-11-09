/**
 * Message board system for persistent notes and announcements.
 *
 * Boards can be permanent (keep messages forever) or time-based
 * (automatically expire messages after a certain duration).
 *
 * @module board
 */

export interface BoardMessage {
	/** Unique message ID */
	id: number;
	/** Username of the author */
	author: string;
	/** Subject line of the message */
	subject: string;
	/** Message content */
	content: string;
	/** Timestamp when the message was posted */
	postedAt: string; // ISO string
	/** Optional list of usernames this message is targeted to. If undefined/empty, message is public. */
	targets?: string[];
}

export type WritePermission = "all" | "admin";

export interface SerializedBoard {
	name: string;
	displayName: string;
	description: string;
	permanent: boolean;
	expirationMs?: number;
	writePermission?: WritePermission;
	messages: BoardMessage[];
	nextMessageId: number;
}

/**
 * Represents a message board that can store persistent notes.
 * Boards can be permanent (messages never expire) or time-limited
 * (messages automatically expire after a set duration).
 */
export class Board {
	/** Board name (unique identifier) */
	public readonly name: string;
	/** Display name for the board */
	public readonly displayName: string;
	/** Description of the board's purpose */
	public readonly description: string;
	/** Whether messages persist forever (true) or expire (false) */
	public readonly permanent: boolean;
	/** Time in milliseconds before messages expire (only used if permanent=false) */
	public readonly expirationMs?: number;
	/** Who can write to this board: "all" (default) or "admin" */
	public readonly writePermission: WritePermission;
	/** Messages on this board */
	private messages: BoardMessage[];
	/** Next message ID to use */
	private nextMessageId: number;

	/**
	 * Creates a new board instance.
	 *
	 * @param name - Unique board identifier
	 * @param displayName - Human-readable board name
	 * @param description - Description of the board's purpose
	 * @param permanent - Whether messages persist forever (default: true)
	 * @param expirationMs - Time in milliseconds before messages expire (only used if permanent=false)
	 * @param writePermission - Who can write to this board: "all" (default) or "admin"
	 */
	constructor(
		name: string,
		displayName: string,
		description: string,
		permanent: boolean = true,
		expirationMs?: number,
		writePermission: WritePermission = "all"
	) {
		this.name = name;
		this.displayName = displayName;
		this.description = description;
		this.permanent = permanent;
		this.expirationMs = expirationMs;
		this.writePermission = writePermission;
		this.messages = [];
		this.nextMessageId = 1;
	}

	/**
	 * Adds a message to this board.
	 *
	 * @param author - Username of the message author
	 * @param subject - Subject line of the message
	 * @param content - Message content
	 * @param targets - Optional list of usernames to target. If undefined/empty, message is public.
	 * @returns The created message
	 */
	public addMessage(
		author: string,
		subject: string,
		content: string,
		targets?: string[]
	): BoardMessage {
		const message: BoardMessage = {
			id: this.nextMessageId++,
			author,
			subject,
			content,
			postedAt: new Date().toISOString(),
			targets: targets && targets.length > 0 ? targets : undefined,
		};
		this.messages.push(message);
		return message;
	}

	/**
	 * Removes expired messages from this board.
	 * Only affects time-limited boards; permanent boards are unchanged.
	 *
	 * @returns The number of messages removed
	 */
	public removeExpiredMessages(): number {
		if (this.permanent || !this.expirationMs) {
			return 0;
		}

		const now = Date.now();
		const initialCount = this.messages.length;

		this.messages = this.messages.filter((msg) => {
			const postedAt = new Date(msg.postedAt).getTime();
			const age = now - postedAt;
			return age < this.expirationMs!;
		});

		return initialCount - this.messages.length;
	}

	/**
	 * Gets a message by its ID.
	 *
	 * @param messageId - The message ID to find
	 * @returns The message if found, undefined otherwise
	 */
	public getMessage(messageId: number): BoardMessage | undefined {
		return this.messages.find((m) => m.id === messageId);
	}

	/**
	 * Checks if a message is visible to a specific user.
	 * Messages are visible if:
	 * - They have no targets (public message)
	 * - The user is the author
	 * - The user is in the targets list
	 *
	 * @param message - The message to check
	 * @param username - The username to check visibility for
	 * @returns True if the message is visible to the user
	 */
	public static isMessageVisible(
		message: BoardMessage,
		username: string
	): boolean {
		// Public messages (no targets) are visible to everyone
		if (!message.targets || message.targets.length === 0) {
			return true;
		}

		// Author can always see their own messages
		if (message.author.toLowerCase() === username.toLowerCase()) {
			return true;
		}

		// Check if user is in targets list (case-insensitive)
		return message.targets.some(
			(target) => target.toLowerCase() === username.toLowerCase()
		);
	}

	/**
	 * Gets all messages visible to a specific user.
	 *
	 * @param username - The username to filter messages for
	 * @returns Array of messages visible to the user
	 */
	public getVisibleMessages(username: string): BoardMessage[] {
		return this.messages.filter((msg) => Board.isMessageVisible(msg, username));
	}

	/**
	 * Checks if a user can write to this board.
	 *
	 * @param isAdmin - Whether the user is an administrator
	 * @returns True if the user can write to this board
	 */
	public canWrite(isAdmin: boolean): boolean {
		if (this.writePermission === "admin") {
			return isAdmin;
		}
		return true; // "all" permission
	}

	/**
	 * Gets the total number of messages on this board.
	 *
	 * @returns The message count
	 */
	public getMessageCount(): number {
		return this.messages.length;
	}

	/**
	 * Gets all messages on this board (for internal use and serialization).
	 * Returns a copy to prevent external modification.
	 *
	 * @returns A copy of all messages
	 */
	public getAllMessages(): BoardMessage[] {
		return [...this.messages];
	}

	/**
	 * Serializes this board for persistence.
	 *
	 * @returns Serialized board data
	 */
	public serialize(): SerializedBoard {
		return {
			name: this.name,
			displayName: this.displayName,
			description: this.description,
			permanent: this.permanent,
			expirationMs: this.expirationMs,
			writePermission: this.writePermission,
			messages: this.getAllMessages(),
			nextMessageId: this.nextMessageId,
		};
	}

	/**
	 * Creates a Board instance from serialized data.
	 *
	 * @param data - Serialized board data
	 * @returns New Board instance
	 */
	public static deserialize(data: SerializedBoard): Board {
		const board = new Board(
			data.name,
			data.displayName,
			data.description,
			data.permanent,
			data.expirationMs,
			data.writePermission || "all" // Default to "all" for backward compatibility
		);
		// Ensure all messages have a subject (for backward compatibility)
		board.setMessages(
			data.messages.map((msg) => ({
				...msg,
				subject: msg.subject || "(No subject)",
			}))
		);
		board.nextMessageId = data.nextMessageId;
		return board;
	}

	/**
	 * Sets the messages array (for deserialization only).
	 * This is a private method to maintain encapsulation.
	 *
	 * @param messages - The messages to set
	 * @private
	 */
	private setMessages(messages: BoardMessage[]): void {
		this.messages = messages;
	}
}
