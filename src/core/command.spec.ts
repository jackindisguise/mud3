import { suite, test, before } from "node:test";
import assert from "node:assert";
import {
	Command,
	CommandContext,
	CommandRegistry,
	ParseResult,
	PRIORITY,
} from "./command.js";
import { JavaScriptCommandAdapter } from "../package/commands.js";
import { createMob } from "../package/dungeon.js";
import archetypePkg from "../package/archetype.js";
import { Dungeon, DungeonObject, Room } from "../core/dungeon.js";
import { Mob } from "../core/dungeon.js";
import { Character } from "../core/character.js";
import cancelCommand from "../commands/cancel.js";
import queueCommand from "../commands/queue.js";
import {
	registerCommand,
	unregisterCommand,
	executeCommand,
	getCommands,
} from "../registry/command.js";
import { getDefaultJob, getDefaultRace } from "../registry/archetype.js";

let nextTestCharacterId = 1;
function createTestMob(display: string, keywords: string): Mob {
	return createMob({
		display,
		keywords,
		race: getDefaultRace(),
		job: getDefaultJob(),
	});
}
const attachCharacterToMob = (mob: Mob, username = "tester") =>
	new Character({
		credentials: {
			username: `${username}-${nextTestCharacterId}`,
			characterId: nextTestCharacterId++,
		},
		mob,
	});

