import { suite, test, before } from "node:test";
import assert from "node:assert";
import { Dungeon, DungeonObjectTemplate } from "../dungeon.js";
import reservedNamesPkg from "./reserved-names.js";
import { isNameBlocked } from "../registry/reserved-names.js";
import dungeonPkg, { createDungeonInstance } from "./dungeon.js";

suite("package/reservedNames.ts", () => {
	let testDungeon: Dungeon;

	before(async () => {
		// Load dungeon package first (required dependency)
		await dungeonPkg.loader();

		// Create a test dungeon with some mob templates
		testDungeon = createDungeonInstance({
			id: "test-dungeon",
			dimensions: { width: 10, height: 10, layers: 1 },
		});

		// Add some mob templates to test blocked names
		const goblinTemplate: DungeonObjectTemplate = {
			id: "goblin",
			type: "Mob",
			display: "Goblin",
			keywords: "goblin creature",
		};
		testDungeon.addTemplate(goblinTemplate);

		const orcTemplate: DungeonObjectTemplate = {
			id: "orc",
			type: "Mob",
			display: "Orc Warrior",
			keywords: "orc warrior",
		};
		testDungeon.addTemplate(orcTemplate);

		const coloredMobTemplate: DungeonObjectTemplate = {
			id: "colored-mob",
			type: "Mob",
			display: "{rRed Dragon{x",
			keywords: "dragon red",
		};
		testDungeon.addTemplate(coloredMobTemplate);

		// Load reserved names package to build the cache
		await reservedNamesPkg.loader();
	});

	suite("isNameBlocked", () => {
		suite("mob template names", () => {
			test("should block exact display name match", () => {
				assert.strictEqual(isNameBlocked("Goblin"), true);
				assert.strictEqual(isNameBlocked("goblin"), true);
				assert.strictEqual(isNameBlocked("GOBLIN"), true);
			});

			test("should block display name with colors stripped", () => {
				assert.strictEqual(isNameBlocked("Red Dragon"), true);
				assert.strictEqual(isNameBlocked("red dragon"), true);
			});

			test("should block keyword matches", () => {
				assert.strictEqual(isNameBlocked("goblin"), true);
				assert.strictEqual(isNameBlocked("creature"), true);
				assert.strictEqual(isNameBlocked("orc"), true);
				assert.strictEqual(isNameBlocked("warrior"), true);
				assert.strictEqual(isNameBlocked("dragon"), true);
			});

			test("should not block similar but different names", () => {
				assert.strictEqual(isNameBlocked("Goblinoid"), false);
				assert.strictEqual(isNameBlocked("Gob"), false);
				assert.strictEqual(isNameBlocked("Orcish"), false);
			});
		});

		suite("offensive patterns", () => {
			test("should block N-word variations", () => {
				assert.strictEqual(isNameBlocked("nigger"), true);
				assert.strictEqual(isNameBlocked("n1gg3r"), true);
				assert.strictEqual(isNameBlocked("n6gg3r"), true);
				assert.strictEqual(isNameBlocked("nggr"), true);
				assert.strictEqual(isNameBlocked("niggr"), true);
				assert.strictEqual(isNameBlocked("ngger"), true);
				assert.strictEqual(isNameBlocked("nnniiigggerr"), true);
			});

			test("should block F-word variations", () => {
				assert.strictEqual(isNameBlocked("fuck"), true);
				assert.strictEqual(isNameBlocked("f4ck"), true);
				assert.strictEqual(isNameBlocked("f6ck"), true);
				assert.strictEqual(isNameBlocked("fggt"), true);
				assert.strictEqual(isNameBlocked("fggot"), true);
			});

			test("should block swear words", () => {
				assert.strictEqual(isNameBlocked("shit"), true);
				assert.strictEqual(isNameBlocked("bitch"), true);
				assert.strictEqual(isNameBlocked("cunt"), true);
			});

			test("should block religious/ethnic terms", () => {
				assert.strictEqual(isNameBlocked("jew"), true);
				assert.strictEqual(isNameBlocked("j3w"), true);
				assert.strictEqual(isNameBlocked("israel"), true);
				assert.strictEqual(isNameBlocked("israelis"), true);
				assert.strictEqual(isNameBlocked("chinese"), true);
				assert.strictEqual(isNameBlocked("japanese"), true);
			});

			test("should block names containing offensive terms", () => {
				assert.strictEqual(isNameBlocked("testniggertest"), true);
				assert.strictEqual(isNameBlocked("myfuckname"), true);
				assert.strictEqual(isNameBlocked("somethingjew"), true);
			});

			test("should allow normal names", () => {
				assert.strictEqual(isNameBlocked("Bob"), false);
				assert.strictEqual(isNameBlocked("Alice"), false);
				assert.strictEqual(isNameBlocked("John"), false);
				assert.strictEqual(isNameBlocked("Mary"), false);
				assert.strictEqual(isNameBlocked("Robert"), false);
			});
		});

		suite("pop culture names", () => {
			test("should block well-known fantasy character names", () => {
				assert.strictEqual(isNameBlocked("Gandalf"), true);
				assert.strictEqual(isNameBlocked("Aragorn"), true);
				assert.strictEqual(isNameBlocked("Legolas"), true);
				assert.strictEqual(isNameBlocked("Frodo"), true);
				assert.strictEqual(isNameBlocked("Sauron"), true);
				assert.strictEqual(isNameBlocked("Drizzt"), true);
			});

			test("should block anime character names", () => {
				assert.strictEqual(isNameBlocked("Naruto"), true);
				assert.strictEqual(isNameBlocked("Sasuke"), true);
				assert.strictEqual(isNameBlocked("Goku"), true);
				assert.strictEqual(isNameBlocked("Vegeta"), true);
				assert.strictEqual(isNameBlocked("Ichigo"), true);
			});

			test("should block Star Wars character names", () => {
				assert.strictEqual(isNameBlocked("Anakin"), true);
				assert.strictEqual(isNameBlocked("Obiwan"), true);
				assert.strictEqual(isNameBlocked("Yoda"), true);
				assert.strictEqual(isNameBlocked("Vader"), true);
			});

			test("should block short pop culture names as whole words only", () => {
				// These are under 5 characters, so they should only match whole words
				assert.strictEqual(isNameBlocked("Pit"), true);
				assert.strictEqual(isNameBlocked("Han"), true);
				assert.strictEqual(isNameBlocked("Tien"), true);
				assert.strictEqual(isNameBlocked("Cell"), true);
				// Should not match if part of a larger word
				assert.strictEqual(isNameBlocked("Pitfall"), false);
				assert.strictEqual(isNameBlocked("Handy"), false);
				assert.strictEqual(isNameBlocked("Tienanmen"), false);
				assert.strictEqual(isNameBlocked("Cellular"), false);
			});

			test("should not block common regular names", () => {
				assert.strictEqual(isNameBlocked("Bob"), false);
				assert.strictEqual(isNameBlocked("Robert"), false);
				assert.strictEqual(isNameBlocked("Ned"), false);
				assert.strictEqual(isNameBlocked("Bran"), false);
				assert.strictEqual(isNameBlocked("Arya"), false);
				assert.strictEqual(isNameBlocked("Jaime"), false);
				assert.strictEqual(isNameBlocked("Jon"), false);
			});

			test("should block names containing pop culture names", () => {
				// For names 5+ characters, should match anywhere in string
				assert.strictEqual(isNameBlocked("testGandalf"), true);
				assert.strictEqual(isNameBlocked("NarutoFan"), true);
				assert.strictEqual(isNameBlocked("Goku123"), true);
			});
		});

		suite("case insensitivity", () => {
			test("should be case-insensitive for all checks", () => {
				assert.strictEqual(isNameBlocked("GOBLIN"), true);
				assert.strictEqual(isNameBlocked("NIGGER"), true);
				assert.strictEqual(isNameBlocked("GANDALF"), true);
				assert.strictEqual(isNameBlocked("gObLiN"), true);
			});
		});

		suite("edge cases", () => {
			test("should handle empty string", () => {
				assert.strictEqual(isNameBlocked(""), false);
			});

			test("should handle whitespace", () => {
				assert.strictEqual(isNameBlocked("  goblin  "), true);
				assert.strictEqual(isNameBlocked("  Bob  "), false);
			});

			test("should handle numbers in names", () => {
				assert.strictEqual(isNameBlocked("Goblin123"), false);
				assert.strictEqual(isNameBlocked("Bob123"), false);
			});
		});
	});
});
