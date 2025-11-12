import { describe, it } from "node:test";
import assert from "node:assert";
import { access, unlink } from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import { join } from "path";
import { Character } from "../character.js";
import { Mob } from "../mob.js";
import { saveCharacter, loadCharacter } from "./character.js";

function filePathFor(username: string): string {
	return join(process.cwd(), "data", "characters", `${username}.yaml`);
}

describe("package/character.ts", () => {
	it("saves and loads a character round-trip via YAML", async () => {
		const username = `specuser_${Date.now()}`;
		const password = "specPassword123";

		const mob = new Mob();
		mob.keywords = username;
		mob.display = username;

		const character = new Character({
			credentials: {
				characterId: 1,
				username,
				passwordHash: Character.hashPassword(password),
				createdAt: new Date(),
				lastLogin: new Date(),
				isActive: true,
				isBanned: false,
				isAdmin: false,
			},
			settings: {
				verboseMode: false,
				prompt: "$ ",
				colorEnabled: true,
				autoLook: false,
				briefMode: true,
			},
			stats: {
				playtime: 12345,
				deaths: 2,
				kills: 7,
			},
			mob,
		});

		await saveCharacter(character);

		// file exists
		await access(filePathFor(username), FS_CONSTANTS.F_OK);

		const loaded = await loadCharacter(username);
		assert.ok(loaded, "loaded character should not be null");
		assert.strictEqual(loaded!.credentials.username, username);
		assert.strictEqual(
			loaded!.credentials.passwordHash,
			Character.hashPassword(password)
		);
		// Dates parsed
		assert.ok(loaded!.credentials.createdAt instanceof Date);

		// Settings round-trip
		assert.strictEqual(loaded!.settings.verboseMode, false);
		assert.strictEqual(loaded!.settings.prompt, "$ ");
		assert.strictEqual(loaded!.settings.colorEnabled, true);
		assert.strictEqual(loaded!.settings.autoLook, false);
		assert.strictEqual(loaded!.settings.briefMode, true);

		// Stats round-trip
		assert.strictEqual(loaded!.stats.playtime, 12345);
		assert.strictEqual(loaded!.stats.deaths, 2);
		assert.strictEqual(loaded!.stats.kills, 7);

		// Mob basics round-trip
		assert.strictEqual(loaded!.mob.display, username);
		assert.ok(loaded!.mob.character === loaded);

		// Clean up - delete the test file
		await unlink(filePathFor(username));
	});
});
