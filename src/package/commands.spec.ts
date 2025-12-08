import { suite, test, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { writeFile, unlink, mkdir, rm } from "fs/promises";
import archetypePkg from "./archetype.js";
import { join } from "path";
import { existsSync } from "fs";
import commandsPackage, { JavaScriptCommandAdapter } from "./commands.js";
import { CommandRegistry, CommandContext } from "../core/command.js";
import { Dungeon, Mob } from "../core/dungeon.js";
import { createMob } from "./dungeon.js";
import { getDefaultJob, getDefaultRace } from "../registry/archetype.js";

const COMMANDS_DIR = join(process.cwd(), "data", "commands");
function createTestMob(display: string, keywords: string): Mob {
	return createMob({
		display,
		keywords,
		race: getDefaultRace(),
		job: getDefaultJob(),
	});
}
suite("package/commands.ts", () => {
	let initialCommandCount: number;

	before(async () => {
		// Create commands directory if it doesn't exist
		if (!existsSync(COMMANDS_DIR)) {
			await mkdir(COMMANDS_DIR, { recursive: true });
		}
		// Store initial command count
		initialCommandCount = CommandRegistry.default.getCommands().length;
		await archetypePkg.loader();
	});

	beforeEach(() => {
		// Clear all commands from the registry before each test
		const commands = CommandRegistry.default.getCommands();
		commands.forEach((cmd) => CommandRegistry.default.unregister(cmd));
	});

	after(async () => {
		// Clean up any test command files
		const testFiles = [
			"test-cmd.js",
			"test-aliases.js",
			"test-invalid.js",
			"test-error.js",
			"test-partial.js",
			"readme.txt",
		];
		for (const file of testFiles) {
			const filePath = join(COMMANDS_DIR, file);
			if (existsSync(filePath)) {
				try {
					await unlink(filePath);
				} catch (error) {
					// Ignore errors
				}
			}
		}
	});

	suite("JavaScriptCommandAdapter", () => {
		test("should create adapter from command object", () => {
			const commandObj = {
				pattern: "test <arg:word>",
				aliases: ["t"],
				execute() {},
			};

			const adapter = new JavaScriptCommandAdapter(commandObj);
			assert.strictEqual(adapter.pattern, "test <arg:word>");
		});

		test("should execute command function with context and args", () => {
			let executed = false;
			let receivedContext: CommandContext | null = null;
			let receivedArgs: Map<string, any> | null = null;

			const commandObj = {
				pattern: "test",
				execute(context: CommandContext, args: Map<string, any>) {
					executed = true;
					receivedContext = context;
					receivedArgs = args;
				},
			};

			const adapter = new JavaScriptCommandAdapter(commandObj);

			// Create test context
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 1, height: 1, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);
			const context: CommandContext = { actor, room };
			const args = new Map();

			adapter.execute(context, args);

			assert.strictEqual(executed, true);
			assert.strictEqual(receivedContext, context);
			assert.strictEqual(receivedArgs, args);
		});

		test("should call custom onError when provided", () => {
			let errorCalled = false;
			let receivedError: string | null = null;

			const commandObj = {
				pattern: "test",
				execute() {},
				onError(context: CommandContext, result: any) {
					errorCalled = true;
					receivedError = result.error;
				},
			};

			const adapter = new JavaScriptCommandAdapter(commandObj);

			// Create test context
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 1, height: 1, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);
			const context: CommandContext = { actor, room };

			adapter.onError(context, {
				success: false,
				args: new Map(),
				error: "test error",
			});

			assert.strictEqual(errorCalled, true);
			assert.strictEqual(receivedError, "test error");
		});

		test("should use default onError when not provided", () => {
			const commandObj = {
				pattern: "test",
				execute() {},
			};

			const adapter = new JavaScriptCommandAdapter(commandObj);

			// Create test context
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 1, height: 1, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);
			const context: CommandContext = { actor, room };

			assert.doesNotThrow(() => {
				adapter.onError(context, {
					success: false,
					args: new Map(),
					error: "test error",
				});
			});
		});

		test("should handle command with aliases", () => {
			const commandObj = {
				pattern: "test",
				aliases: ["t", "tst"],
				execute() {},
			};

			const adapter = new JavaScriptCommandAdapter(commandObj);
			assert.ok(adapter.pattern);
		});

		test("should handle command with arguments", () => {
			let capturedArg: string | null = null;

			const commandObj = {
				pattern: "test <name:word>",
				execute(context: CommandContext, args: Map<string, any>) {
					capturedArg = args.get("name");
				},
			};

			const adapter = new JavaScriptCommandAdapter(commandObj);

			// Create test context
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 1, height: 1, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);
			const context: CommandContext = { actor, room };

			const args = new Map([["name", "foo"]]);
			adapter.execute(context, args);

			assert.strictEqual(capturedArg, "foo");
		});
	});

	suite("Package Loader", () => {
		test("loader should have correct package name", () => {
			assert.strictEqual(commandsPackage.name, "commands");
		});

		test("should load valid command file", async () => {
			const testCommand = `
export default {
	pattern: "testcmd <arg:word>",
	aliases: ["tc"],
	execute(context, args) {
		// Command logic
	}
};
`;
			const testFile = join(COMMANDS_DIR, "test-cmd.js");
			await writeFile(testFile, testCommand, "utf-8");

			await commandsPackage.loader();

			const commands = CommandRegistry.default.getCommands();
			const testCmd = commands.find(
				(cmd) => cmd.pattern === "testcmd <arg:word>"
			);
			assert.ok(testCmd, "Command should be registered");

			await unlink(testFile);
		});

		test("should load multiple command files", async () => {
			const command1 = `
export default {
	pattern: "cmd1",
	execute() {}
};
`;
			const command2 = `
export default {
	pattern: "cmd2",
	execute() {}
};
`;
			const file1 = join(COMMANDS_DIR, "test-cmd1.js");
			const file2 = join(COMMANDS_DIR, "test-cmd2.js");
			await writeFile(file1, command1, "utf-8");
			await writeFile(file2, command2, "utf-8");

			await commandsPackage.loader();

			const commands = CommandRegistry.default.getCommands();
			const cmd1 = commands.find((cmd) => cmd.pattern === "cmd1");
			const cmd2 = commands.find((cmd) => cmd.pattern === "cmd2");

			assert.ok(cmd1, "Command 1 should be loaded");
			assert.ok(cmd2, "Command 2 should be loaded");

			await unlink(file1);
			await unlink(file2);
		});

		test("should handle command file with syntax error", async () => {
			const badCommand = `
export default {
	pattern: "bad",
	execute() {
		// Syntax error
		const x = ;
	}
};
`;
			const testFile = join(COMMANDS_DIR, "test-error.js");
			await writeFile(testFile, badCommand, "utf-8");

			// Should not throw
			await assert.doesNotReject(async () => {
				await commandsPackage.loader();
			});

			await unlink(testFile);
		});

		test("should load command with only pattern and execute", async () => {
			const minimalCommand = `
export default {
	pattern: "minimal",
	execute() {
		// Minimal command
	}
};
`;
			const testFile = join(COMMANDS_DIR, "test-minimal.js");
			await writeFile(testFile, minimalCommand, "utf-8");

			await commandsPackage.loader();

			const commands = CommandRegistry.default.getCommands();
			const minimal = commands.find((cmd) => cmd.pattern === "minimal");
			assert.ok(minimal, "Minimal command should be loaded");

			await unlink(testFile);
		});

		test("should register commands with aliases", async () => {
			const aliasCommand = `
export default {
	pattern: "longname",
	aliases: ["ln", "long"],
	execute() {}
};
`;
			const testFile = join(COMMANDS_DIR, "test-aliases.js");
			await writeFile(testFile, aliasCommand, "utf-8");

			await commandsPackage.loader();

			const commands = CommandRegistry.default.getCommands();
			const cmd = commands.find((cmd) => cmd.pattern === "longname");
			assert.ok(cmd, "Command with aliases should be loaded");

			await unlink(testFile);
		});
	});
});
