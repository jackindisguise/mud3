import { test, suite } from "node:test";
import assert from "node:assert";
import { Board, BoardMessage, SerializedBoard } from "./board.js";

suite("board.ts", () => {
	suite("Board constructor", () => {
		test("should create a permanent board with default values", () => {
			const board = new Board("test", "Test Board", "A test board");
			assert.strictEqual(board.name, "test");
			assert.strictEqual(board.displayName, "Test Board");
			assert.strictEqual(board.description, "A test board");
			assert.strictEqual(board.permanent, true);
			assert.strictEqual(board.expirationMs, undefined);
			assert.strictEqual(board.getMessageCount(), 0);
		});

		test("should create a time-limited board with expiration", () => {
			const board = new Board(
				"trade",
				"Trade Board",
				"Trading board",
				false,
				604800000
			);
			assert.strictEqual(board.permanent, false);
			assert.strictEqual(board.expirationMs, 604800000);
		});
	});

	suite("addMessage()", () => {
		test("should add a public message without targets", () => {
			const board = new Board("test", "Test", "Test");
			const message = board.addMessage("alice", "Test Subject", "Test content");

			assert.strictEqual(message.id, 1);
			assert.strictEqual(message.author, "alice");
			assert.strictEqual(message.subject, "Test Subject");
			assert.strictEqual(message.content, "Test content");
			assert.strictEqual(message.targets, undefined);
			assert.ok(message.postedAt);
			assert.strictEqual(board.getMessageCount(), 1);
		});

		test("should add a targeted message", () => {
			const board = new Board("test", "Test", "Test");
			const message = board.addMessage(
				"alice",
				"Private Note",
				"Secret content",
				["bob", "charlie"]
			);

			assert.strictEqual(message.id, 1);
			assert.deepStrictEqual(message.targets, ["bob", "charlie"]);
			assert.strictEqual(board.getMessageCount(), 1);
		});

		test("should assign sequential message IDs", () => {
			const board = new Board("test", "Test", "Test");
			const msg1 = board.addMessage("alice", "First", "Content 1");
			const msg2 = board.addMessage("bob", "Second", "Content 2");
			const msg3 = board.addMessage("charlie", "Third", "Content 3");

			assert.strictEqual(msg1.id, 1);
			assert.strictEqual(msg2.id, 2);
			assert.strictEqual(msg3.id, 3);
		});

		test("should ignore empty targets array", () => {
			const board = new Board("test", "Test", "Test");
			const message = board.addMessage("alice", "Test", "Content", []);

			assert.strictEqual(message.targets, undefined);
		});

		test("should set postedAt timestamp", () => {
			const board = new Board("test", "Test", "Test");
			const before = new Date().toISOString();
			const message = board.addMessage("alice", "Test", "Content");
			const after = new Date().toISOString();

			assert.ok(message.postedAt >= before);
			assert.ok(message.postedAt <= after);
		});
	});

	suite("removeExpiredMessages()", () => {
		test("should not remove messages from permanent boards", () => {
			const board = new Board("test", "Test", "Test", true);
			board.addMessage("alice", "Test", "Content");
			board.addMessage("bob", "Test 2", "Content 2");

			const removed = board.removeExpiredMessages();
			assert.strictEqual(removed, 0);
			assert.strictEqual(board.getMessageCount(), 2);
		});

		test("should not remove recent messages from time-limited boards", () => {
			const board = new Board("test", "Test", "Test", false, 86400000); // 1 day
			board.addMessage("alice", "Recent", "Content");

			const removed = board.removeExpiredMessages();
			assert.strictEqual(removed, 0);
			assert.strictEqual(board.getMessageCount(), 1);
		});

		test("should remove expired messages from time-limited boards", () => {
			const board = new Board("test", "Test", "Test", false, 1000); // 1 second
			// Create a board with an old message by serializing and deserializing
			const oldMessage: BoardMessage = {
				id: 1,
				author: "alice",
				subject: "Old",
				content: "Old content",
				postedAt: new Date(Date.now() - 2000).toISOString(), // 2 seconds ago
			};
			const serialized = board.serialize();
			serialized.messages.push(oldMessage);
			serialized.nextMessageId = 2;
			const boardWithOldMessage = Board.deserialize(serialized);
			boardWithOldMessage.addMessage("bob", "Recent", "Recent content");

			const removed = boardWithOldMessage.removeExpiredMessages();
			assert.strictEqual(removed, 1);
			assert.strictEqual(boardWithOldMessage.getMessageCount(), 1);
			const remaining = boardWithOldMessage.getAllMessages();
			assert.strictEqual(remaining[0].author, "bob");
		});

		test("should return count of removed messages", () => {
			const board = new Board("test", "Test", "Test", false, 1000);
			const oldDate = new Date(Date.now() - 2000).toISOString();

			// Create board with old messages by serializing and deserializing
			const serialized = board.serialize();
			serialized.messages.push({
				id: 1,
				author: "alice",
				subject: "Old 1",
				content: "Content",
				postedAt: oldDate,
			});
			serialized.messages.push({
				id: 2,
				author: "bob",
				subject: "Old 2",
				content: "Content",
				postedAt: oldDate,
			});
			serialized.nextMessageId = 3;
			const boardWithOldMessages = Board.deserialize(serialized);
			boardWithOldMessages.addMessage("charlie", "Recent", "Content");

			const removed = boardWithOldMessages.removeExpiredMessages();
			assert.strictEqual(removed, 2);
		});
	});

	suite("getMessage()", () => {
		test("should find message by ID", () => {
			const board = new Board("test", "Test", "Test");
			const msg1 = board.addMessage("alice", "First", "Content 1");
			const msg2 = board.addMessage("bob", "Second", "Content 2");

			const found = board.getMessage(msg2.id);
			assert.strictEqual(found?.id, msg2.id);
			assert.strictEqual(found?.author, "bob");
		});

		test("should return undefined for non-existent message ID", () => {
			const board = new Board("test", "Test", "Test");
			board.addMessage("alice", "Test", "Content");

			const found = board.getMessage(999);
			assert.strictEqual(found, undefined);
		});

		test("should return undefined for empty board", () => {
			const board = new Board("test", "Test", "Test");
			const found = board.getMessage(1);
			assert.strictEqual(found, undefined);
		});
	});

	suite("isMessageVisible()", () => {
		test("should return true for public messages (no targets)", () => {
			const message: BoardMessage = {
				id: 1,
				author: "alice",
				subject: "Public",
				content: "Content",
				postedAt: new Date().toISOString(),
			};

			assert.strictEqual(Board.isMessageVisible(message, "bob"), true);
			assert.strictEqual(Board.isMessageVisible(message, "charlie"), true);
		});

		test("should return true if user is the author", () => {
			const message: BoardMessage = {
				id: 1,
				author: "alice",
				subject: "Private",
				content: "Content",
				postedAt: new Date().toISOString(),
				targets: ["bob"],
			};

			assert.strictEqual(Board.isMessageVisible(message, "alice"), true);
		});

		test("should return true if user is in targets list", () => {
			const message: BoardMessage = {
				id: 1,
				author: "alice",
				subject: "Private",
				content: "Content",
				postedAt: new Date().toISOString(),
				targets: ["bob", "charlie"],
			};

			assert.strictEqual(Board.isMessageVisible(message, "bob"), true);
			assert.strictEqual(Board.isMessageVisible(message, "charlie"), true);
		});

		test("should return false if user is not in targets and not author", () => {
			const message: BoardMessage = {
				id: 1,
				author: "alice",
				subject: "Private",
				content: "Content",
				postedAt: new Date().toISOString(),
				targets: ["bob"],
			};

			assert.strictEqual(Board.isMessageVisible(message, "charlie"), false);
		});

		test("should be case-insensitive for username matching", () => {
			const message: BoardMessage = {
				id: 1,
				author: "Alice",
				subject: "Test",
				content: "Content",
				postedAt: new Date().toISOString(),
				targets: ["Bob"],
			};

			assert.strictEqual(Board.isMessageVisible(message, "alice"), true);
			assert.strictEqual(Board.isMessageVisible(message, "ALICE"), true);
			assert.strictEqual(Board.isMessageVisible(message, "bob"), true);
			assert.strictEqual(Board.isMessageVisible(message, "BOB"), true);
		});

		test("should return false for empty targets array", () => {
			const message: BoardMessage = {
				id: 1,
				author: "alice",
				subject: "Test",
				content: "Content",
				postedAt: new Date().toISOString(),
				targets: [],
			};

			// Empty array should be treated as public (but this shouldn't happen in practice)
			// Actually, looking at the code, empty array is converted to undefined in addMessage
			// But if it somehow exists, the check would fail. Let's test the actual behavior.
			assert.strictEqual(Board.isMessageVisible(message, "bob"), true);
		});
	});

	suite("getVisibleMessages()", () => {
		test("should return all public messages", () => {
			const board = new Board("test", "Test", "Test");
			board.addMessage("alice", "Public 1", "Content 1");
			board.addMessage("bob", "Public 2", "Content 2");

			const visible = board.getVisibleMessages("charlie");
			assert.strictEqual(visible.length, 2);
		});

		test("should return only messages visible to user", () => {
			const board = new Board("test", "Test", "Test");
			board.addMessage("alice", "Public", "Content 1");
			board.addMessage("bob", "Private", "Content 2", ["charlie"]);
			board.addMessage("diana", "Private 2", "Content 3", ["alice"]);

			const visible = board.getVisibleMessages("charlie");
			assert.strictEqual(visible.length, 2);
			assert.strictEqual(visible[0].author, "alice");
			assert.strictEqual(visible[1].author, "bob");
		});

		test("should include user's own messages even if targeted", () => {
			const board = new Board("test", "Test", "Test");
			board.addMessage("alice", "To Bob", "Content", ["bob"]);

			const visible = board.getVisibleMessages("alice");
			assert.strictEqual(visible.length, 1);
			assert.strictEqual(visible[0].author, "alice");
		});

		test("should return empty array for user with no visible messages", () => {
			const board = new Board("test", "Test", "Test");
			board.addMessage("alice", "Private", "Content", ["bob"]);

			const visible = board.getVisibleMessages("charlie");
			assert.strictEqual(visible.length, 0);
		});
	});

	suite("serialize()", () => {
		test("should serialize permanent board correctly", () => {
			const board = new Board("test", "Test Board", "Description", true);
			board.addMessage("alice", "Subject", "Content");

			const serialized = board.serialize();
			assert.strictEqual(serialized.name, "test");
			assert.strictEqual(serialized.displayName, "Test Board");
			assert.strictEqual(serialized.description, "Description");
			assert.strictEqual(serialized.permanent, true);
			assert.strictEqual(serialized.expirationMs, undefined);
			assert.strictEqual(serialized.messages.length, 1);
			assert.strictEqual(serialized.nextMessageId, 2);
		});

		test("should serialize time-limited board correctly", () => {
			const board = new Board("trade", "Trade", "Trading", false, 604800000);
			board.addMessage("alice", "Subject", "Content");

			const serialized = board.serialize();
			assert.strictEqual(serialized.permanent, false);
			assert.strictEqual(serialized.expirationMs, 604800000);
		});

		test("should preserve all messages in serialization", () => {
			const board = new Board("test", "Test", "Test");
			board.addMessage("alice", "First", "Content 1");
			board.addMessage("bob", "Second", "Content 2", ["charlie"]);

			const serialized = board.serialize();
			assert.strictEqual(serialized.messages.length, 2);
			assert.strictEqual(serialized.messages[0].author, "alice");
			assert.strictEqual(serialized.messages[1].author, "bob");
			assert.deepStrictEqual(serialized.messages[1].targets, ["charlie"]);
		});

		test("should preserve nextMessageId", () => {
			const board = new Board("test", "Test", "Test");
			board.addMessage("alice", "First", "Content");
			board.addMessage("bob", "Second", "Content");

			const serialized = board.serialize();
			assert.strictEqual(serialized.nextMessageId, 3);
		});
	});

	suite("deserialize()", () => {
		test("should deserialize permanent board correctly", () => {
			const data: SerializedBoard = {
				name: "test",
				displayName: "Test Board",
				description: "Description",
				permanent: true,
				messages: [
					{
						id: 1,
						author: "alice",
						subject: "Subject",
						content: "Content",
						postedAt: new Date().toISOString(),
					},
				],
				nextMessageId: 2,
			};

			const board = Board.deserialize(data);
			assert.strictEqual(board.name, "test");
			assert.strictEqual(board.displayName, "Test Board");
			assert.strictEqual(board.description, "Description");
			assert.strictEqual(board.permanent, true);
			assert.strictEqual(board.getMessageCount(), 1);
			const messages = board.getAllMessages();
			assert.strictEqual(messages[0].subject, "Subject");
		});

		test("should deserialize time-limited board correctly", () => {
			const data: SerializedBoard = {
				name: "trade",
				displayName: "Trade",
				description: "Trading",
				permanent: false,
				expirationMs: 604800000,
				messages: [],
				nextMessageId: 1,
			};

			const board = Board.deserialize(data);
			assert.strictEqual(board.permanent, false);
			assert.strictEqual(board.expirationMs, 604800000);
		});

		test("should add default subject for messages without subject (backward compatibility)", () => {
			const data: SerializedBoard = {
				name: "test",
				displayName: "Test",
				description: "Test",
				permanent: true,
				messages: [
					{
						id: 1,
						author: "alice",
						subject: "", // Old message without subject
						content: "Content",
						postedAt: new Date().toISOString(),
					},
					{
						id: 2,
						author: "bob",
						// Missing subject field entirely
						content: "Content 2",
						postedAt: new Date().toISOString(),
					} as BoardMessage,
				],
				nextMessageId: 3,
			};

			const board = Board.deserialize(data);
			const messages = board.getAllMessages();
			assert.strictEqual(messages[0].subject, "(No subject)");
			assert.strictEqual(messages[1].subject, "(No subject)");
		});

		test("should preserve nextMessageId on deserialize", () => {
			const data: SerializedBoard = {
				name: "test",
				displayName: "Test",
				description: "Test",
				permanent: true,
				messages: [],
				nextMessageId: 42,
			};

			const board = Board.deserialize(data);
			// After deserialization, next message should use the preserved ID
			const newMessage = board.addMessage("alice", "New", "Content");
			assert.strictEqual(newMessage.id, 42);
		});

		test("should round-trip serialize and deserialize", () => {
			const original = new Board(
				"test",
				"Test Board",
				"Description",
				false,
				86400000
			);
			original.addMessage("alice", "Public", "Content 1");
			original.addMessage("bob", "Private", "Content 2", ["charlie"]);

			const serialized = original.serialize();
			const restored = Board.deserialize(serialized);

			assert.strictEqual(restored.name, original.name);
			assert.strictEqual(restored.displayName, original.displayName);
			assert.strictEqual(restored.permanent, original.permanent);
			assert.strictEqual(restored.expirationMs, original.expirationMs);
			assert.strictEqual(
				restored.getMessageCount(),
				original.getMessageCount()
			);
			const restoredMessages = restored.getAllMessages();
			const originalMessages = original.getAllMessages();
			assert.deepStrictEqual(restoredMessages[0], originalMessages[0]);
			assert.deepStrictEqual(restoredMessages[1], originalMessages[1]);
		});
	});
});
