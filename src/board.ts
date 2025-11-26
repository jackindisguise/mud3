/**
 * Message board system for persistent notes and announcements.
 *
 * Boards can be permanent (keep messages forever) or time-based
 * (automatically expire messages after a certain duration).
 *
 * @module board
 */

import { Game } from "./game.js";
import { Character, MESSAGE_GROUP } from "./character.js";

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
	/** Optional list of character IDs who have read this message */
	readBy?: number[];
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

export interface SerializedBoardConfig {
	name: string;
	displayName: string;
	description: string;
	permanent: boolean;
	expirationMs?: number;
	writePermission?: WritePermission;
	nextMessageId: number;
}

export interface SerializedBoardMessages {
	messages: BoardMessage[];
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
	public createMessage(
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

		// Notify targeted characters that they have mail
		if (message.targets && message.targets.length > 0 && Game.game) {
			Game.game.forEachCharacter((character: Character) => {
				const targetUsername = character.credentials.username.toLowerCase();
				const isTarget = message.targets!.some(
					(t) => t.toLowerCase() === targetUsername
				);

				if (isTarget) {
					// Check if board has access restriction and target doesn't have access
					if (this.writePermission === "admin" && !character.isAdmin()) {
						// Skip notifying this target - they don't have access
						return;
					}

					// Send notification
					character.sendMessage(
						`You have new mail on the ${this.displayName} board from ${author}. Type: board ${this.name} read ${message.id}`,
						MESSAGE_GROUP.SYSTEM
					);
				}
			});
		}

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
	 * Marks a message as read by a character ID.
	 * Adds the character ID to the message's readBy array if not already present.
	 * Does not save the board - use markMessageAsReadAndSave() from package/board for persistence.
	 *
	 * @param messageId - The message ID to mark as read
	 * @param characterId - The character ID that read the message
	 * @returns True if the message was found and marked, false otherwise
	 */
	public markMessageAsRead(messageId: number, characterId: number): boolean {
		const message = this.getMessage(messageId);
		if (!message) {
			return false;
		}

		// Initialize readBy array if it doesn't exist
		if (!message.readBy) {
			message.readBy = [];
		}

		// Add character ID if not already present
		if (!message.readBy.includes(characterId)) {
			message.readBy.push(characterId);
		}

		return true;
	}

	/**
	 * Checks if a message has been read by a character ID.
	 *
	 * @param messageId - The message ID to check
	 * @param characterId - The character ID to check
	 * @returns True if the message has been read by the character, false otherwise
	 */
	public isMessageReadBy(messageId: number, characterId: number): boolean {
		const message = this.getMessage(messageId);
		if (!message || !message.readBy) {
			return false;
		}

		return message.readBy.includes(characterId);
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
	 * Serializes board configuration (without messages).
	 *
	 * @returns Serialized board configuration
	 */
	public serializeConfig(): SerializedBoardConfig {
		return {
			name: this.name,
			displayName: this.displayName,
			description: this.description,
			permanent: this.permanent,
			expirationMs: this.expirationMs,
			writePermission: this.writePermission,
			nextMessageId: this.nextMessageId,
		};
	}

	/**
	 * Serializes board messages.
	 *
	 * @returns Serialized board messages
	 */
	public serializeMessages(): SerializedBoardMessages {
		return {
			messages: this.getAllMessages(),
		};
	}

	/**
	 * Sets the messages array (for deserialization only).
	 * This method is public for use by package deserializers.
	 *
	 * @param messages - The messages to set
	 */
	public setMessages(messages: BoardMessage[]): void {
		this.messages = messages;
	}

	/**
	 * Sets the next message ID (for deserialization only).
	 * This method is public for use by package deserializers.
	 *
	 * @param nextMessageId - The next message ID to set
	 */
	public setNextMessageId(nextMessageId: number): void {
		this.nextMessageId = nextMessageId;
	}
}
