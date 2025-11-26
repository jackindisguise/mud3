import { suite, test, before, after } from "node:test";
import assert from "node:assert";
import { readFile, writeFile, unlink, copyFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import YAML from "js-yaml";
import { Dungeon, Room } from "../dungeon.js";
import locationsPkg from "./locations.js";
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
		// Create a test dungeon with rooms for testing
		testDungeon = Dungeon.generateEmptyDungeon({
			id: "tower",
			dimensions: { width: 20, height: 20, layers: 1 },
		});

		// Backup existing locations file if present
		if (existsSync(LOCATIONS_PATH)) {
			await copyFile(LOCATIONS_PATH, BACKUP_PATH);
		}
	});

	after(async () => {
		// Restore backup if it exists
		if (existsSync(BACKUP_PATH)) {
			await copyFile(BACKUP_PATH, LOCATIONS_PATH);
			await unlink(BACKUP_PATH);
		}
		// Reset locations to default
		Object.assign(LOCATIONS, LOCATIONS_DEFAULT);
	});

	test("should make default locations file if none present", async () => {
		// Remove locations file if it exists
		if (existsSync(LOCATIONS_PATH)) {
			await unlink(LOCATIONS_PATH);
		}

		// Load should create the file
		await locationsPkg.loader();

		// Verify file was created
		assert.ok(existsSync(LOCATIONS_PATH), "Locations file should be created");

		// Verify file content matches default
		const content = await readFile(LOCATIONS_PATH, "utf-8");
		const parsedLocations = YAML.load(content);
		assert.deepStrictEqual(parsedLocations, LOCATIONS_DEFAULT);
	});

	test("should successfully read locations file", async () => {
		// Create a test locations file with custom values
		const testLocations = {
			start: "@tower{5,5,0}",
			recall: "@tower{10,10,0}",
			graveyard: "@tower{15,15,0}",
		};
		await writeFile(
			LOCATIONS_PATH,
			YAML.dump(testLocations, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset LOCATIONS to default
		Object.assign(LOCATIONS, LOCATIONS_DEFAULT);

		// Load should read the file
		await locationsPkg.loader();

		// Verify LOCATIONS was updated with the values from file
		assert.strictEqual(LOCATIONS.start, "@tower{5,5,0}");
		assert.strictEqual(LOCATIONS.recall, "@tower{10,10,0}");
		assert.strictEqual(LOCATIONS.graveyard, "@tower{15,15,0}");
	});

	test("should handle partial locations", async () => {
		// Create a test locations file with only some values
		const testLocations = {
			start: "@tower{1,1,0}",
		};
		await writeFile(
			LOCATIONS_PATH,
			YAML.dump(testLocations, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset LOCATIONS to default
		Object.assign(LOCATIONS, LOCATIONS_DEFAULT);

		// Load should read the file
		await locationsPkg.loader();

		// Verify only specified values were updated
		assert.strictEqual(LOCATIONS.start, "@tower{1,1,0}");
		assert.strictEqual(LOCATIONS.recall, LOCATIONS_DEFAULT.recall);
		assert.strictEqual(LOCATIONS.graveyard, LOCATIONS_DEFAULT.graveyard);
	});

	test("should ignore invalid fields", async () => {
		// Create a test locations file with valid and invalid fields
		const testLocations = {
			start: "@tower{2,2,0}",
			recall: "@tower{3,3,0}",
			graveyard: "@tower{4,4,0}",
			invalidField: "@tower{99,99,0}",
		};
		await writeFile(
			LOCATIONS_PATH,
			YAML.dump(testLocations, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset LOCATIONS to default
		Object.assign(LOCATIONS, LOCATIONS_DEFAULT);

		// Load should read the file
		await locationsPkg.loader();

		// Verify only valid fields were loaded
		assert.strictEqual(LOCATIONS.start, "@tower{2,2,0}");
		assert.strictEqual(LOCATIONS.recall, "@tower{3,3,0}");
		assert.strictEqual(LOCATIONS.graveyard, "@tower{4,4,0}");
		assert.strictEqual("invalidField" in LOCATIONS, false);
	});

	test("should throw error for invalid room references", async () => {
		// Create a test locations file with invalid room references
		const testLocations = {
			start: "@nonexistent{0,0,0}",
			recall: "@tower{999,999,0}",
			graveyard: "@tower{0,0,0}",
		};
		await writeFile(
			LOCATIONS_PATH,
			YAML.dump(testLocations, { noRefs: true, lineWidth: 120 }),
			"utf-8"
		);

		// Reset LOCATIONS to default
		Object.assign(LOCATIONS, LOCATIONS_DEFAULT);

		// Load should throw an error
		await assert.rejects(
			async () => {
				await locationsPkg.loader();
			},
			(error: Error) => {
				assert.ok(error.message.includes("Invalid location references found"));
				assert.ok(error.message.includes("start: @nonexistent{0,0,0}"));
				assert.ok(error.message.includes("recall: @tower{999,999,0}"));
				return true;
			}
		);
	});

	test("getLocation should return Room object", () => {
		// Set up valid locations
		const tmpLocations: Locations = {
			start: "@tower{0,0,0}",
			recall: "@tower{1,1,0}",
			graveyard: "@tower{2,2,0}",
		};
		setLocations(tmpLocations);

		// Test with enum
		const startRoom = getLocation(LOCATION.START);
		assert.ok(startRoom);
		assert.strictEqual(startRoom.coordinates.x, 0);
		assert.strictEqual(startRoom.coordinates.y, 0);
		assert.strictEqual(startRoom.coordinates.z, 0);

		// Test with string key
		const recallRoom = getLocation(LOCATION.RECALL);
		assert.ok(recallRoom);
		assert.strictEqual(recallRoom.coordinates.x, 1);
		assert.strictEqual(recallRoom.coordinates.y, 1);
		assert.strictEqual(recallRoom.coordinates.z, 0);
	});

	test("getLocationRef should return reference string", () => {
		// Set up valid locations
		const tmpLocations: Locations = {
			start: "@tower{3,3,0}",
			recall: "@tower{4,4,0}",
			graveyard: "@tower{5,5,0}",
		};
		setLocations(tmpLocations);

		// Test with enum
		const startRef = getLocationRef(LOCATION.START);
		assert.strictEqual(startRef, "@tower{3,3,0}");

		// Test with string key
		const recallRef = getLocationRef(LOCATION.RECALL);
		assert.strictEqual(recallRef, "@tower{4,4,0}");
	});

	test("getAllLocations should return dictionary of Room objects", () => {
		// Set up valid locations
		const tmpLocations: Locations = {
			start: "@tower{6,6,0}",
			recall: "@tower{7,7,0}",
			graveyard: "@tower{8,8,0}",
		};
		setLocations(tmpLocations);

		const locations = getAllLocations();

		// Verify all keys are present
		assert.ok("start" in locations);
		assert.ok("recall" in locations);
		assert.ok("graveyard" in locations);

		// Verify all values are Room objects
		assert.ok(locations.start instanceof Room);
		assert.ok(locations.recall instanceof Room);
		assert.ok(locations.graveyard instanceof Room);

		// Verify coordinates match
		assert.strictEqual(locations.start.coordinates.x, 6);
		assert.strictEqual(locations.start.coordinates.y, 6);
		assert.strictEqual(locations.recall.coordinates.x, 7);
		assert.strictEqual(locations.recall.coordinates.y, 7);
		assert.strictEqual(locations.graveyard.coordinates.x, 8);
		assert.strictEqual(locations.graveyard.coordinates.y, 8);
	});

	test("getAllLocationRefs should return dictionary of reference strings", () => {
		// Set up valid locations
		const tmpLocations: Locations = {
			start: "@tower{9,9,0}",
			recall: "@tower{10,10,0}",
			graveyard: "@tower{11,11,0}",
		};
		setLocations(tmpLocations);

		const locationRefs = getAllLocationRefs();

		// Verify all keys are present
		assert.ok("start" in locationRefs);
		assert.ok("recall" in locationRefs);
		assert.ok("graveyard" in locationRefs);

		// Verify all values are strings
		assert.strictEqual(typeof locationRefs.start, "string");
		assert.strictEqual(typeof locationRefs.recall, "string");
		assert.strictEqual(typeof locationRefs.graveyard, "string");

		// Verify values match
		assert.strictEqual(locationRefs.start, "@tower{9,9,0}");
		assert.strictEqual(locationRefs.recall, "@tower{10,10,0}");
		assert.strictEqual(locationRefs.graveyard, "@tower{11,11,0}");

		// Verify it's a copy (not a reference)
		const tmpLocations2: Locations = {
			start: "@tower{99,99,0}",
			recall: "@tower{10,10,0}",
			graveyard: "@tower{11,11,0}",
		};
		setLocations(tmpLocations2);
		assert.strictEqual(LOCATIONS.start, "@tower{99,99,0}");
		assert.strictEqual(LOCATIONS.recall, "@tower{10,10,0}");
		assert.strictEqual(LOCATIONS.graveyard, "@tower{11,11,0}");
		assert.strictEqual(locationRefs.start, "@tower{9,9,0}");
		assert.strictEqual(locationRefs.recall, "@tower{10,10,0}");
		assert.strictEqual(locationRefs.graveyard, "@tower{11,11,0}");
		setLocations(tmpLocations);
	});
});
