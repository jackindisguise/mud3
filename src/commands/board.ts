/**
 * Board command for reading and writing messages on message boards.
 *
 * Allows players to read messages from boards, write new messages,
 * and view specific messages by ID.
 *
 * @example
 * ```
 * board                           // List all available boards
 * board general                   // List all visible messages (subject lines only)
 * board general read 5            // Read message #5 from general board
 * board general write             // Start interactive write sequence
 * ```
 *
 * **Pattern:** `board <boardname:word?> <action:word?> <id:word?>`
 * @module commands/board
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { getBoard, loadBoard } from "../package/board.js";
import { Board, BoardMessage } from "../board.js";
import { color, COLOR, textStyleToTag, TEXT_STYLE, SIZER } from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { string } from "mud-ext";
import { showBoardsList } from "./boards.js";

export default {
	pattern: "board <boardname:word?> <action:word?> <id:word?>",
	async execute(context: CommandContext, args: Map<string, any>) {
		const boardName = args.get("boardname") as string | undefined;
		const action = args.get("action") as string | undefined;
		const idArg = args.get("id") as string | undefined;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can use message boards.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// If no board name provided, show the boards list
		if (!boardName || boardName === "") {
			showBoardsList(character);
			return;
		}

		// Load the board
		try {
			let board = getBoard(boardName);
			if (!board) {
				actor.sendMessage(
					`Board "${color(
						boardName,
						COLOR.YELLOW
					)}" does not exist. Use ${color(
						"boards",
						COLOR.CYAN
					)} to see available boards.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Remove expired messages before processing
			const removed = board.removeExpiredMessages();
			if (removed > 0) {
				board.save().catch(() => {
					// Error is logged by board.save(), continue anyway
				});
			}

			// Handle different actions
			if (!action || action === "") {
				// List all messages (subject lines only)
				displayBoard(
					actor,
					board,
					character.credentials.username,
					character.credentials.characterId
				);
			} else if (action.toLowerCase() === "read") {
				// Check for "read next" command
				if (!idArg || idArg.toLowerCase() === "next") {
					// Find oldest unread message
					const visibleMessages = board.getVisibleMessages(
						character.credentials.username
					);
					const unreadMessages = visibleMessages.filter(
						(msg) =>
							!board.isMessageReadBy(msg.id, character.credentials.characterId)
					);

					if (unreadMessages.length === 0) {
						actor.sendMessage(
							"No unread messages on this board.",
							MESSAGE_GROUP.COMMAND_RESPONSE
						);
						return;
					}

					// Sort by ID (oldest first) and get the first one
					const oldestUnread = unreadMessages.sort((a, b) => a.id - b.id)[0];

					// Display and mark as read
					await displayAndMarkMessageAsRead(
						actor,
						board,
						oldestUnread,
						character.credentials.characterId
					);
					return;
				}

				// Parse idArg as a number
				const idValue = parseInt(idArg, 10);
				if (isNaN(idValue)) {
					actor.sendMessage(
						`Invalid message ID. Use: ${color(
							`board ${boardName} read <id>`,
							COLOR.CYAN
						)} or ${color(`board ${boardName} read next`, COLOR.CYAN)}`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					return;
				}

				// Read specific message by ID
				const msg = board.getMessage(idValue);
				if (!msg) {
					actor.sendMessage(
						`Message #${idValue} not found on this board.`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					return;
				}
				// Check if user can see this message
				if (!Board.isMessageVisible(msg, character.credentials.username)) {
					actor.sendMessage(
						`Message #${idValue} is not visible to you.`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					return;
				}
				// Display and mark as read
				await displayAndMarkMessageAsRead(
					actor,
					board,
					msg,
					character.credentials.characterId
				);
			} else if (
				action.toLowerCase() === "write" ||
				action.toLowerCase() === "post"
			) {
				// Check if user has permission to write to this board
				if (!board.canWrite(character.isAdmin())) {
					actor.sendMessage(
						`Only administrators can post to the ${color(
							board.displayName,
							COLOR.YELLOW
						)} board.`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					return;
				}
				// Start interactive write sequence
				startWriteSequence(character, board, boardName);
			} else {
				actor.sendMessage(
					`Unknown action "${action}". Use ${color(
						"read",
						COLOR.CYAN
					)} to view messages or ${color("write", COLOR.CYAN)} to post.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			}
		} catch (err) {
			actor.sendMessage(
				"Error loading board. Please try again.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
		}
	},

	onError(context: CommandContext, result: ParseResult): void {
		context.actor.sendMessage(
			`Error: ${result.error}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;

function displayBoard(
	actor: any,
	board: Board,
	username: string,
	characterId: number
): void {
	// Get visible messages for this user
	const visibleMessages = board.getVisibleMessages(username);

	const headerLines = [color(board.description, COLOR.SILVER)];

	if (visibleMessages.length === 0) {
		headerLines.push(color("No messages visible on this board.", COLOR.SILVER));
	} else {
		headerLines.push(
			`${color("Messages:", COLOR.CYAN)} ${
				visibleMessages.length
			} (${board.getMessageCount()} total)`
		);
	}

	// Header box with board description
	const header = string.box({
		input: [...headerLines],
		width: 76,
		sizer: SIZER,
	});

	// Message list box
	let messageListLines: string[] = [];
	if (visibleMessages.length > 0) {
		// Show last 10 messages (most recent first)
		const recentMessages = visibleMessages.slice().reverse().slice(0, 10);

		for (const msg of recentMessages) {
			const postedDate = new Date(msg.postedAt);
			const timeAgo = getTimeAgo(postedDate);
			const targetInfo =
				msg.targets && msg.targets.length > 0
					? ` ${color("(targeted)", COLOR.PURPLE)}`
					: "";
			// Check if message has been read by this character
			const isRead = board.isMessageReadBy(msg.id, characterId);
			const readStatus = isRead
				? ` ${color("[read]", COLOR.LIME)}`
				: ` ${color("[unread]", COLOR.YELLOW)}`;
			messageListLines.push(
				`${color(`[${msg.id}]`, COLOR.CYAN)} ${color(
					msg.subject,
					COLOR.WHITE
				)} - ${color(msg.author, COLOR.LIME)} ${color(
					timeAgo,
					COLOR.SILVER
				)}${targetInfo}${readStatus}`
			);
		}
	}

	const messageList = string.box({
		input: messageListLines,
		width: 76,
		sizer: SIZER,
		style: {
			hPadding: 2,
			vPadding: 1,
		},
	});

	// Footer box with help text (if there are more messages)
	let footerLines: string[] = [];
	if (visibleMessages.length > 10) {
		footerLines.push(
			color(
				`... and ${
					visibleMessages.length - 10
				} more visible message(s). Use ${color(
					`board ${board.name} read <id>`,
					COLOR.CYAN
				)} to read specific messages, or ${color(
					`board ${board.name} read next`,
					COLOR.CYAN
				)} to read the oldest unread message.`,
				COLOR.SILVER
			)
		);
	}

	let megaBoxInput: string[] = [...header, ...messageList];
	if (footerLines.length > 0) {
		const footer = string.box({
			input: footerLines,
			width: 76,
			sizer: SIZER,
			style: {
				hAlign: string.ALIGN.RIGHT,
			},
		});
		megaBoxInput = [...megaBoxInput, ...footer];
	}

	const megaBox = string.box({
		input: megaBoxInput,
		width: 80,
		sizer: SIZER,
		title: color(`${board.displayName}`, COLOR.YELLOW),
		style: {
			...string.BOX_STYLES.PLAIN,
			titleHAlign: string.ALIGN.CENTER,
		},
	});

	actor.sendMessage(megaBox.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}

/**
 * Displays a message and marks it as read by the character.
 * This is a convenience function that combines displayMessage and markMessageAsRead.
 *
 * @param actor - The actor viewing the message
 * @param board - The board containing the message
 * @param msg - The message to display and mark as read
 * @param characterId - The character ID marking the message as read
 */