suite("command.ts", () => {
	before(async () => {
		await archetypePkg.loader();
	});

	suite("Command", () => {
		test("should parse simple text command", () => {
			let executed = false;
			let capturedMessage = "";

			const command = new JavaScriptCommandAdapter({
				pattern: "ooc <message:text>",
				execute(context: CommandContext, args: Map<string, any>) {
					executed = true;
					capturedMessage = args.get("message");
				},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);

			const context: CommandContext = { actor, room };
			const result = command.parse("ooc Hello, world!", context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("message"), "Hello, world!");

			command.execute(context, result.args);
			assert.strictEqual(executed, true);
			assert.strictEqual(capturedMessage, "Hello, world!");
		});

		test("should parse command with word argument", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "look <direction:word?>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result1 = command.parse("look north", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("direction"), "north");

			const result2 = command.parse("look", context);
			assert.strictEqual(result2.success, true);
		});

		test("should allow quoted phrases for word arguments", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "look <direction:word>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const doubleQuoted = command.parse('look "north east"', context);
			assert.strictEqual(doubleQuoted.success, true);
			assert.strictEqual(doubleQuoted.args.get("direction"), "north east");

			const singleQuoted = command.parse("look 'south west'", context);
			assert.strictEqual(singleQuoted.success, true);
			assert.strictEqual(singleQuoted.args.get("direction"), "south west");
		});

		test("should parse command with number argument", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "drop <amount:number> <item:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("drop 5 gold coins", context);
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("amount"), 5);
			assert.strictEqual(result.args.get("item"), "gold coins");
		});

		test("should parse command with object from room", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "get <item:object@room>",
				execute() {},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			const sword = new DungeonObject({ keywords: "steel sword" });
			room?.add(actor);
			room?.add(sword);
			const context: CommandContext = { actor, room };
			const result = command.parse("get sword", context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("item"), sword);
		});

		test("should parse command with object from inventory", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "drop <item:object@inventory>",
				execute() {},
			});

			const actor = createTestMob("Player", "player");
			const sword = new DungeonObject({ keywords: "steel sword" });
			actor.add(sword);
			const context: CommandContext = { actor };
			const result = command.parse("drop sword", context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("item"), sword);
		});

		test("should parse complex command with multiple objects", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "put <item:object> in <container:object>",
				execute() {},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			const coin = new DungeonObject({ keywords: "gold coin" });
			const bag = new DungeonObject({ keywords: "leather bag" });

			room?.add(actor);
			actor.add(coin);
			room?.add(bag);
			const context: CommandContext = { actor, room };
			const result = command.parse("put coin in bag", context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("item"), coin);
			assert.strictEqual(result.args.get("container"), bag);
		});

		test("should support command aliases", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "tell <player:mob> <message:text>",
				aliases: ["whisper <player:mob> <message:text>"],
				execute() {},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			const target = createTestMob("Bob", "bob");
			room?.add(actor);
			room?.add(target);
			const context: CommandContext = { actor, room };

			const result1 = command.parse("tell bob hello", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("player"), target);

			const result2 = command.parse("whisper bob hello", context);
			assert.strictEqual(result2.success, true);
			assert.strictEqual(result2.args.get("player"), target);
		});

		test("should fail when required argument is missing", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "say <message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("say", context);
			assert.strictEqual(result.success, false);
			assert(result.error?.includes("Missing required argument"));
		});

		test("should fail when object is not found", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "get <item:object>",
				execute() {},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);
			const context: CommandContext = { actor, room };
			const result = command.parse("get sword", context);

			assert.strictEqual(result.success, false);
			assert(result.error?.includes("Could not parse argument"));
		});

		test("should call onError when parsing fails", () => {
			let errorCalled = false;
			let errorMessage = "";

			const command = new JavaScriptCommandAdapter({
				pattern: "say <message:text>",
				execute() {},
				onError(context: CommandContext, result: ParseResult) {
					errorCalled = true;
					errorMessage = result.error!;
				},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("say", context);
			assert.strictEqual(result.success, false);

			// Simulate what CommandRegistry does
			if (
				!result.success &&
				result.error &&
				result.error !== "Input does not match pattern"
			) {
				command.onError?.(context, result);
			}

			assert.strictEqual(errorCalled, true);
			assert(errorMessage.includes("Missing required argument"));
		});

		test("should support autocomplete with ~ suffix", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "ooc~ <message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			// Test single character autocomplete
			const result1 = command.parse("o hello world", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("message"), "hello world");

			// Test two character autocomplete
			const result2 = command.parse("oo testing autocomplete", context);
			assert.strictEqual(result2.success, true);
			assert.strictEqual(result2.args.get("message"), "testing autocomplete");

			// Test full word
			const result3 = command.parse("ooc full command", context);
			assert.strictEqual(result3.success, true);
			assert.strictEqual(result3.args.get("message"), "full command");
		});

		test("should not match invalid autocomplete prefixes", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "ooc~ <message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			// Test non-matching prefix
			const result1 = command.parse("x hello", context);
			assert.strictEqual(result1.success, false);

			// Test completely different word
			const result2 = command.parse("say hello", context);
			assert.strictEqual(result2.success, false);
		});

		test("should support multiple words with autocomplete", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "tell~ <target:word> <message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			// Test single character autocomplete
			const result1 = command.parse("t bob hello there", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("target"), "bob");
			assert.strictEqual(result1.args.get("message"), "hello there");

			// Test partial word
			const result2 = command.parse("tel alice greetings", context);
			assert.strictEqual(result2.success, true);
			assert.strictEqual(result2.args.get("target"), "alice");
			assert.strictEqual(result2.args.get("message"), "greetings");

			// Test full word
			const result3 = command.parse("tell charlie hey", context);
			assert.strictEqual(result3.success, true);
			assert.strictEqual(result3.args.get("target"), "charlie");
			assert.strictEqual(result3.args.get("message"), "hey");
		});

		test("should require space when pattern has space before argument", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "say <message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			// Should match with space
			const result1 = command.parse("say hello world", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("message"), "hello world");

			// Should fail without space (pattern requires space)
			const result2 = command.parse("sayhello", context);
			assert.strictEqual(result2.success, false);
		});

		test("should not require space when pattern has no space before argument", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "'<message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			// Should match without space
			const result1 = command.parse("'hello world", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("message"), "hello world");

			// Should also match with space (space becomes part of the message)
			const result2 = command.parse("' hello world", context);
			assert.strictEqual(result2.success, true);
			assert.strictEqual(result2.args.get("message"), "hello world");
		});

		test("should work with autocomplete and optional arguments", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "look~ <direction:word?>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			// Test with optional argument provided
			const result1 = command.parse("l north", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("direction"), "north");

			// Test without optional argument
			const result2 = command.parse("loo", context);
			assert.strictEqual(result2.success, true);
			assert.strictEqual(result2.args.has("direction"), false);

			// Test full word without optional argument
			const result3 = command.parse("look", context);
			assert.strictEqual(result3.success, true);
			assert.strictEqual(result3.args.has("direction"), false);
		});

		test("should support case-insensitive autocomplete", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "ooc~ <message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			// Test uppercase input
			const result1 = command.parse("O hello", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("message"), "hello");

			// Test mixed case
			const result2 = command.parse("Oo test", context);
			assert.strictEqual(result2.success, true);
			assert.strictEqual(result2.args.get("message"), "test");

			// Test all uppercase
			const result3 = command.parse("OOC message", context);
			assert.strictEqual(result3.success, true);
			assert.strictEqual(result3.args.get("message"), "message");
		});
	});

	suite("CommandRegistry", () => {
		test("should register and execute commands", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.default.getCommands();
			existingCommands.forEach((cmd) =>
				CommandRegistry.default.unregister(cmd)
			);

			let executed = false;

			const command = new JavaScriptCommandAdapter({
				pattern: "test <message:text>",
				execute(context: CommandContext, args: Map<string, any>) {
					executed = true;
				},
			});

			CommandRegistry.default.register(command);

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = CommandRegistry.default.execute("test hello", context);
			assert.strictEqual(result, true);
			assert.strictEqual(executed, true);

			// Clean up
			CommandRegistry.default.unregister(command);
		});

		test("should return false when no command matches", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.default.getCommands();
			existingCommands.forEach((cmd) =>
				CommandRegistry.default.unregister(cmd)
			);

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = CommandRegistry.default.execute(
				"unknown command",
				context
			);
			assert.strictEqual(result, false);
		});

		test("should call onError when command pattern matches but parsing fails", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.default.getCommands();
			existingCommands.forEach((cmd) =>
				CommandRegistry.default.unregister(cmd)
			);

			let errorCalled = false;
			let executeCalled = false;

			const command = new JavaScriptCommandAdapter({
				pattern: "say <message:text>",
				execute() {
					executeCalled = true;
				},
				onError() {
					errorCalled = true;
				},
			});

			CommandRegistry.default.register(command);

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = CommandRegistry.default.execute("say", context);
			assert.strictEqual(result, true); // Command matched
			assert.strictEqual(errorCalled, true); // onError was called
			assert.strictEqual(executeCalled, false); // execute was NOT called

			// Clean up
			CommandRegistry.default.unregister(command);
		});

		test("should try commands in order until one matches", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.default.getCommands();
			existingCommands.forEach((cmd) =>
				CommandRegistry.default.unregister(cmd)
			);

			let executed1 = false;
			let executed2 = false;

			const cmd1 = new JavaScriptCommandAdapter({
				pattern: "cmd1 <arg:text>",
				execute() {
					executed1 = true;
				},
			});

			const cmd2 = new JavaScriptCommandAdapter({
				pattern: "cmd2 <arg:text>",
				execute() {
					executed2 = true;
				},
			});

			CommandRegistry.default.register(cmd1);
			CommandRegistry.default.register(cmd2);

			const actor = createMob();
			const context: CommandContext = { actor };

			CommandRegistry.default.execute("cmd2 test", context);
			assert.strictEqual(executed1, false);
			assert.strictEqual(executed2, true);

			// Clean up
			CommandRegistry.default.unregister(cmd1);
			CommandRegistry.default.unregister(cmd2);
		});

		test("should unregister commands", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.default.getCommands();
			existingCommands.forEach((cmd) =>
				CommandRegistry.default.unregister(cmd)
			);

			const command = new JavaScriptCommandAdapter({
				pattern: "test",
				execute() {},
			});

			CommandRegistry.default.register(command);
			assert.strictEqual(CommandRegistry.default.getCommands().length, 1);

			CommandRegistry.default.unregister(command);
			assert.strictEqual(CommandRegistry.default.getCommands().length, 0);
		});

		test("should prioritize commands correctly: HIGH > NORMAL > LOW", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.default.getCommands();
			existingCommands.forEach((cmd) =>
				CommandRegistry.default.unregister(cmd)
			);

			let highExecuted = false;
			let normalExecuted = false;
			let lowExecuted = false;

			// Commands with different priorities, all can match "test"
			const highCommand = new JavaScriptCommandAdapter({
				pattern: "test~",
				priority: PRIORITY.HIGH,
				execute() {
					highExecuted = true;
				},
			});

			const normalCommand = new JavaScriptCommandAdapter({
				pattern: "test~ <arg:text>",
				priority: PRIORITY.NORMAL,
				execute() {
					normalExecuted = true;
				},
			});

			const lowCommand = new JavaScriptCommandAdapter({
				pattern: "test~ <arg:text>",
				priority: PRIORITY.LOW,
				execute() {
					lowExecuted = true;
				},
			});

			// Register in reverse priority order to ensure sorting works
			CommandRegistry.default.register(lowCommand);
			CommandRegistry.default.register(normalCommand);
			CommandRegistry.default.register(highCommand);

			const actor = createMob();
			const context: CommandContext = { actor };

			// "test" should match HIGH priority first (even though it was registered last)
			const result1 = CommandRegistry.default.execute("test", context);
			assert.strictEqual(result1, true);
			assert.strictEqual(highExecuted, true);
			assert.strictEqual(normalExecuted, false);
			assert.strictEqual(lowExecuted, false);

			// Reset and test NORMAL > LOW (remove HIGH command)
			highExecuted = false;
			normalExecuted = false;
			lowExecuted = false;
			CommandRegistry.default.unregister(highCommand);

			// "test hello" should match NORMAL priority over LOW
			const result2 = CommandRegistry.default.execute("test hello", context);
			assert.strictEqual(result2, true);
			assert.strictEqual(normalExecuted, true);
			assert.strictEqual(lowExecuted, false);

			// Clean up
			CommandRegistry.default.unregister(normalCommand);
			CommandRegistry.default.unregister(lowCommand);
		});

		test("should sort by pattern length when priorities are equal", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.default.getCommands();
			existingCommands.forEach((cmd) =>
				CommandRegistry.default.unregister(cmd)
			);

			let longExecuted = false;
			let shortExecuted = false;

			// Both commands have NORMAL priority (default)
			// Use patterns where both can match the same input
			// Use word arguments since text arguments are greedy and should be last
			const longCommand = new JavaScriptCommandAdapter({
				pattern: "test~ <arg1:word> <arg2:word> <arg3:text>",
				execute() {
					longExecuted = true;
				},
			});

			const shortCommand = new JavaScriptCommandAdapter({
				pattern: "test~ <arg:text>",
				execute() {
					shortExecuted = true;
				},
			});

			// Register short first, then long
			CommandRegistry.default.register(shortCommand);
			CommandRegistry.default.register(longCommand);

			const actor = createMob();
			const context: CommandContext = { actor };

			// "test hello world more" should match "test~ <arg1:word> <arg2:word> <arg3:text>" (longer pattern) first
			// Even though short was registered first, long has longer pattern so it's sorted first
			const result = CommandRegistry.default.execute(
				"test hello world more text",
				context
			);
			assert.strictEqual(result, true);
			assert.strictEqual(longExecuted, true);
			assert.strictEqual(shortExecuted, false);

			// Clean up
			CommandRegistry.default.unregister(longCommand);
			CommandRegistry.default.unregister(shortCommand);
		});

		test("should handle commands with same priority and same pattern length", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.default.getCommands();
			existingCommands.forEach((cmd) =>
				CommandRegistry.default.unregister(cmd)
			);

			let cmd1Executed = false;
			let cmd2Executed = false;

			// Both commands have same priority and same pattern length
			const cmd1 = new JavaScriptCommandAdapter({
				pattern: "test <arg1:text>",
				priority: PRIORITY.NORMAL,
				execute() {
					cmd1Executed = true;
				},
			});

			const cmd2 = new JavaScriptCommandAdapter({
				pattern: "test <arg2:text>",
				priority: PRIORITY.NORMAL,
				execute() {
					cmd2Executed = true;
				},
			});

			// Register cmd1 first, then cmd2
			// When priority and length are equal, sort is stable (preserves order)
			// So cmd1 (registered first) should be tried first
			CommandRegistry.default.register(cmd1);
			CommandRegistry.default.register(cmd2);

			const actor = createMob();
			const context: CommandContext = { actor };

			// Both have same priority and length, so order is preserved
			// cmd1 (registered first) should be tried first
			const result = CommandRegistry.default.execute("test hello", context);
			assert.strictEqual(result, true);
			assert.strictEqual(cmd1Executed, true);
			assert.strictEqual(cmd2Executed, false);

			// Clean up
			CommandRegistry.default.unregister(cmd1);
			CommandRegistry.default.unregister(cmd2);
		});

		test("queues action commands during cooldown", async () => {
			const registry = new CommandRegistry();
			const executions: number[] = [];

			class ActionCommand extends Command {
				constructor() {
					super({ pattern: "work" });
				}
				execute(): void {
					executions.push(Date.now());
				}
				getActionCooldownMs(): number {
					return 30;
				}
			}

			const command = new ActionCommand();
			registerCommand(command);

			const actor = createMob();
			const character = attachCharacterToMob(actor, "worker");
			assert.ok(character === actor.character);
			const context: CommandContext = { actor };

			const first = executeCommand("work", context);
			const second = executeCommand("work", context);

			assert.strictEqual(first, true);
			assert.strictEqual(second, true);
			assert.strictEqual(executions.length, 1);

			await new Promise((resolve) => setTimeout(() => resolve(undefined), 70));
			assert.strictEqual(executions.length, 2);

			// Allow the final cooldown timer to finish before ending the test
			await new Promise((resolve) => setTimeout(resolve, 40));
			unregisterCommand(command);
		});

		test("queued action commands rebuild context from the actor", async () => {
			const registry = new CommandRegistry();
			const seenRooms: Array<Room | undefined> = [];

			class TrackingCommand extends Command {
				constructor() {
					super({ pattern: "gather" });
				}
				execute(context: CommandContext): void {
					seenRooms.push(context.room);
				}
				getActionCooldownMs(): number {
					return 25;
				}
			}

			const command = new TrackingCommand();
			registerCommand(command);

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 1, layers: 1 },
			});
			const roomA = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;
			const roomB = dungeon.getRoom({ x: 1, y: 0, z: 0 })!;
			const actor = createMob();
			const character = attachCharacterToMob(actor, "gatherer");
			assert.ok(character === actor.character);
			roomA.add(actor);

			const contextA: CommandContext = { actor, room: roomA };
			const contextB: CommandContext = { actor, room: roomB };

			assert.strictEqual(executeCommand("gather", contextA), true);
			roomB.add(actor);
			assert.strictEqual(executeCommand("gather", contextB), true);

			await new Promise((resolve) => setTimeout(resolve, 70));

			assert.strictEqual(seenRooms.length, 2);
			assert.strictEqual(seenRooms[0], roomA);
			assert.strictEqual(seenRooms[1], roomB);

			await new Promise((resolve) => setTimeout(resolve, 40));
			unregisterCommand(command);
		});

		test("cancel removes the next queued action", () => {
			const registry = new CommandRegistry();
			class WorkCommand extends Command {
				constructor() {
					super({ pattern: "work" });
				}
				execute(): void {
					// no-op
				}
				getActionCooldownMs(): number {
					return 40;
				}
			}

			const work = new WorkCommand();
			const cancelAdapter = new JavaScriptCommandAdapter(cancelCommand);
			registerCommand(work);
			registerCommand(cancelAdapter);

			const actor = createMob();
			const character = attachCharacterToMob(actor, "canceler");
			assert.ok(character === actor.character);
			const context: CommandContext = { actor };

			assert.strictEqual(executeCommand("work", context), true);
			assert.strictEqual(executeCommand("work", context), true);

			const state = character.actionState;
			assert.ok(state);
			assert.strictEqual(state.queue.length, 1);

			assert.strictEqual(executeCommand("cancel", context), true);
			assert.strictEqual(state.queue.length, 0);

			unregisterCommand(work);
			unregisterCommand(cancelAdapter);
		});

		test("cancel all removes every queued action", () => {
			const registry = new CommandRegistry();
			class WorkCommand extends Command {
				constructor() {
					super({ pattern: "work" });
				}
				execute(): void {
					// no-op
				}
				getActionCooldownMs(): number {
					return 35;
				}
			}

			const work = new WorkCommand();
			const cancelAdapter = new JavaScriptCommandAdapter(cancelCommand);
			registerCommand(work);
			registerCommand(cancelAdapter);

			const actor = createMob();
			const character = attachCharacterToMob(actor, "canceler-all");
			assert.ok(character === actor.character);
			const context: CommandContext = { actor };

			assert.strictEqual(executeCommand("work", context), true);
			assert.strictEqual(executeCommand("work", context), true);
			assert.strictEqual(executeCommand("work", context), true);

			const state = character.actionState;
			assert.ok(state);
			assert.strictEqual(state.queue.length, 2);

			assert.strictEqual(executeCommand("cancel all", context), true);
			assert.strictEqual(state.queue.length, 0);

			unregisterCommand(work);
			unregisterCommand(cancelAdapter);
		});

		test("queue command lists queued raw inputs", () => {
			const registry = new CommandRegistry();
			class TaskCommand extends Command {
				constructor() {
					super({ pattern: "task <item:text>" });
				}
				execute(): void {
					// no-op
				}
				getActionCooldownMs(): number {
					return 40;
				}
			}

			const task = new TaskCommand();
			const queueAdapter = new JavaScriptCommandAdapter(queueCommand);
			registerCommand(task);
			registerCommand(queueAdapter);

			const actor = createMob();
			const character = attachCharacterToMob(actor, "queue-test");
			assert.ok(character === actor.character);
			const captured: string[] = [];
			const originalSendMessage = actor.sendMessage.bind(actor);
			actor.sendMessage = ((text: string) => {
				captured.push(text);
			}) as typeof actor.sendMessage;

			const context: CommandContext = { actor };

			assert.strictEqual(executeCommand("task mining", context), true);
			assert.strictEqual(executeCommand("task smithing", context), true);

			// Drop previous "Action queued" message
			captured.length = 0;
			assert.strictEqual(executeCommand("queue", context), true);

			assert.ok(
				captured.some((line) => line.includes("Queued actions (1):")),
				`Expected queue header message, got: ${captured.join(" | ")}`
			);
			assert.ok(
				captured.some((line) => line.includes("task smithing")),
				`Expected raw input line, got: ${captured.join(" | ")}`
			);

			actor.sendMessage = originalSendMessage;
			unregisterCommand(task);
			unregisterCommand(queueAdapter);
		});
	});

	suite("Example Commands", () => {
		test("OOC command example", () => {
			let lastMessage = "";

			const command = new JavaScriptCommandAdapter({
				pattern: "ooc <message:text>",
				execute(context: CommandContext, args: Map<string, any>) {
					lastMessage = `[OOC] ${context.actor.display}: ${args.get(
						"message"
					)}`;
				},
			});

			const actor = createTestMob("Player", "player");
			const context: CommandContext = { actor };

			const result = command.parse("ooc Hello everyone!", context);
			assert.strictEqual(result.success, true);

			command.execute(context, result.args);
			assert.strictEqual(lastMessage, "[OOC] Player: Hello everyone!");
		});

		test("Get command example", () => {
			let pickedUp: DungeonObject | undefined;

			const getCommand = new JavaScriptCommandAdapter({
				pattern: "get <item:object@room>",
				execute(context: CommandContext, args: Map<string, any>) {
					const item = args.get("item") as DungeonObject;
					pickedUp = item;
					context.actor.add(item);
				},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			const sword = new DungeonObject({ keywords: "steel sword" });

			room?.add(actor);
			room?.add(sword);

			const context: CommandContext = { actor, room };
			const result = getCommand.parse("get sword", context);

			assert.strictEqual(result.success, true);
			getCommand.execute(context, result.args);

			assert.strictEqual(pickedUp, sword);
			assert.strictEqual(sword.location, actor);
		});

		test("Get from container command example", () => {
			const getFromCommand = new JavaScriptCommandAdapter({
				pattern: "get <item:object@container> from <container:object>",
				execute(context: CommandContext, args: Map<string, any>) {
					const item = args.get("item") as DungeonObject;
					context.actor.add(item);
				},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createMob();
			const chest = new DungeonObject({ keywords: "wooden chest" });
			const coin = new DungeonObject({ keywords: "gold coin" });

			room?.add(actor);
			room?.add(chest);
			chest.add(coin);

			const context: CommandContext = { actor, room };
			const result = getFromCommand.parse("get coin from chest", context);

			assert.strictEqual(result.success, true);
			getFromCommand.execute(context, result.args);

			assert.strictEqual(coin.location, actor);
			assert(!chest.contains(coin));
		});

		test("Kill command example", () => {
			let attacked: DungeonObject | undefined;

			const killCommand = new JavaScriptCommandAdapter({
				pattern: "kill <target:object@room>",
				execute(context: CommandContext, args: Map<string, any>) {
					attacked = args.get("target") as DungeonObject;
				},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createMob();
			const goblin = new DungeonObject({ keywords: "goblin monster" });

			room?.add(actor);
			room?.add(goblin);

			const context: CommandContext = { actor, room };
			const result = killCommand.parse("kill goblin", context);

			assert.strictEqual(result.success, true);
			killCommand.execute(context, result.args);
			assert.strictEqual(attacked, goblin);
		});
	});

	suite("Error Message Patterns", () => {
		test('should return "Missing required argument" when required argument is empty', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "say <message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("say", context);
			assert.strictEqual(result.success, false);
			assert.strictEqual(result.error, "Missing required argument: message");
		});

		test('should return "Missing required argument" when required word argument is missing', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "greet <name:word>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("greet", context);
			assert.strictEqual(result.success, false);
			assert.strictEqual(result.error, "Missing required argument: name");
		});

		test('should return "Input does not match command pattern" when number contains non-digits', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "give <amount:number>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("give notanumber", context);
			assert.strictEqual(result.success, false);
			// Non-digit input doesn't match the \d+ regex pattern for numbers
			assert.strictEqual(result.error, "Input does not match command pattern");
		});

		test('should return "Could not parse argument" when object is not found', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "get <item:object>",
				execute() {},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);

			const context: CommandContext = { actor, room };
			const result = command.parse("get sword", context);

			assert.strictEqual(result.success, false);
			assert.strictEqual(result.error, "Could not parse argument: item");
		});

		test('should return "Could not parse argument" when mob is not found', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "tell <target:mob> <message:text>",
				execute() {},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);

			const context: CommandContext = { actor, room };
			const result = command.parse("tell bob hi", context);

			assert.strictEqual(result.success, false);
			assert.strictEqual(result.error, "Could not parse argument: target");
		});

		test('should return "Could not parse argument" when item is not found', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "drop <item:item>",
				execute() {},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);

			const context: CommandContext = { actor, room };
			const result = command.parse("drop sword", context);

			assert.strictEqual(result.success, false);
			assert.strictEqual(result.error, "Could not parse argument: item");
		});

		test('should return "Could not parse argument: X" when direction is invalid', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "go <dir:direction>",
				execute() {},
			});

			const actor = createTestMob("Player", "player");
			const context: CommandContext = { actor };

			const result = command.parse("go sideways", context);
			assert.strictEqual(result.success, false);
			assert.strictEqual(result.error, "Could not parse argument: dir");
		});

		test("should succeed with optional argument missing", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "look <direction:direction?>",
				execute() {},
			});

			const actor = createTestMob("Player", "player");
			const context: CommandContext = { actor };

			const result = command.parse("look", context);
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.has("direction"), false);
		});

		test("should succeed when optional argument parsing fails", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "look <direction:direction?>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("look invalid", context);
			// Optional args that fail to parse don't cause errors
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.has("direction"), false);
		});

		test("should handle multiple required arguments with specific error for first missing", () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "give <item:item> to <target:mob>",
				execute() {},
			});

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = createTestMob("Player", "player");
			room?.add(actor);

			const context: CommandContext = {
				actor,
				room,
			};
			const result = command.parse("give sword to bob", context);

			assert.strictEqual(result.success, false);
			// When the item doesn't exist, parsing fails for the first argument
			assert.strictEqual(result.error, "Could not parse argument: item");
		});

		test('should return "Input does not match command pattern" when regex fails to match', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "say <message:text>",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("shout hello", context);
			assert.strictEqual(result.success, false);
			assert.strictEqual(result.error, "Input does not match command pattern");
		});

		test('should return "Input does not match command pattern" when literal text does not match', () => {
			const command = new JavaScriptCommandAdapter({
				pattern: "give <amount:number> gold",
				execute() {},
			});

			const actor = createMob();
			const context: CommandContext = { actor };

			const result = command.parse("give 10 silver", context);
			assert.strictEqual(result.success, false);
			assert.strictEqual(result.error, "Input does not match command pattern");
		});
	});
});
