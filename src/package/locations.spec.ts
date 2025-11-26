import { suite, test, before, after } from "node:test";
import assert from "node:assert";
import { readFile, writeFile, unlink, copyFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import YAML from "js-yaml";
import { Dungeon, Room } from "../dungeon.js";
import locationsPkg from "./locations.js";
import dungeonPkg from "./dungeon.js";
import {
	getLocation,
	getLocationRef,
	getAllLocations,
	getAllLocationRefs,
	LOCATION,
	LOCATIONS,
	LOCATIONS_DEFAULT,
	Locations,
	setLocations,
} from "../registry/locations.js";

import { getSafeRootDirectory } from "../utils/path.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const LOCATIONS_PATH = join(ROOT_DIRECTORY, "data", "locations.yaml");
const BACKUP_PATH = join(ROOT_DIRECTORY, "data", "locations.yaml.backup");

suite("package/locations.ts", () => {
	let testDungeon: Dungeon;

	before(async () => {
		// Load dungeon package first (required dependency)
		await dungeonPkg.loader();
		await locationsPkg.loader();
	});

	test("getAllLocations should return dictionary of Room objects", () => {
		const locations = getAllLocations();

		// Verify all keys are present
		assert.ok("start" in locations);
		assert.ok("recall" in locations);
		assert.ok("graveyard" in locations);

		// Verify all values are Room objects
		assert.ok(locations.start instanceof Room);
		assert.ok(locations.recall instanceof Room);
		assert.ok(locations.graveyard instanceof Room);
	});

	test("getAllLocationRefs should return dictionary of reference strings", () => {
		const locationRefs = getAllLocationRefs();

		// Verify all keys are present
		assert.ok("start" in locationRefs);
		assert.ok("recall" in locationRefs);
		assert.ok("graveyard" in locationRefs);

		// Verify all values are strings
		assert.strictEqual(typeof locationRefs.start, "string");
		assert.strictEqual(typeof locationRefs.recall, "string");
		assert.strictEqual(typeof locationRefs.graveyard, "string");
	});
});
