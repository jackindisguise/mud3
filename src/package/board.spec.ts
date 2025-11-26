import { suite, test, before, after } from "node:test";
import assert from "node:assert";
import {
	mkdir,
	writeFile,
	readdir,
	unlink,
	rmdir,
	readFile,
} from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import YAML from "js-yaml";
import { Board } from "../core/board.js";
import boardPkg, {
	saveBoard,
	loadBoard,
	boardExists,
	getAllBoardNames,
	loadBoards,
} from "./board.js";
import { getBoard, getBoards, registerBoard } from "../registry/board.js";

const DATA_DIR = join(process.cwd(), "data");
const BOARDS_DIR = join(DATA_DIR, "boards");

suite("package/board.ts", () => {
	before(async () => {
		// Create boards directory if it doesn't exist
		if (!existsSync(BOARDS_DIR)) {
			await mkdir(BOARDS_DIR, { recursive: true });
		}
	});

	after(async () => {
		// Clean up test files
		if (existsSync(BOARDS_DIR)) {
			const files = await readdir(BOARDS_DIR);
			for (const file of files) {
				if (file.startsWith("test_")) {
					await unlink(join(BOARDS_DIR, file));
				}
			}
		}
	});

	suite("saveBoard", () => {
		test("should save board to disk", async () => {
			const board = new Board("test_board", "Test Board", "A test board", true);
			board.createMessage("alice", "Test Subject", "Test content");

			await saveBoard(board);

			// Verify files were created
			const configPath = join(BOARDS_DIR, "test_board.yaml");
			const messagesPath = join(BOARDS_DIR, "test_board.messages.yaml");
			assert.ok(existsSync(configPath));
			assert.ok(existsSync(messagesPath));

			// Clean up
			if (existsSync(configPath)) await unlink(configPath);
			if (existsSync(messagesPath)) await unlink(messagesPath);
		});

		test("should save board with messages", async () => {
			const board = new Board("test_messages", "Test", "Test", true);
			board.createMessage("alice", "First", "Content 1");
			board.createMessage("bob", "Second", "Content 2", ["charlie"]);

			await saveBoard(board);

			const messagesPath = join(BOARDS_DIR, "test_messages.messages.yaml");
			assert.ok(existsSync(messagesPath));

			// Verify messages were saved
			const content = await readFile(messagesPath, "utf-8");
			const parsed = YAML.load(content) as any;
			assert.strictEqual(parsed.messages.length, 2);

			// Clean up
			if (existsSync(join(BOARDS_DIR, "test_messages.yaml")))
				await unlink(join(BOARDS_DIR, "test_messages.yaml"));
			if (existsSync(messagesPath)) await unlink(messagesPath);
		});
	});

	suite("loadBoard", () => {
		test("should load board from disk", async () => {
			// Create a board and save it
			const original = new Board("test_load", "Test Load", "Test", true);
			original.createMessage("alice", "Subject", "Content");
			await saveBoard(original);

			// Load it back
			const loaded = await loadBoard("test_load");

			assert.ok(loaded);
			assert.strictEqual(loaded.name, "test_load");
			assert.strictEqual(loaded.displayName, "Test Load");
			assert.strictEqual(loaded.getMessageCount(), 1);

			// Clean up
			if (existsSync(join(BOARDS_DIR, "test_load.yaml")))
				await unlink(join(BOARDS_DIR, "test_load.yaml"));
			if (existsSync(join(BOARDS_DIR, "test_load.messages.yaml")))
				await unlink(join(BOARDS_DIR, "test_load.messages.yaml"));
		});

		test("should return undefined for non-existent board", async () => {
			const loaded = await loadBoard("nonexistent_board");
			assert.strictEqual(loaded, undefined);
		});

		test("should load board without messages file", async () => {
			// Create config file only
			const config = {
				name: "test_no_messages",
				displayName: "Test No Messages",
				description: "Test",
				permanent: true,
			};
			await writeFile(
				join(BOARDS_DIR, "test_no_messages.yaml"),
				YAML.dump(config),
				"utf-8"
			);

			const loaded = await loadBoard("test_no_messages");

			assert.ok(loaded);
			assert.strictEqual(loaded.name, "test_no_messages");
			assert.strictEqual(loaded.getMessageCount(), 0);

			// Clean up
			if (existsSync(join(BOARDS_DIR, "test_no_messages.yaml")))
				await unlink(join(BOARDS_DIR, "test_no_messages.yaml"));
		});
	});

	suite("getBoard", () => {
		test("should return board from registry", async () => {
			const board = new Board("test_registry", "Test", "Test", true);
			await saveBoard(board);
			registerBoard(board);

			const retrieved = getBoard("test_registry");
			assert.ok(retrieved);
			assert.strictEqual(retrieved.name, "test_registry");

			// Clean up
			if (existsSync(join(BOARDS_DIR, "test_registry.yaml")))
				await unlink(join(BOARDS_DIR, "test_registry.yaml"));
			if (existsSync(join(BOARDS_DIR, "test_registry.messages.yaml")))
				await unlink(join(BOARDS_DIR, "test_registry.messages.yaml"));
		});

		test("should return undefined for non-existent board", () => {
			const board = getBoard("nonexistent");
			assert.strictEqual(board, undefined);
		});
	});

	suite("getBoards", () => {
		test("should return array of all boards in registry", () => {
			const boards = getBoards();
			assert.ok(Array.isArray(boards));
		});
	});

	suite("boardExists", () => {
		test("should return true for existing board", async () => {
			const board = new Board("test_exists", "Test", "Test", true);
			await saveBoard(board);

			const exists = await boardExists("test_exists");
			assert.strictEqual(exists, true);

			// Clean up
			if (existsSync(join(BOARDS_DIR, "test_exists.yaml")))
				await unlink(join(BOARDS_DIR, "test_exists.yaml"));
			if (existsSync(join(BOARDS_DIR, "test_exists.messages.yaml")))
				await unlink(join(BOARDS_DIR, "test_exists.messages.yaml"));
		});

		test("should return false for non-existent board", async () => {
			const exists = await boardExists("nonexistent_board");
			assert.strictEqual(exists, false);
		});
	});

	suite("getAllBoardNames", () => {
		test("should return all board names from disk", async () => {
			// Create a test board
			const board = new Board("test_names", "Test", "Test", true);
			await saveBoard(board);

			const names = await getAllBoardNames();
			assert.ok(Array.isArray(names));
			assert.ok(names.includes("test_names"));

			// Clean up
			if (existsSync(join(BOARDS_DIR, "test_names.yaml")))
				await unlink(join(BOARDS_DIR, "test_names.yaml"));
			if (existsSync(join(BOARDS_DIR, "test_names.messages.yaml")))
				await unlink(join(BOARDS_DIR, "test_names.messages.yaml"));
		});
	});

	suite("loadBoards", () => {
		test("should load all boards from disk", async () => {
			// Create test boards
			const board1 = new Board("test_load_all_1", "Test 1", "Test", true);
			board1.createMessage("alice", "Subject 1", "Content 1");
			await saveBoard(board1);

			const board2 = new Board("test_load_all_2", "Test 2", "Test", true);
			board2.createMessage("bob", "Subject 2", "Content 2");
			await saveBoard(board2);

			const boards = await loadBoards();

			assert.ok(Array.isArray(boards));
			const names = boards.map((b) => b.name);
			assert.ok(names.includes("test_load_all_1"));
			assert.ok(names.includes("test_load_all_2"));

			// Clean up
			for (const name of ["test_load_all_1", "test_load_all_2"]) {
				if (existsSync(join(BOARDS_DIR, `${name}.yaml`)))
					await unlink(join(BOARDS_DIR, `${name}.yaml`));
				if (existsSync(join(BOARDS_DIR, `${name}.messages.yaml`)))
					await unlink(join(BOARDS_DIR, `${name}.messages.yaml`));
			}
		});
	});

	suite("package loader", () => {
		test("should load all boards on package load", async () => {
			// Create a test board
			const board = new Board("test_loader", "Test", "Test", true);
			board.createMessage("alice", "Subject", "Content");
			await saveBoard(board);

			// Load the package
			await boardPkg.loader();

			// Verify board was loaded
			const loaded = getBoard("test_loader");
			assert.ok(loaded);
			assert.strictEqual(loaded.getMessageCount(), 1);

			// Clean up
			if (existsSync(join(BOARDS_DIR, "test_loader.yaml")))
				await unlink(join(BOARDS_DIR, "test_loader.yaml"));
			if (existsSync(join(BOARDS_DIR, "test_loader.messages.yaml")))
				await unlink(join(BOARDS_DIR, "test_loader.messages.yaml"));
		});
	});

	suite("sanitizeBoardName", () => {
		test("should handle special characters in board names", async () => {
			// Board names with special characters should be sanitized
			const board = new Board("test-special_chars", "Test", "Test", true);
			await saveBoard(board);

			// Should be able to load using sanitized name
			const loaded = await loadBoard("test-special_chars");
			assert.ok(loaded);

			// Clean up
			if (existsSync(join(BOARDS_DIR, "test-special_chars.yaml")))
				await unlink(join(BOARDS_DIR, "test-special_chars.yaml"));
			if (existsSync(join(BOARDS_DIR, "test-special_chars.messages.yaml")))
				await unlink(join(BOARDS_DIR, "test-special_chars.messages.yaml"));
		});
	});
});
