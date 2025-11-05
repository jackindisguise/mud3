import { suite, test, before, after } from "node:test";
import assert from "node:assert";
import { readFile, writeFile, unlink, copyFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import YAML from "js-yaml";
import config, { CONFIG, CONFIG_DEFAULT } from "./config.js";

const CONFIG_PATH = join(process.cwd(), "data", "config.yaml");
const BACKUP_PATH = join(process.cwd(), "data", "config.yaml.backup");

suite("package/config.ts", () => {
	before(async () => {
		// Backup existing config if present
		if (existsSync(CONFIG_PATH)) {
			await copyFile(CONFIG_PATH, BACKUP_PATH);
		}
	});

	after(async () => {
		// Restore backup if it exists
		if (existsSync(BACKUP_PATH)) {
			await copyFile(BACKUP_PATH, CONFIG_PATH);
			await unlink(BACKUP_PATH);
		}
		// Reset config to default
		Object.assign(CONFIG.game, CONFIG_DEFAULT.game);
		Object.assign(CONFIG.server, CONFIG_DEFAULT.server);
	});

	test("should make default config file if none present", async () => {
		// Remove config file if it exists
		if (existsSync(CONFIG_PATH)) {
			await unlink(CONFIG_PATH);
		}

		// Load should create the file
		await config.loader();

		// Verify file was created
		assert.ok(existsSync(CONFIG_PATH), "Config file should be created");

		// Verify file content matches default
		const content = await readFile(CONFIG_PATH, "utf-8");
		const parsedConfig = YAML.load(content);
		assert.deepStrictEqual(parsedConfig, CONFIG_DEFAULT);
	});

	test("should successfully read config file", async () => {
		// Create a test config with custom values
		const testConfig = {
			game: {
				name: "TestMUD",
				creator: "TestCreator",
			},
			server: {
				port: 8080,
				inactivity_timeout: 3600,
			},
		};
		await writeFile(
			CONFIG_PATH,
			YAML.dump(testConfig, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset CONFIG to default
		Object.assign(CONFIG.game, CONFIG_DEFAULT.game);
		Object.assign(CONFIG.server, CONFIG_DEFAULT.server);

		// Load should read the file
		await config.loader();

		// Verify CONFIG was updated with the values from file
		assert.strictEqual(CONFIG.game.name, "TestMUD");
		assert.strictEqual(CONFIG.game.creator, "TestCreator");
		assert.strictEqual(CONFIG.server.port, 8080);
		assert.strictEqual(CONFIG.server.inactivity_timeout, 3600);
	});

	test("should handle partial config", async () => {
		// Create a test config with only some values
		const testConfig = {
			game: {
				name: "PartialMUD",
			},
			server: {
				port: 9000,
			},
		};
		await writeFile(
			CONFIG_PATH,
			YAML.dump(testConfig, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset CONFIG to default
		Object.assign(CONFIG.game, CONFIG_DEFAULT.game);
		Object.assign(CONFIG.server, CONFIG_DEFAULT.server);

		// Load should read the file
		await config.loader();

		// Verify only specified values were updated
		assert.strictEqual(CONFIG.game.name, "PartialMUD");
		assert.strictEqual(CONFIG.game.creator, CONFIG_DEFAULT.game.creator);
		assert.strictEqual(CONFIG.server.port, 9000);
		assert.strictEqual(
			CONFIG.server.inactivity_timeout,
			CONFIG_DEFAULT.server.inactivity_timeout
		);
	});

	test("should ignore invalid fields", async () => {
		// Create a test config with valid and invalid fields
		const testConfig = {
			game: {
				name: "TestMUD",
				creator: "TestCreator",
				invalidField: "should be ignored",
			},
			server: {
				port: 5000,
				inactivity_timeout: 2400,
				anotherBadField: 999,
			},
		};
		await writeFile(
			CONFIG_PATH,
			YAML.dump(testConfig, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset CONFIG to default
		Object.assign(CONFIG.game, CONFIG_DEFAULT.game);
		Object.assign(CONFIG.server, CONFIG_DEFAULT.server);

		// Load should read the file
		await config.loader();

		// Verify only valid fields were loaded
		assert.strictEqual(CONFIG.game.name, "TestMUD");
		assert.strictEqual(CONFIG.game.creator, "TestCreator");
		assert.strictEqual("invalidField" in CONFIG.game, false);
		assert.strictEqual(CONFIG.server.port, 5000);
		assert.strictEqual(CONFIG.server.inactivity_timeout, 2400);
		assert.strictEqual("anotherBadField" in CONFIG.server, false);
	});

	test("should handle missing sections gracefully", async () => {
		// Create a test config with only game section
		const testConfig = {
			game: {
				name: "OnlyGame",
				creator: "TestCreator",
			},
		};
		await writeFile(
			CONFIG_PATH,
			YAML.dump(testConfig, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset CONFIG to default
		Object.assign(CONFIG.game, CONFIG_DEFAULT.game);
		Object.assign(CONFIG.server, CONFIG_DEFAULT.server);

		// Load should read the file
		await config.loader();

		// Verify game section was loaded
		assert.strictEqual(CONFIG.game.name, "OnlyGame");
		assert.strictEqual(CONFIG.game.creator, "TestCreator");

		// Verify server section retains defaults
		assert.strictEqual(CONFIG.server.port, CONFIG_DEFAULT.server.port);
		assert.strictEqual(
			CONFIG.server.inactivity_timeout,
			CONFIG_DEFAULT.server.inactivity_timeout
		);
	});

	test("should fail to load package multiple times", async () => {
		// Create a test config
		const testConfig = {
			game: {
				name: "TestMUD",
				creator: "TestCreator",
			},
			server: {
				port: 3000,
				inactivity_timeout: 1200,
			},
		};
		await writeFile(
			CONFIG_PATH,
			YAML.dump(testConfig, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset config
		Object.assign(CONFIG.game, CONFIG_DEFAULT.game);
		Object.assign(CONFIG.server, CONFIG_DEFAULT.server);

		// First load should succeed
		await config.loader();
		const firstLoadName = CONFIG.game.name;
		const firstLoadPort = CONFIG.server.port;

		// Second load should also succeed (loads again)
		await config.loader();

		// Config should remain the same
		assert.strictEqual(CONFIG.game.name, firstLoadName);
		assert.strictEqual(CONFIG.server.port, firstLoadPort);
	});
});
