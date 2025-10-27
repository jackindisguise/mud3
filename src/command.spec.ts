import { suite, test } from "node:test";
import assert from "node:assert";
import {
	Command,
	CommandContext,
	CommandRegistry,
	ArgumentType,
} from "./command.js";
import { Dungeon, DungeonObject, Mob, DIRECTION } from "./dungeon.js";

suite("command.ts", () => {
	suite("Command", () => {
		test("should parse simple text command", () => {
			class OocCommand extends Command {
				pattern = "ooc <message:text>";
				executed = false;
				capturedMessage = "";

				execute(context: CommandContext, args: Map<string, any>) {
					this.executed = true;
					this.capturedMessage = args.get("message");
				}
			}

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = new Mob({ keywords: "player" });
			room?.add(actor);

			const command = new OocCommand();
			const context: CommandContext = { actor, room, input: "" };
			const result = command.parse("ooc Hello, world!", context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("message"), "Hello, world!");

			command.execute(context, result.args);
			assert.strictEqual(command.executed, true);
			assert.strictEqual(command.capturedMessage, "Hello, world!");
		});

		test("should parse command with word argument", () => {
			class LookCommand extends Command {
				pattern = "look <direction:word?>";
				execute() {}
			}

			const actor = new Mob();
			const context: CommandContext = { actor, input: "" };
			const command = new LookCommand();

			const result1 = command.parse("look north", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("direction"), "north");

			const result2 = command.parse("look", context);
			assert.strictEqual(result2.success, true);
		});

		test("should parse command with number argument", () => {
			class DropCommand extends Command {
				pattern = "drop <amount:number> <item:text>";
				execute() {}
			}

			const actor = new Mob();
			const context: CommandContext = { actor, input: "" };
			const command = new DropCommand();

			const result = command.parse("drop 5 gold coins", context);
			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("amount"), 5);
			assert.strictEqual(result.args.get("item"), "gold coins");
		});

		test("should parse command with object from room", () => {
			class GetCommand extends Command {
				pattern = "get <item:object@room>";
				execute() {}
			}

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = new Mob({ keywords: "player" });
			const sword = new DungeonObject({ keywords: "steel sword" });
			room?.add(actor);
			room?.add(sword);

			const command = new GetCommand();
			const context: CommandContext = { actor, room, input: "" };
			const result = command.parse("get sword", context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("item"), sword);
		});

		test("should parse command with object from inventory", () => {
			class DropCommand extends Command {
				pattern = "drop <item:object@inventory>";
				execute() {}
			}

			const actor = new Mob({ keywords: "player" });
			const sword = new DungeonObject({ keywords: "steel sword" });
			actor.add(sword);

			const command = new DropCommand();
			const context: CommandContext = { actor, input: "" };
			const result = command.parse("drop sword", context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("item"), sword);
		});

		test("should parse complex command with multiple objects", () => {
			class PutCommand extends Command {
				pattern = "put <item:object> in <container:object>";
				execute() {}
			}

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = new Mob({ keywords: "player" });
			const coin = new DungeonObject({ keywords: "gold coin" });
			const bag = new DungeonObject({ keywords: "leather bag" });

			room?.add(actor);
			actor.add(coin);
			room?.add(bag);

			const command = new PutCommand();
			const context: CommandContext = { actor, room, input: "" };
			const result = command.parse("put coin in bag", context);

			assert.strictEqual(result.success, true);
			assert.strictEqual(result.args.get("item"), coin);
			assert.strictEqual(result.args.get("container"), bag);
		});

		test("should support command aliases", () => {
			class TellCommand extends Command {
				pattern = "tell <player:mob> <message:text>";
				aliases = ["whisper <player:mob> <message:text>"];
				execute() {}
			}

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = new Mob({ keywords: "player" });
			const target = new Mob({ keywords: "bob" });
			room?.add(actor);
			room?.add(target);

			const command = new TellCommand();
			const context: CommandContext = { actor, room, input: "" };

			const result1 = command.parse("tell bob hello", context);
			assert.strictEqual(result1.success, true);
			assert.strictEqual(result1.args.get("player"), target);

			const result2 = command.parse("whisper bob hello", context);
			assert.strictEqual(result2.success, true);
			assert.strictEqual(result2.args.get("player"), target);
		});

		test("should fail when required argument is missing", () => {
			class SayCommand extends Command {
				pattern = "say <message:text>";
				execute() {}
			}

			const actor = new Mob();
			const context: CommandContext = { actor, input: "" };
			const command = new SayCommand();

			const result = command.parse("say", context);
			assert.strictEqual(result.success, false);
			assert(result.error?.includes("Missing required argument"));
		});

		test("should fail when object is not found", () => {
			class GetCommand extends Command {
				pattern = "get <item:object>";
				execute() {}
			}

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = new Mob({ keywords: "player" });
			room?.add(actor);

			const command = new GetCommand();
			const context: CommandContext = { actor, room, input: "" };
			const result = command.parse("get sword", context);

			assert.strictEqual(result.success, false);
			assert(result.error?.includes("Could not parse argument"));
		});

		test("should call onError when parsing fails", () => {
			class SayCommand extends Command {
				pattern = "say <message:text>";
				errorCalled = false;
				errorMessage = "";

				execute() {}

				onError(context: CommandContext, result: any) {
					this.errorCalled = true;
					this.errorMessage = result.error;
				}
			}

			const actor = new Mob();
			const context: CommandContext = { actor, input: "" };
			const command = new SayCommand();

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

			assert.strictEqual(command.errorCalled, true);
			assert(command.errorMessage.includes("Missing required argument"));
		});
	});

	suite("CommandRegistry", () => {
		test("should register and execute commands", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.getCommands();
			existingCommands.forEach((cmd) => CommandRegistry.unregister(cmd));

			class TestCommand extends Command {
				pattern = "test <message:text>";
				executed = false;

				execute(context: CommandContext, args: Map<string, any>) {
					this.executed = true;
				}
			}

			const command = new TestCommand();
			CommandRegistry.register(command);

			const actor = new Mob();
			const context: CommandContext = { actor, input: "test hello" };

			const result = CommandRegistry.execute("test hello", context);
			assert.strictEqual(result, true);
			assert.strictEqual(command.executed, true);

			// Clean up
			CommandRegistry.unregister(command);
		});

		test("should return false when no command matches", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.getCommands();
			existingCommands.forEach((cmd) => CommandRegistry.unregister(cmd));

			const actor = new Mob();
			const context: CommandContext = { actor, input: "unknown command" };

			const result = CommandRegistry.execute("unknown command", context);
			assert.strictEqual(result, false);
		});

		test("should call onError when command pattern matches but parsing fails", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.getCommands();
			existingCommands.forEach((cmd) => CommandRegistry.unregister(cmd));

			class SayCommand extends Command {
				pattern = "say <message:text>";
				errorCalled = false;
				executeCalled = false;

				execute() {
					this.executeCalled = true;
				}

				onError() {
					this.errorCalled = true;
				}
			}

			const command = new SayCommand();
			CommandRegistry.register(command);

			const actor = new Mob();
			const context: CommandContext = { actor, input: "say" };

			const result = CommandRegistry.execute("say", context);
			assert.strictEqual(result, true); // Command matched
			assert.strictEqual(command.errorCalled, true); // onError was called
			assert.strictEqual(command.executeCalled, false); // execute was NOT called

			// Clean up
			CommandRegistry.unregister(command);
		});

		test("should try commands in order until one matches", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.getCommands();
			existingCommands.forEach((cmd) => CommandRegistry.unregister(cmd));

			class Command1 extends Command {
				pattern = "cmd1 <arg:text>";
				executed = false;
				execute() {
					this.executed = true;
				}
			}

			class Command2 extends Command {
				pattern = "cmd2 <arg:text>";
				executed = false;
				execute() {
					this.executed = true;
				}
			}

			const cmd1 = new Command1();
			const cmd2 = new Command2();
			CommandRegistry.register(cmd1);
			CommandRegistry.register(cmd2);

			const actor = new Mob();
			const context: CommandContext = { actor, input: "" };

			CommandRegistry.execute("cmd2 test", context);
			assert.strictEqual(cmd1.executed, false);
			assert.strictEqual(cmd2.executed, true);

			// Clean up
			CommandRegistry.unregister(cmd1);
			CommandRegistry.unregister(cmd2);
		});

		test("should unregister commands", () => {
			// Clear registry first
			const existingCommands = CommandRegistry.getCommands();
			existingCommands.forEach((cmd) => CommandRegistry.unregister(cmd));

			class TestCommand extends Command {
				pattern = "test";
				execute() {}
			}

			const command = new TestCommand();

			CommandRegistry.register(command);
			assert.strictEqual(CommandRegistry.getCommands().length, 1);

			CommandRegistry.unregister(command);
			assert.strictEqual(CommandRegistry.getCommands().length, 0);
		});
	});

	suite("Example Commands", () => {
		test("OOC command example", () => {
			class OocCommand extends Command {
				pattern = "ooc <message:text>";
				lastMessage = "";

				execute(context: CommandContext, args: Map<string, any>) {
					this.lastMessage = `[OOC] ${context.actor.display}: ${args.get(
						"message"
					)}`;
				}
			}

			const actor = new Mob({ display: "Player" });
			const context: CommandContext = { actor, input: "" };
			const command = new OocCommand();

			const result = command.parse("ooc Hello everyone!", context);
			assert.strictEqual(result.success, true);

			command.execute(context, result.args);
			assert.strictEqual(command.lastMessage, "[OOC] Player: Hello everyone!");
		});

		test("Get command example", () => {
			class GetCommand extends Command {
				pattern = "get <item:object@room>";
				pickedUp?: DungeonObject;

				execute(context: CommandContext, args: Map<string, any>) {
					const item = args.get("item") as DungeonObject;
					this.pickedUp = item;
					context.actor.add(item);
				}
			}

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = new Mob();
			const sword = new DungeonObject({ keywords: "steel sword" });

			room?.add(actor);
			room?.add(sword);

			const command = new GetCommand();
			const context: CommandContext = { actor, room, input: "" };
			const result = command.parse("get sword", context);

			assert.strictEqual(result.success, true);
			command.execute(context, result.args);

			assert.strictEqual(command.pickedUp, sword);
			assert.strictEqual(sword.location, actor);
		});

		test("Get from container command example", () => {
			class GetFromCommand extends Command {
				pattern = "get <item:object> from <container:object>";
				execute(context: CommandContext, args: Map<string, any>) {
					const item = args.get("item") as DungeonObject;
					context.actor.add(item);
				}
			}

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = new Mob();
			const chest = new DungeonObject({ keywords: "wooden chest" });
			const coin = new DungeonObject({ keywords: "gold coin" });

			room?.add(actor);
			room?.add(chest);
			chest.add(coin);

			const command = new GetFromCommand();
			const context: CommandContext = { actor, room, input: "" };
			const result = command.parse("get coin from chest", context);

			assert.strictEqual(result.success, true);
			command.execute(context, result.args);

			assert.strictEqual(coin.location, actor);
			assert(!chest.contains(coin));
		});

		test("Kill command example", () => {
			class KillCommand extends Command {
				pattern = "kill <target:object@room>";
				attacked?: DungeonObject;

				execute(context: CommandContext, args: Map<string, any>) {
					this.attacked = args.get("target") as DungeonObject;
				}
			}

			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const actor = new Mob();
			const goblin = new DungeonObject({ keywords: "goblin monster" });

			room?.add(actor);
			room?.add(goblin);

			const command = new KillCommand();
			const context: CommandContext = { actor, room, input: "" };
			const result = command.parse("kill goblin", context);

			assert.strictEqual(result.success, true);
			command.execute(context, result.args);
			assert.strictEqual(command.attacked, goblin);
		});
	});
});