async function displayAndMarkMessageAsRead(
	actor: any,
	board: Board,
	msg: BoardMessage,
	characterId: number
): Promise<void> {
	// Mark message as read (automatically saves the board)
	await board.markMessageAsRead(msg.id, characterId);
	displayMessage(actor, board, msg);
}

function displayMessage(actor: any, board: Board, msg: BoardMessage): void {
	const lines: string[] = [];
	const postedDate = new Date(msg.postedAt);
	const formattedDate = postedDate.toLocaleString();

	const header = string.box({
		input: [
			`${color("Author:", COLOR.CYAN)} ${color(msg.author, COLOR.LIME)}`,
			`${color("Subject:", COLOR.CYAN)} ${color(msg.subject, COLOR.WHITE)}`,
		],
		width: 76,
		sizer: SIZER,
	});
	const content = string.box({
		input: [...msg.content.split(LINEBREAK)],
		width: 76,
		sizer: SIZER,
		style: {
			vPadding: 1,
			hPadding: 2,
		},
	});
	const footer = string.box({
		input: [`${color("Posted:", COLOR.CYAN)} ${formattedDate}`],
		width: 76,
		sizer: SIZER,
		style: {
			hAlign: string.ALIGN.RIGHT,
		},
	});
	const megaBox = string.box({
		input: [...header, ...content, ...footer],
		width: 80,
		sizer: SIZER,
		title: color(`${board.displayName} Message #${msg.id}`, COLOR.CYAN),
		style: {
			...string.BOX_STYLES.PLAIN,
			titleHAlign: string.ALIGN.CENTER,
		},
	});

	actor.sendMessage(megaBox.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}

/**
 * Starts an interactive sequence for writing a board message.
 * Asks for targets, subject, and then message body (multi-line until !done).
 */
function startWriteSequence(
	character: any,
	board: Board,
	boardName: string
): void {
	let targets: string[] = [];
	let subject: string = "";
	const bodyLines: string[] = [];

	const sendLine = (line: string) => character.sendLine(line);
	const ask = (question: string, callback: (input: string) => void) =>
		character.ask(question, callback);
	const yesno = (
		question: string,
		callback: (yesorno: boolean | undefined) => void,
		_default?: boolean | undefined
	) => character.yesno(question, callback, _default);

	// Step 1: Ask for targets
	const askTargets = () => {
		ask(
			`Target users (space-separated @mentions, or press Enter for public):`,
			(input: string) => {
				if (input.trim()) {
					// Parse @mentions
					const mentionRegex = /@(\w+)/g;
					let match;
					while ((match = mentionRegex.exec(input)) !== null) {
						targets.push(match[1]);
					}
					// If "@all" is specified, make it public (clear targets)
					if (targets.some((t) => t.toLowerCase() === "all")) {
						targets = [];
					}
				}
				askSubject();
			}
		);
	};

	// Step 2: Ask for subject
	const askSubject = () => {
		ask("Subject:", (input: string) => {
			if (!input || input.trim().length === 0) {
				sendLine("Subject cannot be empty.");
				askSubject();
				return;
			}
			subject = input.trim();
			askBody();
		});
	};

	// Helper function to show body with line numbers
	const showBody = () => {
		if (bodyLines.length === 0) {
			sendLine(color("Message body is empty.", COLOR.SILVER));
			return;
		}
		sendLine("");
		sendLine(color("=== Current Message Body ===", COLOR.YELLOW));
		bodyLines.forEach((line, index) => {
			sendLine(
				`${color(`${(index + 1).toString().padStart(2)}:`, COLOR.CYAN)} ${line}`
			);
		});
		sendLine("");
	};

	// Helper function to delete a line
	const deleteLine = (lineNum: number) => {
		const index = lineNum - 1; // Convert to 0-based index
		if (index < 0 || index >= bodyLines.length) {
			sendLine(
				color(
					`Invalid line number. Body has ${bodyLines.length} line(s).`,
					COLOR.CRIMSON
				)
			);
			return;
		}
		const deleted = bodyLines.splice(index, 1)[0];
		sendLine(
			color(
				`Deleted line ${lineNum}: "${deleted.substring(0, 50)}..."`,
				COLOR.LIME
			)
		);
	};

	// Helper function to insert a line
	const insertLine = (lineNum: number, text: string) => {
		const index = lineNum - 1; // Convert to 0-based index
		if (index < 0 || index > bodyLines.length) {
			sendLine(
				color(
					`Invalid line number. Must be between 1 and ${bodyLines.length + 1}.`,
					COLOR.CRIMSON
				)
			);
			return;
		}
		// Wrap the text at 80 characters
		const wrapped = string.wrap(text, 72);
		// Add color reset code to each line
		const resetTag = textStyleToTag(TEXT_STYLE.RESET_ALL);
		const linesWithReset = wrapped.map((line) => line + resetTag);
		// Insert at the specified position (pushes existing line down)
		bodyLines.splice(index, 0, ...linesWithReset);
		sendLine(
			color(
				`Inserted ${wrapped.length} line(s) at position ${lineNum}.`,
				COLOR.LIME
			)
		);
	};

	// Helper function to replace a line
	const replaceLine = (lineNum: number, text: string) => {
		const index = lineNum - 1; // Convert to 0-based index
		if (index < 0 || index >= bodyLines.length) {
			sendLine(
				color(
					`Invalid line number. Body has ${bodyLines.length} line(s).`,
					COLOR.CRIMSON
				)
			);
			return;
		}
		const wrapped = string.wrap(text, 72);
		const resetTag = textStyleToTag(TEXT_STYLE.RESET_ALL);
		const linesWithReset = wrapped.map((line) => line + resetTag);
		bodyLines.splice(index, 1, ...linesWithReset);
		sendLine(
			color(
				`Replaced line ${lineNum} with ${linesWithReset.length} line(s).`,
				COLOR.LIME
			)
		);
	};

	// Helper function to show help
	const showHelp = () => {
		sendLine("");
		sendLine(color("=== Message Body Commands ===", COLOR.YELLOW));
		sendLine(
			`${color("!done", COLOR.CYAN)} - Finish editing and preview the message`
		);
		sendLine(
			`${color(
				"!show",
				COLOR.CYAN
			)} - Display the current message body with line numbers`
		);
		sendLine(
			`${color(
				"!delete <n>",
				COLOR.CYAN
			)} - Delete line number <n> from the body`
		);
		sendLine(
			`${color(
				"!insert <n> <text>",
				COLOR.CYAN
			)} - Insert a line at position <n>, pushing existing lines down`
		);
		sendLine(
			`${color(
				"!replace <n> <text>",
				COLOR.CYAN
			)} - Replace line <n> with new wrapped text`
		);
		sendLine(
			`${color("!subject <text>", COLOR.CYAN)} - Change the message subject`
		);
		sendLine(
			`${color(
				"!to <@targets>",
				COLOR.CYAN
			)} - Change message targets (use @all for public)`
		);
		sendLine(
			`${color("!forget", COLOR.CYAN)} or ${color(
				"!quit",
				COLOR.CYAN
			)} - Cancel message creation`
		);
		sendLine(`${color("!help", COLOR.CYAN)} - Show this help message`);
		sendLine("");
	};

	// Step 3: Ask for message body (multi-line until !done)
	const bodyInput = (input: string) => {
		const trimmed = input.trim();
		const lower = trimmed.toLowerCase();

		if (lower === "!done") {
			if (bodyLines.length === 0) {
				sendLine("Message body cannot be empty.");
				askBody();
				return;
			}
			// Show preview and ask for confirmation
			showPreview();
		} else if (lower === "!help") {
			showHelp();
			askBody();
		} else if (lower === "!show") {
			showBody();
			askBody();
		} else if (lower.startsWith("!delete ")) {
			const lineNumStr = trimmed.substring(8).trim();
			const lineNum = parseInt(lineNumStr, 10);
			if (isNaN(lineNum)) {
				sendLine(
					color(
						`Invalid line number. Use: ${color(
							"!delete <number>",
							COLOR.CYAN
						)}`,
						COLOR.CRIMSON
					)
				);
				askBody();
				return;
			}
			deleteLine(lineNum);
			askBody();
		} else if (lower.startsWith("!insert ")) {
			const rest = trimmed.substring(8).trim();
			// Find the first space to separate line number from text
			const spaceIndex = rest.indexOf(" ");
			if (spaceIndex === -1) {
				sendLine(
					color(
						`Invalid format. Use: ${color(
							"!insert <number> <text>",
							COLOR.CYAN
						)}`,
						COLOR.CRIMSON
					)
				);
				askBody();
				return;
			}
			const lineNumStr = rest.substring(0, spaceIndex);
			const text = rest.substring(spaceIndex + 1).trim();
			if (!text) {
				sendLine(
					color(
						`Text cannot be empty. Use: ${color(
							"!insert <number> <text>",
							COLOR.CYAN
						)}`,
						COLOR.CRIMSON
					)
				);
				askBody();
				return;
			}
			const lineNum = parseInt(lineNumStr, 10);
			if (isNaN(lineNum)) {
				sendLine(
					color(
						`Invalid line number. Use: ${color(
							"!insert <number> <text>",
							COLOR.CYAN
						)}`,
						COLOR.CRIMSON
					)
				);
				askBody();
				return;
			}
			insertLine(lineNum, text);
			askBody();
		} else if (lower.startsWith("!replace")) {
			const rest = trimmed.substring(9).trim();
			const spaceIndex = rest.indexOf(" ");
			if (spaceIndex === -1) {
				sendLine(
					color(
						`Invalid format. Use: ${color(
							"!replace <number> <text>",
							COLOR.CYAN
						)}`,
						COLOR.CRIMSON
					)
				);
				askBody();
				return;
			}
			const lineNumStr = rest.substring(0, spaceIndex);
			const text = rest.substring(spaceIndex + 1).trim();
			if (!text) {
				sendLine(
					color(
						`Text cannot be empty. Use: ${color(
							"!replace <number> <text>",
							COLOR.CYAN
						)}`,
						COLOR.CRIMSON
					)
				);
				askBody();
				return;
			}
			const lineNum = parseInt(lineNumStr, 10);
			if (isNaN(lineNum)) {
				sendLine(
					color(
						`Invalid line number. Use: ${color(
							"!replace <number> <text>",
							COLOR.CYAN
						)}`,
						COLOR.CRIMSON
					)
				);
				askBody();
				return;
			}
			replaceLine(lineNum, text);
			askBody();
		} else if (lower.startsWith("!subject ")) {
			const newSubject = trimmed.substring(9).trim();
			if (!newSubject || newSubject.length === 0) {
				sendLine(
					color(
						`Subject cannot be empty. Use: ${color(
							"!subject <new subject>",
							COLOR.CYAN
						)}`,
						COLOR.CRIMSON
					)
				);
				askBody();
				return;
			}
			subject = newSubject;
			sendLine(color(`Subject changed to: "${subject}"`, COLOR.LIME));
			askBody();
		} else if (lower.startsWith("!to ")) {
			const newTargetsInput = trimmed.substring(4).trim();
			targets = [];
			if (newTargetsInput) {
				// Parse @mentions
				const mentionRegex = /@(\w+)/g;
				let match;
				while ((match = mentionRegex.exec(newTargetsInput)) !== null) {
					targets.push(match[1]);
				}
				// If "@all" is specified, make it public (clear targets)
				if (targets.some((t) => t.toLowerCase() === "all")) {
					targets = [];
				}
			}
			if (targets.length > 0) {
				sendLine(
					color(`Targets changed to: ${targets.join(", ")}`, COLOR.LIME)
				);
			} else {
				sendLine(
					color("Targets cleared - message will be public.", COLOR.LIME)
				);
			}
			askBody();
		} else if (lower === "!forget" || lower === "!quit") {
			character.sendMessage(
				"Message cancelled.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
		} else {
			// Wrap the input at 80 characters and add to body
			const wrapped = string.wrap(trimmed, 72);
			// Add color reset code to each line
			const resetTag = textStyleToTag(TEXT_STYLE.RESET_ALL);
			const linesWithReset = wrapped.map((line) => line + resetTag);
			bodyLines.push(...linesWithReset);
			ask("> ", bodyInput);
		}
	};

	const askBody = () => {
		sendLine(
			`Enter message body. Type ${color(
				"!done",
				COLOR.CYAN
			)} when finished, or ${color("!help", COLOR.CYAN)} for commands.`
		);
		ask("> ", bodyInput);
	};

	// Step 4: Show preview and confirm
	const showPreview = () => {
		const content = bodyLines.join(LINEBREAK);
		const lines: string[] = [];
		lines.push("");
		lines.push(color("=== Message Preview ===", COLOR.YELLOW));
		lines.push(`${color("Board:", COLOR.CYAN)} ${board.displayName}`);
		if (targets.length > 0) {
			lines.push(
				`${color("Targeted to:", COLOR.CYAN)} ${color(
					targets.join(", "),
					COLOR.PURPLE
				)}`
			);
		} else {
			lines.push(`${color("Visibility:", COLOR.CYAN)} Public`);
		}
		lines.push(
			`${color("Subject:", COLOR.CYAN)} ${color(subject, COLOR.WHITE)}`
		);
		lines.push("");
		lines.push(color("Body:", COLOR.CYAN));
		lines.push(content);
		lines.push("");

		for (const line of lines) {
			sendLine(line);
		}

		yesno("Submit this message?", async (confirmed) => {
			if (confirmed === true) {
				// Save the message
				const newMessage = board.createMessage(
					character.credentials.username,
					subject,
					content,
					targets.length > 0 ? targets : undefined
				);
				// Mark message as read by the author (automatically saves the board)
				await board.markMessageAsRead(
					newMessage.id,
					character.credentials.characterId
				);
				const targetInfo =
					newMessage.targets && newMessage.targets.length > 0
						? ` (targeted to ${newMessage.targets.join(", ")})`
						: "";
				character.sendMessage(
					`Message #${newMessage.id} posted to ${color(
						board.displayName,
						COLOR.YELLOW
					)} board${targetInfo}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			} else if (confirmed === false) {
				// User declined - ask if they want to continue editing
				yesno("Continue editing?", (continueEditing) => {
					if (continueEditing === true) {
						askBody();
					} else {
						character.sendMessage(
							"Message cancelled.",
							MESSAGE_GROUP.COMMAND_RESPONSE
						);
					}
				});
			} else {
				// No response - ask again
				showPreview();
			}
		});
	};

	// Start the sequence
	askTargets();
}

function getTimeAgo(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffDays > 0) {
		return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
	} else if (diffHours > 0) {
		return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
	} else if (diffMinutes > 0) {
		return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
	} else {
		return "just now";
	}
}
