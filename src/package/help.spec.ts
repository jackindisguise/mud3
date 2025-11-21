import { suite, test, before, after } from "node:test";
import assert from "node:assert";
import { writeFile, mkdir, rm, readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { getSafeRootDirectory } from "../utils/path.js";
import helpPkg, {
	getHelpfile,
	getAllHelpKeywords,
	clearHelpfiles,
	getHelpfileCount,
	autocompleteHelpfile,
	searchHelpfiles,
} from "./help.js";

const TEST_HELP_DIR = join(getSafeRootDirectory(), "data", "help");
const TEST_FILE_COMBAT = "zztest_combat.yaml";
const TEST_FILE_COMMANDS = "zztest_commands.yaml";
const TEST_FILE_CAST = "zztest_cast.yaml";
const TEST_FILE_ATTACK = "zztest_attack.yaml";

suite("package/help.ts", () => {
	suite("Package metadata", () => {
		test("should have correct package name", () => {
			assert.strictEqual(helpPkg.name, "help");
		});

		test("should have a loader function", () => {
			assert.strictEqual(typeof helpPkg.loader, "function");
		});
	});
	suite("With helpfiles loaded", () => {
		before(async () => {
			// Create test help directory and files
			await mkdir(TEST_HELP_DIR, { recursive: true });

			await writeFile(
				join(TEST_HELP_DIR, TEST_FILE_COMBAT),
				`keyword: testcombat
aliases: [testfight, testbattle]
related: [testattack, testdefend]
content: |
  Combat in the game involves strategic choices.`
			);

			await writeFile(
				join(TEST_HELP_DIR, TEST_FILE_COMMANDS),
				`keyword: testcommands
aliases: [testcmds]
content: |
  Available commands in the game.`
			);

			await writeFile(
				join(TEST_HELP_DIR, TEST_FILE_CAST),
				`keyword: testcast
aliases: [testspell]
content: |
  Cast magical spells.`
			);

			await writeFile(
				join(TEST_HELP_DIR, TEST_FILE_ATTACK),
				`keyword: testattack
aliases: [testatk]
related: [testcombat]
content: |
  Attack command.`
			);

			clearHelpfiles();
			await helpPkg.loader();
		});

		after(async () => {
			// Clean up test files
			await rm(join(TEST_HELP_DIR, TEST_FILE_COMBAT), { force: true });
			await rm(join(TEST_HELP_DIR, TEST_FILE_COMMANDS), { force: true });
			await rm(join(TEST_HELP_DIR, TEST_FILE_CAST), { force: true });
			await rm(join(TEST_HELP_DIR, TEST_FILE_ATTACK), { force: true });
		});

		suite("getHelpfile()", () => {
			test("should retrieve helpfile by primary keyword", () => {
				const helpfile = getHelpfile("testcombat");
				assert.ok(helpfile);
				assert.strictEqual(helpfile.keyword, "testcombat");
				assert.ok(helpfile.content.includes("Combat in the game"));
			});

			test("should retrieve helpfile by alias", () => {
				const byKeyword = getHelpfile("testcombat");
				const byAlias1 = getHelpfile("testfight");
				const byAlias2 = getHelpfile("testbattle");

				assert.ok(byKeyword);
				assert.strictEqual(byKeyword, byAlias1);
				assert.strictEqual(byKeyword, byAlias2);
			});

			test("should be case-insensitive", () => {
				const lower = getHelpfile("testcombat");
				const upper = getHelpfile("TESTCOMBAT");
				const mixed = getHelpfile("TestCombat");

				assert.ok(lower);
				assert.strictEqual(lower, upper);
				assert.strictEqual(lower, mixed);
			});

			test("should return undefined for non-existent helpfile", () => {
				assert.strictEqual(getHelpfile("nonexistent"), undefined);
			});

			test("should preserve related fields", () => {
				const helpfile = getHelpfile("testcombat");
				assert.ok(helpfile);
				assert.ok(Array.isArray(helpfile.related));
				assert.ok(helpfile.related!.includes("testattack"));
				assert.ok(helpfile.related!.includes("testdefend"));
			});

			test("should preserve aliases field", () => {
				const helpfile = getHelpfile("testcombat");
				assert.ok(helpfile);
				assert.ok(Array.isArray(helpfile.aliases));
				assert.ok(helpfile.aliases!.includes("testfight"));
				assert.ok(helpfile.aliases!.includes("testbattle"));
			});
		});

		suite("getAllHelpKeywords()", () => {
			test("should return all primary keywords including test keywords", () => {
				const keywords = getAllHelpKeywords();
				assert.ok(keywords.includes("testcombat"));
				assert.ok(keywords.includes("testcommands"));
				assert.ok(keywords.includes("testcast"));
				assert.ok(keywords.includes("testattack"));
			});

			test("should not include aliases", () => {
				const keywords = getAllHelpKeywords();
				assert.ok(!keywords.includes("testfight"));
				assert.ok(!keywords.includes("testbattle"));
				assert.ok(!keywords.includes("testcmds"));
			});

			test("should return sorted keywords", () => {
				const keywords = getAllHelpKeywords();
				const sorted = [...keywords].sort();
				assert.deepStrictEqual(keywords, sorted);
			});
		});

		suite("getHelpfileCount()", () => {
			test("should return correct count of unique helpfiles", () => {
				const count = getHelpfileCount();
				assert.ok(count >= 4); // At least our 4 test files
			});

			test("should not count aliases as separate helpfiles", () => {
				const count = getHelpfileCount();
				const keywords = getAllHelpKeywords();
				assert.strictEqual(count, keywords.length);
			});
		});

		suite("autocompleteHelpfile()", () => {
			test("should return helpfiles matching keyword prefix", () => {
				const matches = autocompleteHelpfile("testcom");
				assert.ok(matches.length >= 2); // testcombat, testcommands
				const keywords = matches.map((h) => h.keyword);
				assert.ok(keywords.includes("testcombat"));
				assert.ok(keywords.includes("testcommands"));
			});

			test("should return helpfile when matching alias prefix", () => {
				const matches = autocompleteHelpfile("testfi");
				assert.strictEqual(matches.length, 1);
				assert.strictEqual(matches[0].keyword, "testcombat");
			});

			test("should deduplicate when multiple aliases match", () => {
				const matches = autocompleteHelpfile("test");
				const combatCount = matches.filter(
					(h) => h.keyword === "testcombat"
				).length;
				assert.strictEqual(combatCount, 1);
			});

			test("should be case-insensitive", () => {
				const lower = autocompleteHelpfile("testcom");
				const upper = autocompleteHelpfile("TESTCOM");
				const mixed = autocompleteHelpfile("TestCom");

				assert.strictEqual(lower.length, upper.length);
				assert.strictEqual(lower.length, mixed.length);
			});

			test("should return all helpfiles for empty string", () => {
				const matches = autocompleteHelpfile("");
				assert.ok(matches.length >= 4); // At least our 4 test files
			});

			test("should return empty array for no matches", () => {
				const matches = autocompleteHelpfile("xyz123notfound");
				assert.strictEqual(matches.length, 0);
			});

			test("should return sorted results by keyword", () => {
				const matches = autocompleteHelpfile("");
				const keywords = matches.map((h) => h.keyword);
				const sorted = [...keywords].sort();
				assert.deepStrictEqual(keywords, sorted);
			});

			test("should return complete Helpfile objects", () => {
				const matches = autocompleteHelpfile("testcombat");
				assert.strictEqual(matches.length, 1);
				const helpfile = matches[0];

				assert.ok(helpfile.keyword);
				assert.ok(helpfile.content);
				assert.ok(typeof helpfile.keyword === "string");
				assert.ok(typeof helpfile.content === "string");
			});

			test("should match on alias and return the actual helpfile", () => {
				const matches = autocompleteHelpfile("testbat");
				assert.ok(matches.length > 0);

				const combat = matches.find((h) => h.keyword === "testcombat");
				assert.ok(combat);
				assert.ok(combat.aliases?.includes("testbattle"));
			});
		});

		suite("searchHelpfiles()", () => {
			test("should find helpfiles by keyword prefix", () => {
				const results = searchHelpfiles("testcom");
				assert.ok(results.keyword.length >= 2); // testcombat, testcommands
				const keywords = results.keyword.map((h) => h.keyword);
				assert.ok(keywords.includes("testcombat"));
				assert.ok(keywords.includes("testcommands"));
			});

			test("should find helpfiles by alias prefix", () => {
				const results = searchHelpfiles("testfi");
				assert.ok(results.alias.some((h) => h.keyword === "testcombat"));
			});

			test("should find helpfiles by content match", () => {
				const results = searchHelpfiles("strategic");
				assert.ok(results.content.some((h) => h.keyword === "testcombat"));
			});

			test("should find helpfiles by related keyword prefix", () => {
				// testattack has related: [testcombat]
				const results = searchHelpfiles("testcombat");
				// Should find testcombat in keyword and testattack in related
				assert.ok(results.keyword.some((h) => h.keyword === "testcombat"));
				assert.ok(results.related.some((h) => h.keyword === "testattack"));
			});

			test("should categorize matches correctly", () => {
				const results = searchHelpfiles("testcom");
				// Should be in keyword, not in other categories
				assert.ok(results.keyword.length > 0);
				assert.ok(!results.alias.some((h) => h.keyword === "testcombat"));
			});

			test("should set bestMatch to exact keyword match", () => {
				const results = searchHelpfiles("testcombat");
				assert.ok(results.bestMatch);
				assert.strictEqual(results.bestMatch.keyword, "testcombat");
			});

			test("should set bestMatch to first keyword match if no exact match", () => {
				const results = searchHelpfiles("testc");
				assert.ok(results.bestMatch);
				// Should be testcast or testcombat (alphabetically first)
				assert.ok(results.bestMatch.keyword.startsWith("testc"));
			});

			test("should be case-insensitive", () => {
				const lower = searchHelpfiles("strategic");
				const upper = searchHelpfiles("STRATEGIC");
				const mixed = searchHelpfiles("Strategic");

				assert.strictEqual(lower.content.length, upper.content.length);
				assert.strictEqual(lower.content.length, mixed.content.length);
			});

			test("should return sorted results by keyword in each category", () => {
				const results = searchHelpfiles("test");
				const keywordNames = results.keyword.map((h) => h.keyword);
				const sorted = [...keywordNames].sort();
				assert.deepStrictEqual(keywordNames, sorted);
			});

			test("should return empty arrays for no matches", () => {
				const results = searchHelpfiles("xyz123notfound");
				assert.strictEqual(results.keyword.length, 0);
				assert.strictEqual(results.alias.length, 0);
				assert.strictEqual(results.content.length, 0);
				assert.strictEqual(results.related.length, 0);
				assert.strictEqual(results.bestMatch, undefined);
			});

			test("should find by content partial match", () => {
				// "game" appears in multiple helpfile contents
				const results = searchHelpfiles("game");
				assert.ok(results.content.length > 0);
				// Verify at least one has "game" in content
				assert.ok(
					results.content.some((h) => h.content.toLowerCase().includes("game"))
				);
			});

			test("should not duplicate helpfiles across categories", () => {
				// A helpfile should appear in each category at most once
				const results = searchHelpfiles("test");
				const allHelpfiles = [
					...results.keyword,
					...results.alias,
					...results.content,
					...results.related,
				];
				// Each category should have unique entries
				const keywordKeys = results.keyword.map((h) => h.keyword);
				const uniqueKeywordKeys = [...new Set(keywordKeys)];
				assert.strictEqual(keywordKeys.length, uniqueKeywordKeys.length);
			});
		});

		suite("clearHelpfiles()", () => {
			test("should clear all loaded helpfiles", async () => {
				const countBefore = getHelpfileCount();
				assert.ok(countBefore > 0);

				clearHelpfiles();

				assert.strictEqual(getHelpfileCount(), 0);
				assert.strictEqual(getHelpfile("testcombat"), undefined);

				// Reload for other tests
				await helpPkg.loader();
			});
		});
	});
});
