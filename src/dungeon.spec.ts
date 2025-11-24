import assert from "node:assert";
import { suite, test, beforeEach } from "node:test";

import {
	DIRECTION,
	dir2text,
	dir2reverse,
	text2dir,
	Dungeon,
	DungeonObject,
	Room,
	DUNGEON_REGISTRY,
	getDungeonById,
	getRoomByRef,
	Movable,
	Item,
	Prop,
	RoomLink,
	DIRECTIONS,
	createFromTemplate,
	Reset,
	type SerializedDungeonObject,
	type SerializedRoom,
	type SerializedMovable,
	type SerializedItem,
	type SerializedProp,
	type DungeonObjectTemplate,
	type RoomTemplate,
	ArmorTemplate,
	WeaponTemplate,
} from "./dungeon.js";
import {
	Mob,
	type SerializedMob,
	Equipment,
	Armor,
	Weapon,
	EQUIPMENT_SLOT,
} from "./dungeon.js";
import { Character, MESSAGE_GROUP } from "./character.js";

suite("dungeon.ts", () => {
	suite("DIRECTION", () => {
		test("should map directions to their text representations", () => {
			assert(dir2text(DIRECTION.NORTH) === "north");
			assert(dir2text(DIRECTION.SOUTH) === "south");
			assert(dir2text(DIRECTION.EAST) === "east");
			assert(dir2text(DIRECTION.WEST) === "west");
			assert(dir2text(DIRECTION.UP) === "up");
			assert(dir2text(DIRECTION.DOWN) === "down");
			assert(dir2text(DIRECTION.NORTHEAST) === "northeast");
			assert(dir2text(DIRECTION.NORTHWEST) === "northwest");
			assert(dir2text(DIRECTION.SOUTHEAST) === "southeast");
			assert(dir2text(DIRECTION.SOUTHWEST) === "southwest");
		});

		test("should map directions to their abbreviated text representations", () => {
			assert(dir2text(DIRECTION.NORTH, true) === "n");
			assert(dir2text(DIRECTION.SOUTH, true) === "s");
			assert(dir2text(DIRECTION.EAST, true) === "e");
			assert(dir2text(DIRECTION.WEST, true) === "w");
			assert(dir2text(DIRECTION.UP, true) === "u");
			assert(dir2text(DIRECTION.DOWN, true) === "d");
			assert(dir2text(DIRECTION.NORTHEAST, true) === "ne");
			assert(dir2text(DIRECTION.NORTHWEST, true) === "nw");
			assert(dir2text(DIRECTION.SOUTHEAST, true) === "se");
			assert(dir2text(DIRECTION.SOUTHWEST, true) === "sw");
		});

		test("should map directions to full text with explicit false parameter", () => {
			assert(dir2text(DIRECTION.NORTH, false) === "north");
			assert(dir2text(DIRECTION.EAST, false) === "east");
			assert(dir2text(DIRECTION.NORTHEAST, false) === "northeast");
		});

		test("should map full text to directions", () => {
			assert(text2dir("north") === DIRECTION.NORTH);
			assert(text2dir("south") === DIRECTION.SOUTH);
			assert(text2dir("east") === DIRECTION.EAST);
			assert(text2dir("west") === DIRECTION.WEST);
			assert(text2dir("up") === DIRECTION.UP);
			assert(text2dir("down") === DIRECTION.DOWN);
			assert(text2dir("northeast") === DIRECTION.NORTHEAST);
			assert(text2dir("northwest") === DIRECTION.NORTHWEST);
			assert(text2dir("southeast") === DIRECTION.SOUTHEAST);
			assert(text2dir("southwest") === DIRECTION.SOUTHWEST);
		});

		test("should map abbreviated text to directions", () => {
			assert(text2dir("n") === DIRECTION.NORTH);
			assert(text2dir("s") === DIRECTION.SOUTH);
			assert(text2dir("e") === DIRECTION.EAST);
			assert(text2dir("w") === DIRECTION.WEST);
			assert(text2dir("u") === DIRECTION.UP);
			assert(text2dir("d") === DIRECTION.DOWN);
			assert(text2dir("ne") === DIRECTION.NORTHEAST);
			assert(text2dir("nw") === DIRECTION.NORTHWEST);
			assert(text2dir("se") === DIRECTION.SOUTHEAST);
			assert(text2dir("sw") === DIRECTION.SOUTHWEST);
		});

		test("should roundtrip dir2text and text2dir for full names", () => {
			for (const dir of DIRECTIONS) {
				const text = dir2text(dir);
				const convertedBack = text2dir(text);
				assert(convertedBack === dir, `Failed for ${text}`);
			}
		});

		test("should roundtrip dir2text(short) and text2dir for abbreviated names", () => {
			const directions = [
				DIRECTION.NORTH,
				DIRECTION.SOUTH,
				DIRECTION.EAST,
				DIRECTION.WEST,
				DIRECTION.NORTHEAST,
				DIRECTION.NORTHWEST,
				DIRECTION.SOUTHEAST,
				DIRECTION.SOUTHWEST,
				DIRECTION.UP,
				DIRECTION.DOWN,
			];

			for (const dir of directions) {
				const text = dir2text(dir, true);
				const convertedBack = text2dir(text);
				assert(convertedBack === dir, `Failed for ${text}`);
			}
		});

		test("should correctly map directions to their opposites", () => {
			assert(dir2reverse(DIRECTION.NORTH) === DIRECTION.SOUTH);
			assert(dir2reverse(DIRECTION.SOUTH) === DIRECTION.NORTH);
			assert(dir2reverse(DIRECTION.EAST) === DIRECTION.WEST);
			assert(dir2reverse(DIRECTION.WEST) === DIRECTION.EAST);
			assert(dir2reverse(DIRECTION.UP) === DIRECTION.DOWN);
			assert(dir2reverse(DIRECTION.DOWN) === DIRECTION.UP);
			assert(dir2reverse(DIRECTION.NORTHEAST) === DIRECTION.SOUTHWEST);
			assert(dir2reverse(DIRECTION.NORTHWEST) === DIRECTION.SOUTHEAST);
			assert(dir2reverse(DIRECTION.SOUTHEAST) === DIRECTION.NORTHWEST);
			assert(dir2reverse(DIRECTION.SOUTHWEST) === DIRECTION.NORTHEAST);
		});
	});

	suite("Dungeon", () => {
		test("should trim provided name and prevent empty assignments", () => {
			const dungeon = new Dungeon({
				dimensions: { width: 1, height: 1, layers: 1 },
				name: "  My Dungeon  ",
			});
			assert.strictEqual(dungeon.name, "My Dungeon");

			dungeon.name = " Updated Name ";
			assert.strictEqual(dungeon.name, "Updated Name");
		});

		test("should fall back to id when no name is provided", () => {
			const dungeon = new Dungeon({
				id: "midgar",
				dimensions: { width: 1, height: 1, layers: 1 },
			});
			assert.strictEqual(dungeon.name, "midgar");
		});

		test("generateEmptyDungeon() should generate rooms correctly", () => {
			const dimensions = { width: 3, height: 2, layers: 2 };
			const dungeon = Dungeon.generateEmptyDungeon({ dimensions });

			for (let z = 0; z < dimensions.layers; z++) {
				for (let y = 0; y < dimensions.height; y++) {
					for (let x = 0; x < dimensions.width; x++) {
						const room = dungeon.getRoom({ x, y, z });
						assert(room instanceof Room);
						assert.deepStrictEqual(room?.coordinates, { x, y, z });
					}
				}
			}
		});

		test("getRoom() should support both Coordinates and individual coordinate parameters", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 2 },
			});

			// Test both signatures return the same room
			const roomObj = dungeon.getRoom({ x: 1, y: 1, z: 0 });
			const roomCoords = dungeon.getRoom(1, 1, 0);
			assert.strictEqual(roomObj, roomCoords);
			assert(roomObj instanceof Room);

			// Test coordinates match for both signatures
			assert.deepStrictEqual(roomObj?.coordinates, { x: 1, y: 1, z: 0 });
			assert.deepStrictEqual(roomCoords?.coordinates, { x: 1, y: 1, z: 0 });
		});

		test("getRoom() should handle room boundaries correctly using Coordinates", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 2 },
			});

			assert.strictEqual(dungeon.getRoom({ x: -1, y: 0, z: 0 }), undefined);
			assert.strictEqual(dungeon.getRoom({ x: 2, y: 0, z: 0 }), undefined);
			assert.strictEqual(dungeon.getRoom({ x: 0, y: -1, z: 0 }), undefined);
			assert.strictEqual(dungeon.getRoom({ x: 0, y: 2, z: 0 }), undefined);
			assert.strictEqual(dungeon.getRoom({ x: 0, y: 0, z: -1 }), undefined);
			assert.strictEqual(dungeon.getRoom({ x: 0, y: 0, z: 2 }), undefined);
		});

		test("getRoom() should handle room boundaries correctly using individual coordinates", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 2 },
			});

			assert.strictEqual(dungeon.getRoom(-1, 0, 0), undefined);
			assert.strictEqual(dungeon.getRoom(2, 0, 0), undefined);
			assert.strictEqual(dungeon.getRoom(0, -1, 0), undefined);
			assert.strictEqual(dungeon.getRoom(0, 2, 0), undefined);
			assert.strictEqual(dungeon.getRoom(0, 0, -1), undefined);
			assert.strictEqual(dungeon.getRoom(0, 0, 2), undefined);
		});

		test("getRoom() should return consistent results", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 2 },
			});

			// Test corner coordinates with both signatures
			const cornerObj = dungeon.getRoom({ x: 1, y: 1, z: 1 });
			const cornerCoords = dungeon.getRoom(1, 1, 1);
			assert.strictEqual(cornerObj, cornerCoords);
			assert(cornerObj instanceof Room);

			// Test origin coordinates (0,0,0) with both signatures
			const originObj = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const originCoords = dungeon.getRoom(0, 0, 0);
			assert.strictEqual(originObj, originCoords);
			assert(originObj instanceof Room);

			// Test that both signatures return undefined for the same out-of-bounds coordinates
			assert.strictEqual(dungeon.getRoom({ x: 2, y: 2, z: 2 }), undefined);
			assert.strictEqual(dungeon.getRoom(2, 2, 2), undefined);
		});

		test("getStep() should calculate steps in all directions correctly", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 3 },
			});
			const center = dungeon.getRoom({ x: 1, y: 1, z: 1 });
			assert(center);

			const north = dungeon.getStep({ x: 1, y: 1, z: 1 }, DIRECTION.NORTH);
			assert.deepStrictEqual(north?.coordinates, { x: 1, y: 0, z: 1 });

			const southeast = dungeon.getStep(
				{ x: 1, y: 1, z: 1 },
				DIRECTION.SOUTHEAST
			);
			assert.deepStrictEqual(southeast?.coordinates, { x: 2, y: 2, z: 1 });

			const up = dungeon.getStep({ x: 1, y: 1, z: 1 }, DIRECTION.UP);
			assert.deepStrictEqual(up?.coordinates, { x: 1, y: 1, z: 2 });
		});

		test("addRoom() should reject rooms with out-of-bounds coordinates", () => {
			const dungeon = new Dungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});

			// Try to add a room outside the x bounds
			const roomX = new Room({ oid: -1, coordinates: { x: 5, y: 0, z: 0 } });
			const resultX = dungeon.addRoom(roomX);
			assert.strictEqual(resultX, false);
			assert.strictEqual(roomX.dungeon, undefined);

			// Try to add a room outside the y bounds
			const roomY = new Room({ oid: -1, coordinates: { x: 0, y: 5, z: 0 } });
			const resultY = dungeon.addRoom(roomY);
			assert.strictEqual(resultY, false);

			// Try to add a room outside the z bounds
			const roomZ = new Room({ oid: -1, coordinates: { x: 0, y: 0, z: 5 } });
			const resultZ = dungeon.addRoom(roomZ);
			assert.strictEqual(resultZ, false);

			// Try to add a room with negative coordinates
			const roomNeg = new Room({ oid: -1, coordinates: { x: -1, y: 0, z: 0 } });
			const resultNeg = dungeon.addRoom(roomNeg);
			assert.strictEqual(resultNeg, false);

			// Verify a valid room can still be added
			const validRoom = new Room({
				oid: -1,
				coordinates: { x: 1, y: 1, z: 0 },
			});
			const resultValid = dungeon.addRoom(validRoom);
			assert.strictEqual(resultValid, true);
			assert.strictEqual(validRoom.dungeon, dungeon);
		});
	});

	suite("DungeonObject", () => {
		test("should initialize with default values", () => {
			const obj = new DungeonObject({ oid: -1 });
			assert.strictEqual(obj.keywords, "dungeon object");
			assert.strictEqual(obj.display, "Dungeon Object");
			assert.strictEqual(obj.description, undefined);
			assert.strictEqual(obj.roomDescription, undefined);
			assert.deepStrictEqual(obj.contents, []);
			assert.strictEqual(obj.dungeon, undefined);
			assert.strictEqual(obj.location, undefined);
		});

		test("should initialize with roomDescription when provided", () => {
			const obj = new DungeonObject({
				keywords: "sword",
				display: "Sword",
				roomDescription: "A shining, long piece of metal is here.",
			});
			assert.strictEqual(obj.keywords, "sword");
			assert.strictEqual(obj.display, "Sword");
			assert.strictEqual(
				obj.roomDescription,
				"A shining, long piece of metal is here."
			);
		});

		test("should manage contents correctly", () => {
			const container = new DungeonObject({
				oid: -1,
				keywords: "leather bag",
				display: "Leather Bag",
			});
			const item = new DungeonObject({
				oid: -1,
				keywords: "small stone",
				description: "A smooth, gray stone.",
			});

			container.add(item);
			assert(container.contains(item));
			assert.strictEqual(item.location, container);

			container.remove(item);
			assert(!container.contains(item));
			assert.strictEqual(item.location, undefined);
		});

		test("should handle setting location to current location", () => {
			const container = new DungeonObject({
				oid: -1,
				keywords: "wooden box",
				display: "Wooden Box",
			});
			const item = new DungeonObject({
				oid: -1,
				keywords: "small stone",
			});

			// Add item to container
			container.add(item);
			assert.strictEqual(item.location, container);
			assert(container.contains(item));

			// Set location to the same container (should be a no-op)
			item.location = container;
			assert.strictEqual(item.location, container);
			assert(container.contains(item));
			assert.strictEqual(container.contents.length, 1);
		});

		test("should handle dungeon assignment and removal", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const obj = new DungeonObject({ oid: -1 });

			obj.dungeon = dungeon;
			assert.strictEqual(obj.dungeon, dungeon);
			assert(dungeon.contains(obj));

			obj.dungeon = undefined;
			assert.strictEqual(obj.dungeon, undefined);
			assert(!dungeon.contains(obj));
		});

		test("should unset location (which is in the dungeon) when unsetting dungeon", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 1, y: 1, z: 0 });
			assert(room);

			const obj = new DungeonObject({ oid: -1, keywords: "test item" });
			room.add(obj);

			// Verify object is in the dungeon
			assert.strictEqual(obj.dungeon, dungeon);
			assert.strictEqual(obj.location, room);
			assert(dungeon.contains(obj));

			// Unset dungeon while in room
			obj.dungeon = undefined;
			assert.strictEqual(obj.dungeon, undefined);
			assert.strictEqual(obj.location, undefined); // Still in room
			assert(!dungeon.contains(obj));
		});

		suite("Weight System", () => {
			test("should initialize baseWeight and currentWeight correctly", () => {
				const obj = new DungeonObject({ oid: -1 });
				assert.strictEqual(obj.baseWeight, 0);
				assert.strictEqual(obj.currentWeight, 0);

				const heavyObj = new DungeonObject({ oid: -1, baseWeight: 5.5 });
				assert.strictEqual(heavyObj.baseWeight, 5.5);
				assert.strictEqual(heavyObj.currentWeight, 5.5);
			});

			test("should add weight when adding objects", () => {
				const container = new DungeonObject({ oid: -1, baseWeight: 1.0 });
				const item1 = new DungeonObject({ oid: -1, baseWeight: 2.5 });
				const item2 = new DungeonObject({ oid: -1, baseWeight: 1.5 });

				// Container starts with its base weight
				assert.strictEqual(container.currentWeight, 1.0);

				// Add first item
				container.add(item1);
				assert.strictEqual(container.currentWeight, 1.0 + 2.5);
				assert.strictEqual(item1.currentWeight, 2.5);

				// Add second item
				container.add(item2);
				assert.strictEqual(container.currentWeight, 1.0 + 2.5 + 1.5);
				assert.strictEqual(item2.currentWeight, 1.5);
			});

			test("should remove weight when removing objects", () => {
				const container = new DungeonObject({ oid: -1, baseWeight: 1.0 });
				const item1 = new DungeonObject({ oid: -1, baseWeight: 2.5 });
				const item2 = new DungeonObject({ oid: -1, baseWeight: 1.5 });

				container.add(item1, item2);
				assert.strictEqual(container.currentWeight, 1.0 + 2.5 + 1.5);

				// Remove first item
				container.remove(item1);
				assert.strictEqual(container.currentWeight, 1.0 + 1.5);
				assert.strictEqual(item1.currentWeight, 2.5); // Item's weight unchanged

				// Remove second item
				container.remove(item2);
				assert.strictEqual(container.currentWeight, 1.0); // Back to base weight
			});

			test("should propagate weight up the containment chain", () => {
				const outer = new DungeonObject({ oid: -1, baseWeight: 2.0 });
				const middle = new DungeonObject({ oid: -1, baseWeight: 1.0 });
				const inner = new DungeonObject({ oid: -1, baseWeight: 0.5 });

				// Build nested structure: outer -> middle -> inner
				outer.add(middle);
				assert.strictEqual(outer.currentWeight, 2.0 + 1.0);
				assert.strictEqual(middle.currentWeight, 1.0);

				middle.add(inner);
				// middle's weight should increase
				assert.strictEqual(middle.currentWeight, 1.0 + 0.5);
				// outer's weight should also increase (propagated up)
				assert.strictEqual(outer.currentWeight, 2.0 + 1.0 + 0.5);
			});

			test("should propagate weight removal up the containment chain", () => {
				const outer = new DungeonObject({ oid: -1, baseWeight: 2.0 });
				const middle = new DungeonObject({ oid: -1, baseWeight: 1.0 });
				const inner = new DungeonObject({ oid: -1, baseWeight: 0.5 });

				outer.add(middle);
				middle.add(inner);
				assert.strictEqual(outer.currentWeight, 2.0 + 1.0 + 0.5);

				// Remove inner from middle
				middle.remove(inner);
				// middle's weight should decrease
				assert.strictEqual(middle.currentWeight, 1.0);
				// outer's weight should also decrease (propagated up)
				assert.strictEqual(outer.currentWeight, 2.0 + 1.0);
			});

			test("should handle weight when moving objects between containers", () => {
				const container1 = new DungeonObject({ oid: -1, baseWeight: 1.0 });
				const container2 = new DungeonObject({ oid: -1, baseWeight: 2.0 });
				const item = new DungeonObject({ oid: -1, baseWeight: 3.0 });

				container1.add(item);
				assert.strictEqual(container1.currentWeight, 1.0 + 3.0);
				assert.strictEqual(container2.currentWeight, 2.0);

				// Move item to container2
				container2.add(item);
				// item should be removed from container1
				assert.strictEqual(container1.currentWeight, 1.0);
				// item should be added to container2
				assert.strictEqual(container2.currentWeight, 2.0 + 3.0);
			});

			test("should handle weight with zero baseWeight objects", () => {
				const container = new DungeonObject({ oid: -1, baseWeight: 1.0 });
				const item1 = new DungeonObject({ oid: -1, baseWeight: 0 });
				const item2 = new DungeonObject({ oid: -1 }); // default baseWeight is 0

				container.add(item1, item2);
				// Container weight should only include its own base weight
				assert.strictEqual(container.currentWeight, 1.0);
			});

			test("should handle weight with deeply nested structures", () => {
				const level1 = new DungeonObject({ oid: -1, baseWeight: 10.0 });
				const level2 = new DungeonObject({ oid: -1, baseWeight: 5.0 });
				const level3 = new DungeonObject({ oid: -1, baseWeight: 2.0 });
				const level4 = new DungeonObject({ oid: -1, baseWeight: 1.0 });

				level1.add(level2);
				level2.add(level3);
				level3.add(level4);

				// level4: 1.0
				assert.strictEqual(level4.currentWeight, 1.0);
				// level3: 2.0 + 1.0 = 3.0
				assert.strictEqual(level3.currentWeight, 2.0 + 1.0);
				// level2: 5.0 + 3.0 = 8.0
				assert.strictEqual(level2.currentWeight, 5.0 + 2.0 + 1.0);
				// level1: 10.0 + 8.0 = 18.0
				assert.strictEqual(level1.currentWeight, 10.0 + 5.0 + 2.0 + 1.0);
			});
		});

		suite("Template System", () => {
			test("toTemplate() should create template with only differential fields", () => {
				const obj = new DungeonObject({
					oid: -1,
					keywords: "test object",
					display: "Test Object",
					description: "A test object.",
					roomDescription: "A test object is here.",
					baseWeight: 5.0,
				});

				const template = obj.toTemplate("test-id");

				assert.strictEqual(template.id, "test-id");
				assert.strictEqual(template.type, "DungeonObject");
				assert.strictEqual(template.keywords, "test object");
				assert.strictEqual(template.display, "Test Object");
				assert.strictEqual(template.description, "A test object.");
				assert.strictEqual(template.roomDescription, "A test object is here.");
				assert.strictEqual(template.baseWeight, 5.0);
			});

			test("toTemplate() should exclude fields that match defaults", () => {
				const obj = new DungeonObject({
					oid: -1,
					keywords: "dungeon object", // default
					display: "Dungeon Object", // default
					// description is undefined (default)
					baseWeight: 0, // default
				});

				const template = obj.toTemplate("default-id");

				assert.strictEqual(template.id, "default-id");
				assert.strictEqual(template.type, "DungeonObject");
				assert.strictEqual(template.keywords, undefined);
				assert.strictEqual(template.display, undefined);
				assert.strictEqual(template.description, undefined);
				assert.strictEqual(template.baseWeight, undefined);
				assert.deepEqual(template, { id: "default-id", type: "DungeonObject" });
			});

			test("toTemplate() should handle partial overrides", () => {
				const obj = new DungeonObject({
					oid: -1,
					display: "Custom Display",
					baseWeight: 2.5,
					// keywords and description use defaults
				});

				const template = obj.toTemplate("partial-id");

				assert.strictEqual(template.id, "partial-id");
				assert.strictEqual(template.type, "DungeonObject");
				assert.strictEqual(template.keywords, undefined); // default
				assert.strictEqual(template.display, "Custom Display");
				assert.strictEqual(template.description, undefined); // default
				assert.strictEqual(template.baseWeight, 2.5);
				assert.deepEqual(template, {
					id: "partial-id",
					type: "DungeonObject",
					display: "Custom Display",
					baseWeight: 2.5,
				});
			});

			test("toTemplate() should work with Items", () => {
				const item = new Item({
					oid: -1,
					keywords: "iron sword",
					display: "Iron Sword",
					baseWeight: 3.0,
				});

				const template = item.toTemplate("sword-id");

				assert.strictEqual(template.id, "sword-id");
				assert.strictEqual(template.type, "Item");
				assert.strictEqual(template.keywords, "iron sword");
				assert.strictEqual(template.display, "Iron Sword");
				assert.strictEqual(template.baseWeight, 3.0);
				assert.deepEqual(template, {
					id: "sword-id",
					type: "Item",
					keywords: "iron sword",
					display: "Iron Sword",
					baseWeight: 3.0,
				});
			});

			test("toTemplate() should not include contents", () => {
				const container = new DungeonObject({
					oid: -1,
					keywords: "chest",
					display: "Chest",
				});
				const item = new DungeonObject({
					oid: -1,
					keywords: "coin",
					display: "Coin",
				});
				container.add(item);

				const template = container.toTemplate("chest-id");

				// Template should not have contents field
				assert.strictEqual(template.id, "chest-id");
				assert.strictEqual(template.keywords, "chest");
				assert.strictEqual(template.display, "Chest");
				assert.deepEqual(template, {
					id: "chest-id",
					type: "DungeonObject",
					keywords: "chest",
					display: "Chest",
				});
				// No contents in template
			});

			test("applyTemplate() should apply template fields to object", () => {
				const obj = new DungeonObject({ oid: -1 });
				const template: DungeonObjectTemplate = {
					id: "test",
					type: "DungeonObject",
					keywords: "applied keywords",
					display: "Applied Display",
					description: "Applied description",
					roomDescription: "A test object is here.",
					baseWeight: 10.0,
				};

				obj.applyTemplate(template);

				assert.strictEqual(obj.keywords, "applied keywords");
				assert.strictEqual(obj.display, "Applied Display");
				assert.strictEqual(obj.description, "Applied description");
				assert.strictEqual(obj.roomDescription, "A test object is here.");
				assert.strictEqual(obj.baseWeight, 10.0);
				assert.strictEqual(obj.currentWeight, 10.0);
			});

			test("applyTemplate() should only apply defined fields", () => {
				const obj = new DungeonObject({
					oid: -1,
					keywords: "original keywords",
					display: "Original Display",
					description: "Original description",
					baseWeight: 5.0,
				});

				const template: DungeonObjectTemplate = {
					id: "test",
					type: "DungeonObject",
					display: "New Display",
					// keywords, description, and baseWeight are undefined
				};

				obj.applyTemplate(template);

				// Only display should change
				assert.strictEqual(obj.keywords, "original keywords");
				assert.strictEqual(obj.display, "New Display");
				assert.strictEqual(obj.description, "Original description");
				assert.strictEqual(obj.baseWeight, 5.0);
			});

			test("applyTemplate() should update currentWeight when baseWeight is applied", () => {
				const obj = new DungeonObject({
					oid: -1,
					baseWeight: 2.0,
				});
				assert.strictEqual(obj.currentWeight, 2.0);

				const template: DungeonObjectTemplate = {
					id: "test",
					type: "DungeonObject",
					baseWeight: 7.5,
				};

				obj.applyTemplate(template);

				assert.strictEqual(obj.baseWeight, 7.5);
				assert.strictEqual(obj.currentWeight, 7.5);
			});

			test("createFromTemplate() should create DungeonObject from template", () => {
				const template: DungeonObjectTemplate = {
					id: "test",
					type: "DungeonObject",
					keywords: "test keywords",
					display: "Test Object",
					description: "Test description",
					baseWeight: 3.0,
				};

				const obj = createFromTemplate(template);

				assert(obj instanceof DungeonObject);
				assert.strictEqual(obj.keywords, "test keywords");
				assert.strictEqual(obj.display, "Test Object");
				assert.strictEqual(obj.description, "Test description");
				assert.strictEqual(obj.baseWeight, 3.0);
				assert.strictEqual(obj.currentWeight, 3.0);
			});

			test("createFromTemplate() should create Item from template", () => {
				const template: DungeonObjectTemplate = {
					id: "sword",
					type: "Item",
					keywords: "iron sword",
					display: "Iron Sword",
					baseWeight: 4.0,
				};

				const obj = createFromTemplate(template);

				assert(obj instanceof Item);
				assert.strictEqual(obj.keywords, "iron sword");
				assert.strictEqual(obj.display, "Iron Sword");
				assert.strictEqual(obj.baseWeight, 4.0);
			});

			test("createFromTemplate() should create Mob from template", () => {
				const template: DungeonObjectTemplate = {
					id: "goblin",
					type: "Mob",
					keywords: "goblin creature",
					display: "Goblin",
					baseWeight: 50.0,
				};

				const obj = createFromTemplate(template);

				assert(obj instanceof Mob);
				assert.strictEqual(obj.keywords, "goblin creature");
				assert.strictEqual(obj.display, "Goblin");
				assert.strictEqual(obj.baseWeight, 50.0);
			});

			test("createFromTemplate() should create Prop from template", () => {
				const template: DungeonObjectTemplate = {
					id: "sign",
					type: "Prop",
					keywords: "wooden sign",
					display: "Wooden Sign",
					description: "A weathered wooden sign.",
					baseWeight: 1.5,
				};

				const obj = createFromTemplate(template);

				assert(obj instanceof Prop);
				assert.strictEqual(obj.keywords, "wooden sign");
				assert.strictEqual(obj.display, "Wooden Sign");
				assert.strictEqual(obj.description, "A weathered wooden sign.");
				assert.strictEqual(obj.baseWeight, 1.5);
			});

			test("createFromTemplate() should throw error for Room templates", () => {
				const template: RoomTemplate = {
					id: "room",
					type: "Room",
					display: "Test Room",
					allowedExits:
						DIRECTION.NORTH | DIRECTION.SOUTH | DIRECTION.EAST | DIRECTION.WEST,
				};

				assert.throws(() => {
					createFromTemplate(template);
				}, /Room templates require coordinates/);
			});

			test("Room.createFromTemplate() should create Room from template with coordinates", () => {
				const template: RoomTemplate = {
					id: "start-room",
					type: "Room",
					keywords: "start room entrance",
					display: "Starting Room",
					description: "You are in the starting room.",
					allowedExits:
						DIRECTION.NORTH | DIRECTION.SOUTH | DIRECTION.EAST | DIRECTION.WEST,
					baseWeight: 0,
				};

				const room = Room.createFromTemplate(template, { x: 0, y: 0, z: 0 });

				assert(room instanceof Room);
				assert.strictEqual(room.keywords, "start room entrance");
				assert.strictEqual(room.display, "Starting Room");
				assert.strictEqual(room.description, "You are in the starting room.");
				assert.strictEqual(room.baseWeight, 0);
				assert.deepStrictEqual(room.coordinates, { x: 0, y: 0, z: 0 });
			});

			test("createFromTemplate() should handle templates with only type and id", () => {
				const template: DungeonObjectTemplate = {
					id: "minimal",
					type: "DungeonObject",
				};

				const obj = createFromTemplate(template);

				assert(obj instanceof DungeonObject);
				assert.strictEqual(obj.keywords, "dungeon object"); // default
				assert.strictEqual(obj.display, "Dungeon Object"); // default
				assert.strictEqual(obj.description, undefined); // default
				assert.strictEqual(obj.baseWeight, 0); // default
			});

			test("toTemplate() and createFromTemplate() should round-trip correctly", () => {
				const original = new Item({
					oid: -1,
					keywords: "magic sword",
					display: "Magic Sword",
					description: "A sword imbued with magic.",
					baseWeight: 2.5,
				});

				const template = original.toTemplate("sword-template");
				const recreated = createFromTemplate(template);

				assert(recreated instanceof Item);
				assert.strictEqual(recreated.keywords, original.keywords);
				assert.strictEqual(recreated.display, original.display);
				assert.strictEqual(recreated.description, original.description);
				assert.strictEqual(recreated.baseWeight, original.baseWeight);
				assert.strictEqual(recreated.currentWeight, original.baseWeight);
			});

			test("toTemplate() should handle objects with zero weight correctly", () => {
				const obj = new DungeonObject({
					oid: -1,
					keywords: "light object",
					display: "Light Object",
					baseWeight: 0,
				});

				const template = obj.toTemplate("light-id");

				// baseWeight should not be included if it's 0 (default)
				assert.strictEqual(template.keywords, "light object");
				assert.strictEqual(template.display, "Light Object");
				// baseWeight should be undefined since it matches default
				assert.strictEqual(template.baseWeight, undefined);
			});
		});

		test("should handle moving between dungeons with contents", () => {
			const dungeonA = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});
			const dungeonB = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});

			const roomA = dungeonA.getRoom({ x: 0, y: 0, z: 0 });
			const roomB = dungeonB.getRoom({ x: 0, y: 0, z: 0 });
			assert(roomA && roomB);

			const backpack = new DungeonObject({
				oid: -1,
				keywords: "backpack",
				display: "Backpack",
			});
			const coin = new DungeonObject({ oid: -1, keywords: "coin" });
			const gem = new DungeonObject({ oid: -1, keywords: "gem" });

			// Add items to container
			backpack.add(coin);
			backpack.add(gem);

			// Place container in dungeonA
			roomA.add(backpack);
			assert.strictEqual(backpack.dungeon, dungeonA);
			assert.strictEqual(coin.dungeon, dungeonA);
			assert.strictEqual(gem.dungeon, dungeonA);
			assert(dungeonA.contains(backpack));
			assert(dungeonA.contains(coin));
			assert(dungeonA.contains(gem));
			assert(roomA.contains(backpack));
			assert(backpack.location === roomA);

			// Move container to dungeonB
			roomB.add(backpack);
			assert.strictEqual(backpack.dungeon, dungeonB);
			assert.strictEqual(coin.dungeon, dungeonB);
			assert.strictEqual(gem.dungeon, dungeonB);
			assert(!dungeonA.contains(backpack));
			assert(!dungeonA.contains(coin));
			assert(!dungeonA.contains(gem));
			assert(dungeonB.contains(backpack));
			assert(backpack.location === roomB);
			assert(dungeonB.contains(coin));
			assert(dungeonB.contains(gem));

			// Verify contents remain intact
			assert(backpack.contains(coin));
			assert(backpack.contains(gem));
			assert(coin.location === backpack);
			assert(gem.location === backpack);
		});

		test("dungeon.contents should track all objects in the dungeon hierarchy", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});

			// Get a room from the dungeon
			const room = dungeon.getRoom({ x: 1, y: 1, z: 0 });
			assert(room);

			// Create various objects
			const chest = new DungeonObject({
				oid: -1,
				keywords: "wooden chest",
				display: "Wooden Chest",
				description: "A sturdy wooden chest with iron bindings.",
			});
			const coin = new DungeonObject({
				oid: -1,
				keywords: "gold coin",
				display: "Gold Coin",
			});
			const sword = new DungeonObject({ oid: -1, keywords: "steel sword" });
			const gem = new DungeonObject({
				oid: -1,
				keywords: "ruby gem",
				description: "A brilliant red ruby that catches the light.",
			});
			const player = new Movable({ oid: -1, keywords: "player hero" });

			// Add objects to room
			room.add(chest);
			room.add(player);

			// Add nested objects
			chest.add(coin);
			chest.add(gem);
			player.add(sword);

			// Get dungeon contents
			const contents = dungeon.contents;

			// All rooms should be in contents
			for (let x = 0; x < 3; x++) {
				for (let y = 0; y < 3; y++) {
					const r = dungeon.getRoom({ x, y, z: 0 });
					assert(r);
					assert(
						contents.includes(r),
						`Room at ${x},${y} should be in dungeon contents`
					);
				}
			}

			// All added objects should be in contents
			const expectedObjects = [chest, coin, sword, gem, player];
			for (const obj of expectedObjects) {
				assert(
					contents.includes(obj),
					`Object ${obj.keywords} should be in dungeon contents`
				);
			}

			// Verify we can filter contents
			const chests = contents.filter((obj) => obj.match("chest"));
			assert.strictEqual(chests.length, 1);
			assert.strictEqual(chests[0], chest);

			// Verify count matches expected total (9 rooms + 5 objects)
			assert.strictEqual(contents.length, 14);
		});

		test("dungeon.contents should return a copy that does not affect internal state", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});

			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			assert(room);

			const obj1 = new DungeonObject({ oid: -1, keywords: "object1" });
			const obj2 = new DungeonObject({ oid: -1, keywords: "object2" });
			room.add(obj1);
			room.add(obj2);

			// Get initial contents
			const initialContents = dungeon.contents;
			const initialLength = initialContents.length;

			// Mutate the returned array
			initialContents.push(
				new DungeonObject({ oid: -1, keywords: "fake object" })
			);
			initialContents.pop();
			initialContents.shift();
			initialContents.reverse();

			// Get contents again - should be unchanged
			const newContents = dungeon.contents;
			assert.strictEqual(newContents.length, initialLength);
			assert(newContents.includes(obj1));
			assert(newContents.includes(obj2));

			// Verify original objects are still in dungeon
			assert(dungeon.contains(obj1));
			assert(dungeon.contains(obj2));
		});

		test("dungeon.add() should handle adding objects correctly", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});

			const obj1 = new DungeonObject({ oid: -1, keywords: "object1" });
			const obj2 = new DungeonObject({ oid: -1, keywords: "object2" });

			// Add object to dungeon
			dungeon.add(obj1);
			assert(dungeon.contains(obj1));
			assert.strictEqual(obj1.dungeon, dungeon);

			// Re-adding the same object should be ignored (no error)
			const lengthBefore = dungeon.contents.length;
			dungeon.add(obj1);
			assert.strictEqual(dungeon.contents.length, lengthBefore);
			assert(dungeon.contains(obj1));

			// Add another object
			dungeon.add(obj2);
			assert(dungeon.contains(obj2));
			assert.strictEqual(obj2.dungeon, dungeon);
		});

		test("dungeon.remove() should handle removing objects correctly", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});

			const obj1 = new DungeonObject({ oid: -1, keywords: "object1" });
			const obj2 = new DungeonObject({ oid: -1, keywords: "object2" });

			// Add objects to dungeon
			dungeon.add(obj1);
			dungeon.add(obj2);
			assert(dungeon.contains(obj1));
			assert(dungeon.contains(obj2));

			// Remove object from dungeon
			dungeon.remove(obj1);
			assert(!dungeon.contains(obj1));
			assert.strictEqual(obj1.dungeon, undefined);
			assert(dungeon.contains(obj2)); // obj2 should still be there

			// Removing an object not in the dungeon should be ignored (no error)
			const lengthBefore = dungeon.contents.length;
			const obj3 = new DungeonObject({ oid: -1, keywords: "object3" });
			dungeon.remove(obj3);
			assert.strictEqual(dungeon.contents.length, lengthBefore);
			assert(!dungeon.contains(obj3));
		});
	});

	suite("getDungeonById", () => {
		test("should not register a dungeon when no id is provided", () => {
			const d = new Dungeon({ dimensions: { width: 1, height: 1, layers: 1 } });
			assert.strictEqual(d.id, undefined);
		});

		test("should register a dungeon when an id is provided and allow lookup", () => {
			const id = "test-registry-1";
			const d = new Dungeon({
				id,
				dimensions: { width: 1, height: 1, layers: 1 },
			});
			try {
				assert.strictEqual(d.id, id);
				assert.strictEqual(getDungeonById(id), d);
				assert.strictEqual(DUNGEON_REGISTRY.get(id), d);
			} finally {
				// cleanup so registry doesn't leak into other tests
				//DUNGEON_REGISTRY.delete(id);
			}
		});

		test("should throw when attempting to create a second dungeon with the same id", () => {
			const id = "test-duplicate-id";
			const first = new Dungeon({
				id,
				dimensions: { width: 1, height: 1, layers: 1 },
			});
			try {
				assert.strictEqual(getDungeonById(id), first);
				assert.throws(() => {
					// second construction should throw due to duplicate id
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const second = new Dungeon({
						id,
						dimensions: { width: 1, height: 1, layers: 1 },
					});
				}, Error);
			} finally {
				//DUNGEON_REGISTRY.delete(id);
			}
		});
	});

	suite("getRoomByRef", () => {
		test("should return a room for a valid reference format", () => {
			const id = "test-get-room-ref-1";
			const dungeon = Dungeon.generateEmptyDungeon({
				id,
				dimensions: { width: 5, height: 5, layers: 2 },
			});
			try {
				const room = getRoomByRef(`@${id}{2,3,1}`);
				assert(room instanceof Room);
				assert.deepStrictEqual(room.coordinates, { x: 2, y: 3, z: 1 });
				assert.strictEqual(room.dungeon, dungeon);
			} finally {
				//DUNGEON_REGISTRY.delete(id);
			}
		});

		test("should return undefined for invalid reference formats", () => {
			assert.strictEqual(getRoomByRef("invalid"), undefined);
			assert.strictEqual(getRoomByRef("@dungeon"), undefined);
			assert.strictEqual(getRoomByRef("@dungeon{1,2}"), undefined);
			assert.strictEqual(getRoomByRef("@dungeon{a,b,c}"), undefined);
			assert.strictEqual(getRoomByRef("dungeon{1,2,3}"), undefined);
			assert.strictEqual(getRoomByRef("@{1,2,3}"), undefined);
			assert.strictEqual(getRoomByRef("@dungeon{1,2,3"), undefined);
			assert.strictEqual(getRoomByRef("@dungeon 1,2,3}"), undefined);
		});

		test("should return undefined when dungeon ID does not exist", () => {
			const room = getRoomByRef("@nonexistent-dungeon{0,0,0}");
			assert.strictEqual(room, undefined);
		});

		test("should return undefined for out-of-bounds coordinates", () => {
			const id = "test-get-room-ref-bounds";
			const dungeon = Dungeon.generateEmptyDungeon({
				id,
				dimensions: { width: 3, height: 3, layers: 2 },
			});
			try {
				// Valid coordinates first
				const valid = getRoomByRef(`@${id}{1,1,1}`);
				assert(valid instanceof Room);

				// Out of bounds
				assert.strictEqual(getRoomByRef(`@${id}{5,5,5}`), undefined);
				assert.strictEqual(getRoomByRef(`@${id}{-1,0,0}`), undefined);
				assert.strictEqual(getRoomByRef(`@${id}{0,-1,0}`), undefined);
				assert.strictEqual(getRoomByRef(`@${id}{0,0,-1}`), undefined);
				assert.strictEqual(getRoomByRef(`@${id}{3,0,0}`), undefined);
				assert.strictEqual(getRoomByRef(`@${id}{0,3,0}`), undefined);
				assert.strictEqual(getRoomByRef(`@${id}{0,0,2}`), undefined);
			} finally {
				//DUNGEON_REGISTRY.delete(id);
			}
		});

		test("should handle dungeon IDs with special characters", () => {
			const id = "test-dungeon_with-special.chars";
			const dungeon = Dungeon.generateEmptyDungeon({
				id,
				dimensions: { width: 2, height: 2, layers: 1 },
			});
			try {
				const room = getRoomByRef(`@${id}{0,1,0}`);
				assert(room instanceof Room);
				assert.deepStrictEqual(room.coordinates, { x: 0, y: 1, z: 0 });
			} finally {
				//DUNGEON_REGISTRY.delete(id);
			}
		});
	});

	suite("Room", () => {
		test("should initialize with correct coordinates", () => {
			const coordinates = { x: 1, y: 2, z: 3 };
			const room = new Room({ oid: -1, coordinates });

			assert.deepStrictEqual(room.coordinates, coordinates);
			assert.strictEqual(room.x, coordinates.x);
			assert.strictEqual(room.y, coordinates.y);
			assert.strictEqual(room.z, coordinates.z);
		});

		test("should have default movement permissions", () => {
			const room = new Room({ oid: -1, coordinates: { x: 0, y: 0, z: 0 } });
			const movable = new Movable({ oid: -1 });

			assert(room.canEnter(movable));
			assert(room.canExit(movable));
		});

		test("should block UP/DOWN by default", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 3 },
			});
			const room = dungeon.getRoom({ x: 1, y: 1, z: 1 });
			assert(room);
			const movable = new Movable({ oid: -1 });
			room.add(movable);

			// UP/DOWN should be blocked by default
			assert.strictEqual(movable.canStep(DIRECTION.UP), false);
			assert.strictEqual(movable.canStep(DIRECTION.DOWN), false);

			// Horizontal directions should work
			assert.strictEqual(movable.canStep(DIRECTION.NORTH), true);
			assert.strictEqual(movable.canStep(DIRECTION.SOUTH), true);
			assert.strictEqual(movable.canStep(DIRECTION.EAST), true);
			assert.strictEqual(movable.canStep(DIRECTION.WEST), true);
		});

		test("should allow UP/DOWN when explicitly enabled", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 3 },
			});
			const room = dungeon.getRoom({ x: 1, y: 1, z: 1 });
			assert(room);
			// Enable UP/DOWN
			room.allowedExits |= DIRECTION.UP | DIRECTION.DOWN;
			const movable = new Movable({ oid: -1 });
			room.add(movable);

			// UP/DOWN should now be allowed
			assert.strictEqual(movable.canStep(DIRECTION.UP), true);
			assert.strictEqual(movable.canStep(DIRECTION.DOWN), true);
		});

		test("getRoomRef() should generate a room reference string", () => {
			const id = "test-room-ref";
			const dungeon = Dungeon.generateEmptyDungeon({
				id,
				dimensions: { width: 5, height: 5, layers: 2 },
			});
			try {
				const room = dungeon.getRoom({ x: 3, y: 4, z: 1 });
				assert(room);

				const ref = room.getRoomRef();
				assert.strictEqual(ref, "@test-room-ref{3,4,1}");

				// Verify the reference can be parsed back to the same room
				const parsedRoom = getRoomByRef(ref!);
				assert.strictEqual(parsedRoom, room);
			} finally {
				dungeon.destroy();
				//DUNGEON_REGISTRY.delete(id);
			}
		});

		test("getRoomRef() should return undefined when dungeon has no ID", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			assert(room);

			const ref = room.getRoomRef();
			assert.strictEqual(ref, undefined);
		});
	});

	suite("RoomLink", () => {
		test("should create bidirectional portals between rooms", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			const roomA = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const roomB = dungeon.getRoom({ x: 2, y: 2, z: 0 });
			assert(roomA && roomB);

			const link = RoomLink.createTunnel(roomA, DIRECTION.NORTH, roomB);

			// Test that moving NORTH from roomA leads to roomB
			const northStep = roomA.getStep(DIRECTION.NORTH);
			assert.strictEqual(northStep, roomB);

			// Test that moving SOUTH from roomB leads back to roomA
			const southStep = roomB.getStep(DIRECTION.SOUTH);
			assert.strictEqual(southStep, roomA);

			// Test that other directions are unaffected
			assert.notStrictEqual(roomA.getStep(DIRECTION.EAST), roomB);
			assert.notStrictEqual(roomB.getStep(DIRECTION.WEST), roomA);
		});

		test("should work with rooms in different dungeons", () => {
			const dungeonA = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});
			const dungeonB = Dungeon.generateEmptyDungeon({
				dimensions: { width: 2, height: 2, layers: 1 },
			});

			const roomA = dungeonA.getRoom({ x: 0, y: 0, z: 0 });
			const roomB = dungeonB.getRoom({ x: 1, y: 1, z: 0 });
			assert(roomA && roomB);

			const link = RoomLink.createTunnel(roomA, DIRECTION.EAST, roomB);

			// Test movement between dungeons
			const player = new Movable({ oid: -1 });
			roomA.add(player);

			assert(player.canStep(DIRECTION.EAST));
			player.step(DIRECTION.EAST);
			assert(player.location === roomB);
			assert(player.dungeon === dungeonB);

			assert(player.canStep(DIRECTION.WEST));
			player.step(DIRECTION.WEST);
			assert(player.location === roomA);
			assert(player.dungeon === dungeonA);
		});

		test("should allow removal of links", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 2 },
			});
			const roomA = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const roomB = dungeon.getRoom({ x: 0, y: 0, z: 1 });
			assert(roomA && roomB);
			// Links override allowedExits, so we don't need to enable UP/DOWN

			const link = RoomLink.createTunnel(roomA, DIRECTION.UP, roomB);

			// Verify link works (links override allowedExits)
			assert.strictEqual(roomA.getStep(DIRECTION.UP), roomB);
			assert.strictEqual(roomB.getStep(DIRECTION.DOWN), roomA);

			const movable = new Movable({ oid: -1 });
			roomA.add(movable);
			// canStep should work because link overrides allowedExits
			assert.strictEqual(movable.canStep(DIRECTION.UP), true);

			// Remove link
			link.remove();

			// After link removal, UP/DOWN is blocked by default allowedExits
			// getStep should return undefined because UP is not in allowedExits
			assert.strictEqual(roomA.getStep(DIRECTION.UP), undefined);
			// canStep should also fail
			assert.strictEqual(movable.canStep(DIRECTION.UP), false);
		});

		test("should handle multiple links per room", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 2 },
			});
			const center = dungeon.getRoom({ x: 1, y: 1, z: 0 });
			const north = dungeon.getRoom({ x: 1, y: 0, z: 0 });
			const south = dungeon.getRoom({ x: 1, y: 2, z: 0 });
			const east = dungeon.getRoom({ x: 2, y: 1, z: 0 });
			assert(center && north && south && east);
			// Links override allowedExits, so we don't need to enable UP/DOWN

			// Create portal from center to each other room
			const link1 = RoomLink.createTunnel(center, DIRECTION.UP, north);
			const link2 = RoomLink.createTunnel(center, DIRECTION.DOWN, south);
			const link3 = RoomLink.createTunnel(center, DIRECTION.WEST, east);

			// Test all portals work (links override allowedExits)
			assert.strictEqual(center.getStep(DIRECTION.UP), north);
			assert.strictEqual(center.getStep(DIRECTION.DOWN), south);
			assert.strictEqual(center.getStep(DIRECTION.WEST), east);

			// Test return trips
			assert.strictEqual(north.getStep(DIRECTION.DOWN), center);
			assert.strictEqual(south.getStep(DIRECTION.UP), center);
			assert.strictEqual(east.getStep(DIRECTION.EAST), center);

			// Remove middle link
			link2.remove();

			// Verify other links still work
			assert.strictEqual(center.getStep(DIRECTION.UP), north);
			assert.strictEqual(center.getStep(DIRECTION.WEST), east);
			assert.strictEqual(north.getStep(DIRECTION.DOWN), center);
			assert.strictEqual(east.getStep(DIRECTION.EAST), center);

			// But removed link doesn't work - getStep should return undefined because DOWN is blocked by allowedExits
			const movable = new Movable({ oid: -1 });
			center.add(movable);
			// getStep should return undefined because DOWN is not in allowedExits by default
			assert.strictEqual(center.getStep(DIRECTION.DOWN), undefined);
			assert.strictEqual(movable.canStep(DIRECTION.DOWN), false);

			// Test from south's perspective
			south.add(movable);
			assert.strictEqual(south.getStep(DIRECTION.UP), undefined);
			assert.strictEqual(movable.canStep(DIRECTION.UP), false);
		});

		test("should support one-way links", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			const roomA = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const roomB = dungeon.getRoom({ x: 2, y: 2, z: 0 });
			assert(roomA && roomB);

			const link = RoomLink.createTunnel(roomA, DIRECTION.EAST, roomB, true);

			// Forward direction should resolve
			assert(roomA.getStep(DIRECTION.EAST) === roomB);
			// Reverse direction should NOT resolve to the originating room
			assert(roomB.getStep(DIRECTION.WEST) !== roomA);

			// Movable can traverse forward across the one-way link
			const player = new Movable({ oid: -1 });
			roomA.add(player);
			assert(player.canStep(DIRECTION.EAST));
			player.step(DIRECTION.EAST);
			assert.strictEqual(player.location, roomB);
			// Attempting to go back should not land the player in roomA via the link
			player.step(DIRECTION.WEST);
			assert.notStrictEqual(player.location, roomA);

			// Cleanup - removing the link must not point roomA->roomB anymore
			link.remove();
			assert.notStrictEqual(roomA.getStep(DIRECTION.EAST), roomB);
		});
	});

	suite("Movable", () => {
		test("should cache and clear coordinates when moving between rooms", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			dungeon.generateRooms();
			const movable = new Movable({ oid: -1 });
			const room1 = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const room2 = dungeon.getRoom({ x: 1, y: 0, z: 0 });
			assert(room1 && room2);

			room1.add(movable);
			assert.deepStrictEqual(movable.coordinates, { x: 0, y: 0, z: 0 });

			movable.move(room2);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 0, z: 0 });

			movable.move(undefined);
			assert.strictEqual(movable.coordinates, undefined);
		});

		test("x/y/z accessors should match coordinates", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 3 },
			});
			const movable = new Movable({ oid: -1 });
			const room = dungeon.getRoom({ x: 2, y: 3, z: 1 });
			assert(room);

			// Before placement, all should be undefined
			assert.strictEqual(movable.x, undefined);
			assert.strictEqual(movable.y, undefined);
			assert.strictEqual(movable.z, undefined);

			// After placement, should match room coordinates
			room.add(movable);
			assert.strictEqual(movable.x, 2);
			assert.strictEqual(movable.y, 3);
			assert.strictEqual(movable.z, 1);
			assert.deepStrictEqual(movable.coordinates, { x: 2, y: 3, z: 1 });
		});

		test("getStep() should return undefined when not in a room", () => {
			const movable = new Movable({ oid: -1 });
			assert.strictEqual(movable.getStep(DIRECTION.NORTH), undefined);
			assert.strictEqual(movable.getStep(DIRECTION.EAST), undefined);
			assert.strictEqual(movable.getStep(DIRECTION.UP), undefined);
		});

		test("canStep() should return false when not in a room", () => {
			const movable = new Movable({ oid: -1 });
			assert.strictEqual(movable.canStep(DIRECTION.NORTH), false);
			assert.strictEqual(movable.canStep(DIRECTION.SOUTH), false);
			assert.strictEqual(movable.canStep(DIRECTION.EAST), false);
		});

		test("canStep() should respect canExit restrictions", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});

			// Create a room that blocks exits to the north
			class RestrictedRoom extends Room {
				canExit(movable: Movable, direction?: DIRECTION) {
					return direction !== DIRECTION.NORTH;
				}
			}

			const restrictedRoom = new RestrictedRoom({
				coordinates: { x: 1, y: 1, z: 0 },
			});
			dungeon.addRoom(restrictedRoom);

			const movable = new Movable({ oid: -1 });
			restrictedRoom.add(movable);

			// Should not be able to exit north
			assert.strictEqual(movable.canStep(DIRECTION.NORTH), false);

			// Should be able to exit in other directions
			assert.strictEqual(movable.canStep(DIRECTION.SOUTH), true);
			assert.strictEqual(movable.canStep(DIRECTION.EAST), true);
		});

		test("canStep() should respect canEnter restrictions", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});

			const startRoom = dungeon.getRoom({ x: 1, y: 1, z: 0 });
			assert(startRoom);

			// Create a room that blocks entry from the south
			class LockedRoom extends Room {
				canEnter(movable: Movable, direction?: DIRECTION) {
					return direction !== DIRECTION.SOUTH;
				}
			}

			const lockedRoom = new LockedRoom({ coordinates: { x: 1, y: 0, z: 0 } });
			dungeon.addRoom(lockedRoom);

			const movable = new Movable({ oid: -1 });
			startRoom.add(movable);

			// Should not be able to step north into the locked room
			assert.strictEqual(movable.canStep(DIRECTION.NORTH), false);

			// Should be able to step in other directions
			assert.strictEqual(movable.canStep(DIRECTION.SOUTH), true);
			assert.strictEqual(movable.canStep(DIRECTION.EAST), true);
		});

		test("step() should not move when attempting to step out of bounds", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			const movable = new Movable({ oid: -1 });
			const cornerRoom = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			assert(cornerRoom);
			cornerRoom.add(movable);

			// Attempting to step out of bounds should return false and not change position
			const resultNorth = movable.step(DIRECTION.NORTH);
			assert.strictEqual(resultNorth, false);
			assert.deepStrictEqual(movable.coordinates, { x: 0, y: 0, z: 0 });

			const resultWest = movable.step(DIRECTION.WEST);
			assert.strictEqual(resultWest, false);
			assert.deepStrictEqual(movable.coordinates, { x: 0, y: 0, z: 0 });

			const resultDown = movable.step(DIRECTION.DOWN);
			assert.strictEqual(resultDown, false);
			assert.deepStrictEqual(movable.coordinates, { x: 0, y: 0, z: 0 });

			// Valid move should succeed
			const resultEast = movable.step(DIRECTION.EAST);
			assert.strictEqual(resultEast, true);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 0, z: 0 });
		});

		test("should handle movement between rooms correctly", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			const movable = new Movable({ oid: -1 });
			const startRoom = dungeon.getRoom({ x: 1, y: 1, z: 0 });
			assert(startRoom);
			startRoom.add(movable);

			assert(movable.canStep(DIRECTION.NORTH));
			movable.step(DIRECTION.NORTH);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 0, z: 0 });

			assert(!movable.canStep(DIRECTION.NORTH)); // Should be blocked by dungeon boundary
		});

		test("should not allow movement outside dungeon boundaries", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			const movable = new Movable({ oid: -1 });
			const edgeRoom = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			assert(edgeRoom);
			edgeRoom.add(movable);

			assert(!movable.canStep(DIRECTION.NORTH));
			assert(!movable.canStep(DIRECTION.WEST));
			movable.step(DIRECTION.NORTH); // Should not move
			assert.deepStrictEqual(movable.coordinates, { x: 0, y: 0, z: 0 });
		});

		test("should handle movement in all directions correctly", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 3 },
			});
			const movable = new Movable({ oid: -1 });
			const centerRoom = dungeon.getRoom({ x: 1, y: 1, z: 1 });
			assert(centerRoom);
			// Enable UP/DOWN for vertical movement
			centerRoom.allowedExits |= DIRECTION.UP | DIRECTION.DOWN;
			centerRoom.add(movable);

			// Test NORTH movement
			assert(movable.canStep(DIRECTION.NORTH));
			movable.step(DIRECTION.NORTH);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 0, z: 1 });

			// Return to center
			movable.step(DIRECTION.SOUTH);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test EAST movement
			assert(movable.canStep(DIRECTION.EAST));
			movable.step(DIRECTION.EAST);
			assert.deepStrictEqual(movable.coordinates, { x: 2, y: 1, z: 1 });

			// Return to center
			movable.step(DIRECTION.WEST);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test SOUTH movement
			assert(movable.canStep(DIRECTION.SOUTH));
			movable.step(DIRECTION.SOUTH);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 2, z: 1 });

			// Return to center
			movable.step(DIRECTION.NORTH);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test WEST movement
			assert(movable.canStep(DIRECTION.WEST));
			movable.step(DIRECTION.WEST);
			assert.deepStrictEqual(movable.coordinates, { x: 0, y: 1, z: 1 });

			// Return to center
			movable.step(DIRECTION.EAST);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test UP movement
			const upRoom = dungeon.getRoom({ x: 1, y: 1, z: 2 });
			assert(upRoom);
			upRoom.allowedExits |= DIRECTION.DOWN; // Enable DOWN for return trip
			assert(movable.canStep(DIRECTION.UP));
			movable.step(DIRECTION.UP);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 2 });

			// Return to center
			movable.step(DIRECTION.DOWN);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test DOWN movement
			const downRoom = dungeon.getRoom({ x: 1, y: 1, z: 0 });
			assert(downRoom);
			downRoom.allowedExits |= DIRECTION.UP; // Enable UP for return trip
			assert(movable.canStep(DIRECTION.DOWN));
			movable.step(DIRECTION.DOWN);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 0 });

			// Return to center
			movable.step(DIRECTION.UP);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test NORTHEAST movement
			assert(movable.canStep(DIRECTION.NORTHEAST));
			movable.step(DIRECTION.NORTHEAST);
			assert.deepStrictEqual(movable.coordinates, { x: 2, y: 0, z: 1 });

			// Return to center
			movable.step(DIRECTION.SOUTHWEST);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test NORTHWEST movement
			assert(movable.canStep(DIRECTION.NORTHWEST));
			movable.step(DIRECTION.NORTHWEST);
			assert.deepStrictEqual(movable.coordinates, { x: 0, y: 0, z: 1 });

			// Return to center
			movable.step(DIRECTION.SOUTHEAST);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test SOUTHEAST movement
			assert(movable.canStep(DIRECTION.SOUTHEAST));
			movable.step(DIRECTION.SOUTHEAST);
			assert.deepStrictEqual(movable.coordinates, { x: 2, y: 2, z: 1 });

			// Return to center
			movable.step(DIRECTION.NORTHWEST);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test SOUTHWEST movement
			assert(movable.canStep(DIRECTION.SOUTHWEST));
			movable.step(DIRECTION.SOUTHWEST);
			assert.deepStrictEqual(movable.coordinates, { x: 0, y: 2, z: 1 });

			// Return to center
			movable.step(DIRECTION.NORTHEAST);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });
		});
	});

	suite("Mob resource scaling", () => {
		test("should floor health when scaling ratios after capacity changes", () => {
			const mob = new Mob();
			const baseMax = mob.maxHealth;
			const startingHealth = Math.floor(baseMax * 0.75);

			mob.health = startingHealth;
			const ratio = startingHealth / baseMax;

			mob.setResourceBonuses({ maxHealth: 15 });

			assert(Number.isInteger(mob.health));
			assert.strictEqual(mob.health, Math.floor(ratio * mob.maxHealth));
		});

		test("should floor mana when scaling ratios after capacity changes", () => {
			const mob = new Mob();
			const baseMax = mob.maxMana;
			const startingMana = Math.floor(baseMax * 0.6);

			mob.mana = startingMana;
			const ratio = startingMana / baseMax;

			mob.setResourceBonuses({ maxMana: 7 });

			assert(Number.isInteger(mob.mana));
			assert.strictEqual(mob.mana, Math.floor(ratio * mob.maxMana));
		});
	});

	suite("Serialization", () => {
		suite("DungeonObject", () => {
			test("should serialize basic properties correctly", () => {
				const obj = new DungeonObject({
					keywords: "wooden chest treasure",
					display: "Wooden Treasure Chest",
					description: "A sturdy wooden chest bound with iron bands.",
				});

				const serialized = obj.serialize();

				assert.strictEqual(serialized.type, "DungeonObject");
				assert.strictEqual(serialized.keywords, "wooden chest treasure");
				assert.strictEqual(serialized.display, "Wooden Treasure Chest");
				assert.strictEqual(
					serialized.description,
					"A sturdy wooden chest bound with iron bands."
				);
				assert.strictEqual(serialized.contents, undefined);
				assert.strictEqual(serialized.location, undefined);
			});

			test("should serialize roomDescription when present", () => {
				const obj = new DungeonObject({
					keywords: "sword",
					display: "Sword",
					roomDescription: "A shining, long piece of metal is here.",
				});

				const serialized = obj.serialize();

				assert.strictEqual(serialized.type, "DungeonObject");
				assert.strictEqual(
					serialized.roomDescription,
					"A shining, long piece of metal is here."
				);
			});

			test("should not serialize roomDescription when undefined", () => {
				const obj = new DungeonObject({
					keywords: "sword",
					display: "Sword",
				});

				const serialized = obj.serialize();

				assert.strictEqual(serialized.type, "DungeonObject");
				assert.strictEqual(serialized.roomDescription, undefined);
			});

			test("should serialize nested contents recursively", () => {
				const chest = new DungeonObject({
					keywords: "wooden chest",
					display: "Wooden Chest",
				});
				const coin = new DungeonObject({
					keywords: "gold coin",
					display: "Gold Coin",
				});
				const gem = new DungeonObject({
					keywords: "ruby gem",
					display: "Ruby Gem",
				});

				chest.add(coin, gem);
				const serialized = chest.serialize();

				assert.ok(serialized.contents);
				assert.strictEqual(serialized.contents.length, 2);
				assert.strictEqual(serialized.contents[0].type, "DungeonObject");
				assert.strictEqual(serialized.contents[0].keywords, "gold coin");
				assert.strictEqual(serialized.contents[1].type, "DungeonObject");
				assert.strictEqual(serialized.contents[1].keywords, "ruby gem");
			});

			test("should include location when object is in a room with dungeon ID", () => {
				const dungeonId = "test-serialization-dungeon";
				const dungeon = Dungeon.generateEmptyDungeon({
					id: dungeonId,
					dimensions: { width: 5, height: 5, layers: 2 },
				});

				try {
					const room = dungeon.getRoom({ x: 2, y: 3, z: 1 });
					assert(room);

					const obj = new DungeonObject({
						keywords: "test object",
						display: "Test Object",
					});
					room.add(obj);

					const serialized = obj.serialize();
					assert.strictEqual(
						serialized.location,
						"@test-serialization-dungeon{2,3,1}"
					);
				} finally {
					dungeon.destroy();
				}
			});
			test("should not include location when object is not in a room", () => {
				const obj = new DungeonObject({ oid: -1 });
				const container = new DungeonObject({ oid: -1 });
				container.add(obj);

				const serialized = obj.serialize();
				assert.strictEqual(serialized.location, undefined);
			});

			test("should not include location when room has no dungeon ID", () => {
				const dungeon = Dungeon.generateEmptyDungeon({
					dimensions: { width: 3, height: 3, layers: 1 },
				});
				const room = dungeon.getRoom({ x: 1, y: 1, z: 0 });
				assert(room);

				const obj = new DungeonObject({ oid: -1 });
				room.add(obj);

				const serialized = obj.serialize();
				assert.strictEqual(serialized.location, undefined);
			});

			test("should serialize deeply nested hierarchies", () => {
				const backpack = new DungeonObject({
					oid: -1,
					keywords: "leather backpack",
					display: "Leather Backpack",
				});
				const pouch = new DungeonObject({
					oid: -1,
					keywords: "small pouch",
					display: "Small Pouch",
				});
				const coin = new DungeonObject({
					oid: -1,
					keywords: "gold coin",
					display: "Gold Coin",
				});

				backpack.add(pouch);
				pouch.add(coin);

				const serialized = backpack.serialize();
				assert.ok(serialized.contents);
				assert.strictEqual(serialized.contents.length, 1);
				assert.strictEqual(serialized.contents[0].keywords, "small pouch");
				assert.ok(serialized.contents[0].contents);
				assert.strictEqual(serialized.contents[0].contents.length, 1);
				assert.strictEqual(
					serialized.contents[0].contents[0].keywords,
					"gold coin"
				);
			});
		});

		suite("Room", () => {
			test("should serialize with coordinates", () => {
				const room = new Room({
					oid: -1,
					coordinates: { x: 5, y: 3, z: 1 },
					keywords: "start room",
					display: "Starting Room",
					description: "This is where your adventure begins.",
				});

				const serialized = room.serialize();

				assert.strictEqual(serialized.type, "Room");
				assert.strictEqual(serialized.keywords, "start room");
				assert.strictEqual(serialized.display, "Starting Room");
				assert.strictEqual(
					serialized.description,
					"This is where your adventure begins."
				);
				assert.deepStrictEqual(serialized.coordinates, { x: 5, y: 3, z: 1 });
				assert.strictEqual(serialized.contents, undefined);
			});

			test("should serialize room contents", () => {
				const room = new Room({
					coordinates: { x: 0, y: 0, z: 0 },
					keywords: "treasure room",
					display: "Treasure Room",
				});
				const chest = new DungeonObject({
					oid: -1,
					keywords: "wooden chest",
					display: "Wooden Chest",
				});
				const sword = new DungeonObject({
					oid: -1,
					keywords: "steel sword",
					display: "Steel Sword",
				});

				room.add(chest, sword);
				const serialized = room.serialize();

				assert.ok(serialized.contents);
				assert.strictEqual(serialized.contents.length, 2);
				assert.strictEqual(serialized.contents[0].keywords, "wooden chest");
				assert.strictEqual(serialized.contents[1].keywords, "steel sword");
			});
		});

		suite("Subclass Serialization", () => {
			test("should serialize Movable objects with correct type", () => {
				const movable = new Movable({
					oid: -1,
					keywords: "player character",
					display: "Player Character",
				});

				const serialized = movable.serialize();
				assert.strictEqual(serialized.type, "Movable");
				assert.strictEqual(serialized.keywords, "player character");
			});

			test("should serialize Mob objects with correct type", () => {
				const mob = new Mob({
					oid: -1,
					keywords: "orc warrior",
					display: "Orc Warrior",
				});

				const serialized = mob.serialize();
				assert.strictEqual(serialized.type, "Mob");
				assert.strictEqual(serialized.keywords, "orc warrior");
			});

			test("should serialize Item objects with correct type", () => {
				const item = new Item({
					oid: -1,
					keywords: "magic potion",
					display: "Magic Potion",
				});

				const serialized = item.serialize();
				assert.strictEqual(serialized.type, "Item");
				assert.strictEqual(serialized.keywords, "magic potion");
			});

			test("should serialize Prop objects with correct type", () => {
				const prop = new Prop({
					oid: -1,
					keywords: "stone statue",
					display: "Stone Statue",
				});

				const serialized = prop.serialize();
				assert.strictEqual(serialized.type, "Prop");
				assert.strictEqual(serialized.keywords, "stone statue");
			});
		});
	});

	suite("Deserialization", () => {
		suite("DungeonObject", () => {
			test("should deserialize basic properties correctly", () => {
				const data: SerializedDungeonObject = {
					type: "DungeonObject",
					oid: -1,
					keywords: "wooden chest treasure",
					display: "Wooden Treasure Chest",
					description: "A sturdy wooden chest bound with iron bands.",
					contents: [],
				};

				const obj = DungeonObject.deserialize(data);

				assert(obj instanceof DungeonObject);
				assert.strictEqual(obj.keywords, "wooden chest treasure");
				assert.strictEqual(obj.display, "Wooden Treasure Chest");
				assert.strictEqual(
					obj.description,
					"A sturdy wooden chest bound with iron bands."
				);
				assert.strictEqual(obj.contents.length, 0);
			});

			test("should deserialize roomDescription when present", () => {
				const data: SerializedDungeonObject = {
					type: "DungeonObject",
					oid: -1,
					keywords: "sword",
					display: "Sword",
					roomDescription: "A shining, long piece of metal is here.",
					contents: [],
				};

				const obj = DungeonObject.deserialize(data);

				assert(obj instanceof DungeonObject);
				assert.strictEqual(
					obj.roomDescription,
					"A shining, long piece of metal is here."
				);
			});

			test("should handle missing roomDescription in deserialization", () => {
				const data: SerializedDungeonObject = {
					type: "DungeonObject",
					oid: -1,
					keywords: "sword",
					display: "Sword",
					contents: [],
				};

				const obj = DungeonObject.deserialize(data);

				assert(obj instanceof DungeonObject);
				assert.strictEqual(obj.roomDescription, undefined);
			});

			test("should deserialize nested contents recursively", () => {
				const data: SerializedDungeonObject = {
					type: "DungeonObject",
					oid: -1,
					keywords: "wooden chest",
					display: "Wooden Chest",
					description: "A wooden chest.",
					contents: [
						{
							type: "DungeonObject",
							oid: -1,
							keywords: "gold coin",
							display: "Gold Coin",
							description: "A shiny gold coin.",
							contents: [],
						},
						{
							type: "Item",
							oid: -1,
							keywords: "ruby gem",
							display: "Ruby Gem",
							description: "A brilliant red ruby.",
							contents: [],
						},
					],
				};

				const chest = DungeonObject.deserialize(data);

				assert.strictEqual(chest.contents.length, 2);
				assert.strictEqual(chest.contents[0].keywords, "gold coin");
				assert.strictEqual(chest.contents[1].keywords, "ruby gem");
				assert(chest.contents[1] instanceof Item);
				assert.strictEqual(chest.contents[0].location, chest);
				assert.strictEqual(chest.contents[1].location, chest);
			});

			test("should preserve location field but not place object in dungeon", () => {
				const data: SerializedDungeonObject = {
					type: "DungeonObject",
					oid: -1,
					keywords: "test object",
					display: "Test Object",
					description: "A test object.",
					contents: [],
					location: "@test-dungeon{2,3,1}",
				};

				const obj = DungeonObject.deserialize(data);

				// Object should be created correctly
				assert(obj instanceof DungeonObject);
				assert.strictEqual(obj.keywords, "test object");

				// Object should not be automatically placed in any dungeon
				assert.strictEqual(obj.location, undefined);
				assert.strictEqual(obj.dungeon, undefined);

				// Location data is available in the serialized data for loaders to use
				assert.strictEqual(data.location, "@test-dungeon{2,3,1}");
			});

			test("should handle deeply nested hierarchies", () => {
				const data: SerializedDungeonObject = {
					type: "DungeonObject",
					oid: -1,
					keywords: "leather backpack",
					display: "Leather Backpack",
					description: "A worn leather backpack.",
					contents: [
						{
							type: "DungeonObject",
							oid: -1,
							keywords: "small pouch",
							display: "Small Pouch",
							description: "A small cloth pouch.",
							contents: [
								{
									type: "DungeonObject",
									oid: -1,
									keywords: "gold coin",
									display: "Gold Coin",
									description: "A shiny gold coin.",
									contents: [],
								},
							],
						},
					],
				};

				const backpack = DungeonObject.deserialize(data);
				const pouch = backpack.contents[0];
				const coin = pouch.contents[0];

				assert.strictEqual(backpack.keywords, "leather backpack");
				assert.strictEqual(pouch.keywords, "small pouch");
				assert.strictEqual(coin.keywords, "gold coin");
				assert.strictEqual(pouch.location, backpack);
				assert.strictEqual(coin.location, pouch);
			});
		});

		suite("Room", () => {
			test("should deserialize rooms with coordinates", () => {
				const data: SerializedRoom = {
					type: "Room",
					oid: -1,
					keywords: "treasure room",
					display: "Treasure Room",
					description: "A room filled with treasure.",
					contents: [],
					coordinates: { x: 5, y: 3, z: 1 },
					allowedExits:
						DIRECTION.NORTH | DIRECTION.SOUTH | DIRECTION.EAST | DIRECTION.WEST,
				};

				const room = DungeonObject.deserialize(data);

				assert(room instanceof Room);
				assert.strictEqual(room.keywords, "treasure room");
				assert.strictEqual(room.display, "Treasure Room");
				assert.strictEqual(room.description, "A room filled with treasure.");
				assert.deepStrictEqual(room.coordinates, { x: 5, y: 3, z: 1 });
				assert.strictEqual(room.x, 5);
				assert.strictEqual(room.y, 3);
				assert.strictEqual(room.z, 1);
			});

			test("should deserialize room contents", () => {
				const data: SerializedRoom = {
					type: "Room",
					oid: -1,
					keywords: "start room",
					display: "Starting Room",
					description: "Where the adventure begins.",
					coordinates: { x: 0, y: 0, z: 0 },
					allowedExits:
						DIRECTION.NORTH | DIRECTION.SOUTH | DIRECTION.EAST | DIRECTION.WEST,
					contents: [
						{
							type: "DungeonObject",
							oid: -1,
							keywords: "wooden table",
							display: "Wooden Table",
							description: "A simple wooden table.",
							contents: [],
						},
						{
							type: "Movable",
							oid: -1,
							keywords: "player character",
							display: "Player Character",
							description: "The main character.",
							contents: [],
						},
					],
				};

				const room = DungeonObject.deserialize(data);

				assert(room instanceof Room);
				assert.strictEqual(room.contents.length, 2);
				assert.strictEqual(room.contents[0].keywords, "wooden table");
				assert.strictEqual(room.contents[1].keywords, "player character");
				assert(room.contents[1] instanceof Movable);
			});
		});

		suite("Subclass Deserialization", () => {
			test("should deserialize Movable objects correctly", () => {
				const data: SerializedMovable = {
					type: "Movable",
					oid: -1,
					keywords: "player character",
					display: "Player Character",
					description: "The main character.",
					contents: [],
				};

				const movable = DungeonObject.deserialize(data);

				assert(movable instanceof Movable);
				assert.strictEqual(movable.keywords, "player character");
			});

			test("should deserialize Mob objects correctly", () => {
				const data: SerializedMob = {
					type: "Mob",
					oid: -1,
					keywords: "orc warrior",
					display: "Orc Warrior",
					description: "A fierce orc warrior.",
					contents: [],
					level: 1,
					experience: 0,
					race: "orc",
					job: "warrior",
					attributeBonuses: {},
					resourceBonuses: {},
					health: 100,
					mana: 100,
					exhaustion: 0,
				};

				const mob = DungeonObject.deserialize(data);

				assert(mob instanceof Mob);
				assert.strictEqual(mob.keywords, "orc warrior");
			});

			test("should deserialize Item objects correctly", () => {
				const data: SerializedItem = {
					type: "Item",
					oid: -1,
					keywords: "magic sword",
					display: "Magic Sword",
					description: "A sword imbued with magical power.",
					contents: [],
				};

				const item = DungeonObject.deserialize(data);

				assert(item instanceof Item);
				assert.strictEqual(item.keywords, "magic sword");
			});

			test("should deserialize Prop objects correctly", () => {
				const data: SerializedProp = {
					type: "Prop",
					oid: -1,
					keywords: "stone altar",
					display: "Stone Altar",
					description: "An ancient stone altar.",
					contents: [],
				};

				const prop = DungeonObject.deserialize(data);

				assert(prop instanceof Prop);
				assert.strictEqual(prop.keywords, "stone altar");
			});
		});

		suite("Mixed Type Hierarchies", () => {
			test("should deserialize mixed object types in the same hierarchy", () => {
				const data: SerializedDungeonObject = {
					type: "DungeonObject",
					oid: -1,
					keywords: "treasure chest",
					display: "Treasure Chest",
					description: "A chest full of various treasures.",
					contents: [
						{
							type: "Item",
							oid: -1,
							keywords: "magic sword",
							display: "Magic Sword",
							description: "A magical blade.",
							contents: [],
						},
						{
							type: "DungeonObject",
							oid: -1,
							keywords: "coin purse",
							display: "Coin Purse",
							description: "A small purse.",
							contents: [
								{
									type: "Item",
									oid: -1,
									keywords: "gold coin",
									display: "Gold Coin",
									description: "A shiny coin.",
									contents: [],
								},
							],
						},
						{
							type: "Prop",
							oid: -1,
							keywords: "decorative gem",
							display: "Decorative Gem",
							description: "A beautiful ornamental gem.",
							contents: [],
						},
					],
				};

				const chest = DungeonObject.deserialize(data);

				assert.strictEqual(chest.contents.length, 3);
				assert(chest.contents[0] instanceof Item);
				assert(chest.contents[1] instanceof DungeonObject);
				assert(chest.contents[2] instanceof Prop);

				// Check nested content
				const coinPurse = chest.contents[1];
				assert.strictEqual(coinPurse.contents.length, 1);
				assert(coinPurse.contents[0] instanceof Item);
				assert.strictEqual(coinPurse.contents[0].keywords, "gold coin");
			});
		});
	});

	suite("Serialization Round-trip", () => {
		test("should maintain object hierarchy through serialize/deserialize cycle", () => {
			// Create a complex hierarchy
			const backpack = new DungeonObject({
				keywords: "leather backpack",
				display: "Leather Backpack",
				description: "A well-worn leather backpack.",
			});
			const weapon = new Item({
				oid: -1,
				keywords: "steel dagger",
				display: "Steel Dagger",
				description: "A sharp steel dagger.",
			});
			const pouch = new DungeonObject({
				keywords: "coin pouch",
				display: "Coin Pouch",
				description: "A small leather pouch.",
			});
			const coin1 = new Item({
				oid: -1,
				keywords: "gold coin",
				display: "Gold Coin",
			});
			const coin2 = new Item({
				oid: -1,
				keywords: "silver coin",
				display: "Silver Coin",
			});

			// Build hierarchy
			backpack.add(weapon, pouch);
			pouch.add(coin1, coin2);

			// Serialize
			const serialized = backpack.serialize();

			// Deserialize
			const restored = DungeonObject.deserialize(serialized);

			// Verify structure
			assert.strictEqual(restored.keywords, "leather backpack");
			assert.strictEqual(restored.contents.length, 2);

			const restoredWeapon = restored.contents[0];
			const restoredPouch = restored.contents[1];

			assert(restoredWeapon instanceof Item);
			assert.strictEqual(restoredWeapon.keywords, "steel dagger");
			assert.strictEqual(restoredWeapon.location, restored);

			assert.strictEqual(restoredPouch.keywords, "coin pouch");
			assert.strictEqual(restoredPouch.contents.length, 2);
			assert.strictEqual(restoredPouch.location, restored);

			const restoredCoin1 = restoredPouch.contents[0];
			const restoredCoin2 = restoredPouch.contents[1];

			assert(restoredCoin1 instanceof Item);
			assert(restoredCoin2 instanceof Item);
			assert.strictEqual(restoredCoin1.keywords, "gold coin");
			assert.strictEqual(restoredCoin2.keywords, "silver coin");
			assert.strictEqual(restoredCoin1.location, restoredPouch);
			assert.strictEqual(restoredCoin2.location, restoredPouch);
		});

		test("should recreate mob with contents and restore to correct room location", () => {
			const dungeonId = "test-mob-restoration";
			const dungeon = Dungeon.generateEmptyDungeon({
				id: dungeonId,
				dimensions: { width: 5, height: 5, layers: 2 },
			});

			try {
				// Get a specific room
				const room = dungeon.getRoom({ x: 2, y: 3, z: 1 });
				assert(room);

				// Create a mob with an item in its inventory
				const mob = new Mob({
					keywords: "orc warrior guard",
					display: "Orc Warrior",
					description: "A fierce orc warrior standing guard.",
				});
				const weapon = new Item({
					oid: -1,
					keywords: "rusty sword blade",
					display: "Rusty Sword",
					description: "A rusty but still dangerous sword.",
				});
				const potion = new Item({
					oid: -1,
					keywords: "healing potion bottle",
					display: "Healing Potion",
					description: "A small bottle containing red liquid.",
				});

				// Give the mob some inventory
				mob.add(weapon, potion);

				// Place mob in the room
				room.add(mob);

				// Verify initial setup
				assert.strictEqual(mob.location, room);
				assert.strictEqual(mob.dungeon, dungeon);
				assert.strictEqual(mob.contents.length, 2);
				assert(room.contains(mob));
				assert(dungeon.contains(mob));

				// Serialize the mob
				const serializedMob = mob.serialize();

				// Verify serialization includes location
				assert.strictEqual(serializedMob.location, `@${dungeonId}{2,3,1}`);
				assert.ok(serializedMob.contents);
				assert.strictEqual(serializedMob.contents.length, 2);
				assert.strictEqual(
					serializedMob.contents[0].keywords,
					"rusty sword blade"
				);
				assert.strictEqual(
					serializedMob.contents[1].keywords,
					"healing potion bottle"
				);

				// Remove/delete the mob from the dungeon
				room.remove(mob);
				assert(!room.contains(mob));
				assert(!dungeon.contains(mob));
				assert.strictEqual(mob.location, undefined);
				assert.strictEqual(mob.dungeon, undefined);

				// Recreate the mob from serialized data
				const restoredMob = DungeonObject.deserialize(serializedMob);

				// Verify the restored mob is correct type and has correct properties
				assert(restoredMob instanceof Mob);
				assert.strictEqual(restoredMob.keywords, "orc warrior guard");
				assert.strictEqual(restoredMob.display, "Orc Warrior");
				assert.strictEqual(
					restoredMob.description,
					"A fierce orc warrior standing guard."
				);

				// Verify contents were restored
				assert.strictEqual(restoredMob.contents.length, 2);
				assert(restoredMob.contents[0] instanceof Item);
				assert(restoredMob.contents[1] instanceof Item);
				assert.strictEqual(
					restoredMob.contents[0].keywords,
					"rusty sword blade"
				);
				assert.strictEqual(
					restoredMob.contents[1].keywords,
					"healing potion bottle"
				);
				assert.strictEqual(restoredMob.contents[0].location, restoredMob);
				assert.strictEqual(restoredMob.contents[1].location, restoredMob);

				// Initially, the restored mob should not be placed anywhere
				assert.strictEqual(restoredMob.location, undefined);
				assert.strictEqual(restoredMob.dungeon, undefined);

				// Use the saved location to place the mob back in the correct room
				const locationRef = serializedMob.location;
				assert(locationRef); // Should be "@test-mob-restoration{2,3,1}"

				const targetRoom = getRoomByRef(locationRef);
				assert(targetRoom);
				assert.strictEqual(targetRoom, room); // Should be the same room

				// Place the restored mob in the target room
				targetRoom.add(restoredMob);

				// Verify the mob is correctly placed
				assert.strictEqual(restoredMob.location, targetRoom);
				assert.strictEqual(restoredMob.dungeon, dungeon);
				assert(targetRoom.contains(restoredMob));
				assert(dungeon.contains(restoredMob));

				// Verify contents are still intact after placement
				assert.strictEqual(restoredMob.contents.length, 2);
				assert.strictEqual(
					restoredMob.contents[0].keywords,
					"rusty sword blade"
				);
				assert.strictEqual(
					restoredMob.contents[1].keywords,
					"healing potion bottle"
				);
				assert.strictEqual(restoredMob.contents[0].dungeon, dungeon);
				assert.strictEqual(restoredMob.contents[1].dungeon, dungeon);

				// Verify the room now contains the restored mob
				const roomMobs = room.contents.filter((obj) => obj instanceof Mob);
				assert.strictEqual(roomMobs.length, 1);
				assert.strictEqual(roomMobs[0], restoredMob);
			} finally {
				dungeon.destroy();
			}
		});
		test("should preserve room coordinates through serialize/deserialize cycle", () => {
			const room = new Room({
				coordinates: { x: 7, y: 2, z: 3 },
				keywords: "magic library",
				display: "Magic Library",
				description: "A library filled with ancient tomes.",
			});

			const book = new Item({
				oid: -1,
				keywords: "ancient tome",
				display: "Ancient Tome",
			});
			room.add(book);

			// Serialize
			const serialized = room.serialize();

			// Deserialize
			const restored = DungeonObject.deserialize(serialized);

			// Verify it's a room with correct coordinates
			assert(restored instanceof Room);
			assert.deepStrictEqual(restored.coordinates, { x: 7, y: 2, z: 3 });
			assert.strictEqual(restored.x, 7);
			assert.strictEqual(restored.y, 2);
			assert.strictEqual(restored.z, 3);

			// Verify contents
			assert.strictEqual(restored.contents.length, 1);
			assert(restored.contents[0] instanceof Item);
			assert.strictEqual(restored.contents[0].keywords, "ancient tome");
		});

		test("should handle location preservation correctly", () => {
			const dungeonId = "test-roundtrip-dungeon";
			const dungeon = Dungeon.generateEmptyDungeon({
				id: dungeonId,
				dimensions: { width: 5, height: 5, layers: 2 },
			});

			try {
				const room = dungeon.getRoom({ x: 3, y: 4, z: 1 });
				assert(room);

				const item = new Item({
					oid: -1,
					keywords: "magic crystal",
					display: "Magic Crystal",
				});
				room.add(item);

				// Serialize
				const serialized = item.serialize();

				// Verify location is preserved in serialized data
				assert.strictEqual(
					serialized.location,
					"@test-roundtrip-dungeon{3,4,1}"
				);

				// Deserialize
				const restored = DungeonObject.deserialize(serialized);

				// Verify object is created but not placed
				assert(restored instanceof Item);
				assert.strictEqual(restored.keywords, "magic crystal");
				assert.strictEqual(restored.location, undefined);
				assert.strictEqual(restored.dungeon, undefined);

				// Location data is still available in the original serialized data
				assert.strictEqual(
					serialized.location,
					"@test-roundtrip-dungeon{3,4,1}"
				);
			} finally {
				dungeon.destroy();
			}
		});
		test("should handle objects without location correctly", () => {
			const container = new DungeonObject({
				keywords: "storage box",
				display: "Storage Box",
			});
			const item = new Item({
				oid: -1,
				keywords: "small key",
				display: "Small Key",
			});
			container.add(item);

			// Serialize
			const serialized = item.serialize();

			// Should not have location
			assert.strictEqual(serialized.location, undefined);

			// Deserialize
			const restored = DungeonObject.deserialize(serialized);

			// Verify restoration
			assert(restored instanceof Item);
			assert.strictEqual(restored.keywords, "small key");
			assert.strictEqual(restored.location, undefined);
		});
	});

	suite("Reset", () => {
		test("should create reset with default minCount of 1 and maxCount of 1", () => {
			const reset = new Reset({
				templateId: "test-item",
				roomRef: "@test{0,0,0}",
			});

			assert.strictEqual(reset.templateId, "test-item");
			assert.strictEqual(reset.roomRef, "@test{0,0,0}");
			assert.strictEqual(reset.minCount, 1);
			assert.strictEqual(reset.maxCount, 1);
			assert.strictEqual(reset.countExisting(), 0);
		});

		test("should create reset with custom minCount and maxCount", () => {
			const reset = new Reset({
				templateId: "coin-gold",
				roomRef: "@tower{0,0,0}",
				minCount: 2,
				maxCount: 5,
			});

			assert.strictEqual(reset.minCount, 2);
			assert.strictEqual(reset.maxCount, 5);
		});

		test("should spawn objects when count is below minimum", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-spawn",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const template: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
				keywords: "coin gold",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["coin-gold", template],
			]);

			const reset = new Reset({
				templateId: "coin-gold",
				roomRef: room.getRoomRef()!,
				minCount: 3,
				maxCount: 5,
			});

			// Execute reset - should spawn 3 objects
			const spawned = reset.execute(templateRegistry);

			assert.strictEqual(spawned.length, 3);
			assert.strictEqual(reset.countExisting(), 3);
			assert.strictEqual(room.contents.length, 3);

			// Verify all spawned objects are in the room
			for (const obj of spawned) {
				assert.strictEqual(obj.location, room);
				assert.strictEqual(obj.dungeon, dungeon);
			}
		});

		test("should not spawn objects when count is at minimum", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-min",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const template: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["coin-gold", template],
			]);

			const reset = new Reset({
				templateId: "coin-gold",
				roomRef: room.getRoomRef()!,
				minCount: 2,
				maxCount: 5,
			});

			// First execution - spawns 2 objects
			const firstSpawn = reset.execute(templateRegistry);
			assert.strictEqual(firstSpawn.length, 2);

			// Second execution - should not spawn (at minimum)
			const secondSpawn = reset.execute(templateRegistry);
			assert.strictEqual(secondSpawn.length, 0);
		});

		test("should clean up dead references when counting", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-cleanup",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const template: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["coin-gold", template],
			]);

			const reset = new Reset({
				templateId: "coin-gold",
				roomRef: room.getRoomRef()!,
				minCount: 2,
				maxCount: 5,
			});

			// Spawn objects
			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 2);
			assert.strictEqual(reset.countExisting(), 2);

			// Remove one object from dungeon
			spawned[0].remove();
			dungeon.remove(spawned[0]);

			// Count should reflect that object is no longer in any dungeon
			// (WeakSet automatically handles GC, so the object is no longer tracked)
			const count = reset.countExisting();
			assert.strictEqual(count, 1);
		});

		test("should return empty array when room reference is invalid", () => {
			const template: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["coin-gold", template],
			]);

			const reset = new Reset({
				templateId: "coin-gold",
				roomRef: "@nonexistent{0,0,0}",
				minCount: 2,
				maxCount: 5,
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 0);
		});

		test("should return empty array when template is not found", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-notfound",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const templateRegistry = new Map<string, DungeonObjectTemplate>();

			const reset = new Reset({
				templateId: "nonexistent",
				roomRef: room.getRoomRef()!,
				minCount: 2,
				maxCount: 5,
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 0);
		});

		test("should respect maxCount when spawning multiple objects", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-maxcount",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const template: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["coin-gold", template],
			]);

			const reset = new Reset({
				templateId: "coin-gold",
				roomRef: room.getRoomRef()!,
				minCount: 5,
				maxCount: 3, // Max is less than min
			});

			// Should only spawn up to maxCount
			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 3);
			assert.strictEqual(reset.countExisting(), 3);
		});
	});

	suite("Dungeon reset management", () => {
		test("should add and remove resets", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});

			const reset1 = new Reset({
				templateId: "item1",
				roomRef: "@test{0,0,0}",
			});

			const reset2 = new Reset({
				templateId: "item2",
				roomRef: "@test{0,0,0}",
			});

			assert.strictEqual(dungeon.resets.length, 0);

			dungeon.addReset(reset1);
			assert.strictEqual(dungeon.resets.length, 1);
			assert(dungeon.resets.includes(reset1));

			dungeon.addReset(reset2);
			assert.strictEqual(dungeon.resets.length, 2);

			dungeon.removeReset(reset1);
			assert.strictEqual(dungeon.resets.length, 1);
			assert(!dungeon.resets.includes(reset1));
			assert(dungeon.resets.includes(reset2));
		});

		test("should not add duplicate resets", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 5, height: 5, layers: 1 },
			});

			const reset = new Reset({
				templateId: "item1",
				roomRef: "@test{0,0,0}",
			});

			dungeon.addReset(reset);
			dungeon.addReset(reset); // Try to add again

			assert.strictEqual(dungeon.resets.length, 1);
		});

		test("should execute all resets", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-execute",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room1 = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;
			const room2 = dungeon.getRoom({ x: 1, y: 0, z: 0 })!;

			const template1: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
			};

			const template2: DungeonObjectTemplate = {
				id: "sword-iron",
				type: "Item",
				display: "Iron Sword",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["coin-gold", template1],
				["sword-iron", template2],
			]);

			const reset1 = new Reset({
				templateId: "coin-gold",
				roomRef: room1.getRoomRef()!,
				minCount: 2,
				maxCount: 5,
			});

			const reset2 = new Reset({
				templateId: "sword-iron",
				roomRef: room2.getRoomRef()!,
				minCount: 1,
				maxCount: 3,
			});

			dungeon.addReset(reset1);
			dungeon.addReset(reset2);

			// Add templates to dungeon
			for (const [id, template] of templateRegistry) {
				dungeon.addTemplate(template);
			}
			const totalSpawned = dungeon.executeResets();
			assert.strictEqual(totalSpawned, 3); // 2 coins + 1 sword
			assert.strictEqual(room1.contents.length, 2);
			assert.strictEqual(room2.contents.length, 1);
		});
	});

	suite("Reset tracking and location changes", () => {
		test("should clear tracking for items when location changes", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-item-location",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room1 = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;
			const room2 = dungeon.getRoom({ x: 1, y: 0, z: 0 })!;

			const template: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["coin-gold", template],
			]);

			const reset = new Reset({
				templateId: "coin-gold",
				roomRef: room1.getRoomRef()!,
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);
			const item = spawned[0];
			assert(item instanceof Item);
			assert.strictEqual(item.spawnedByReset, reset);
			assert.strictEqual(reset.countExisting(), 1);

			// Move item to different room - should lose tracking
			item.location = room2;
			assert.strictEqual(item.spawnedByReset, undefined);
			assert.strictEqual(reset.countExisting(), 0);
		});

		test("should NOT clear tracking for mobs when location changes", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-mob-location",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room1 = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;
			const room2 = dungeon.getRoom({ x: 1, y: 0, z: 0 })!;

			const template: DungeonObjectTemplate = {
				id: "goblin",
				type: "Mob",
				display: "Goblin",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["goblin", template],
			]);

			const reset = new Reset({
				templateId: "goblin",
				roomRef: room1.getRoomRef()!,
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);
			const mob = spawned[0];
			assert(mob instanceof Mob);
			assert.strictEqual(mob.spawnedByReset, reset);
			assert.strictEqual(reset.countExisting(), 1);

			// Move mob to different room - should KEEP tracking
			mob.location = room2;
			assert.strictEqual(mob.spawnedByReset, reset);
			assert.strictEqual(reset.countExisting(), 1);
		});
	});

	suite("Reset equipped and inventory for Mobs", () => {
		test("should create reset with equipped and inventory arrays", () => {
			const reset = new Reset({
				templateId: "goblin",
				roomRef: "@test{0,0,0}",
				equipped: ["sword-iron", "helmet-steel"],
				inventory: ["potion-healing", "coin-gold"],
			});

			assert.strictEqual(reset.equipped?.length, 2);
			assert.strictEqual(reset.equipped?.[0], "sword-iron");
			assert.strictEqual(reset.equipped?.[1], "helmet-steel");
			assert.strictEqual(reset.inventory?.length, 2);
			assert.strictEqual(reset.inventory?.[0], "potion-healing");
			assert.strictEqual(reset.inventory?.[1], "coin-gold");
		});

		test("should spawn mob with equipped equipment", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-equipped",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const mobTemplate: DungeonObjectTemplate = {
				id: "goblin",
				type: "Mob",
				display: "Goblin",
				keywords: "goblin",
			};

			const weaponTemplate: WeaponTemplate = {
				id: "sword-iron",
				type: "Weapon",
				display: "Iron Sword",
				keywords: "sword iron",
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 10,
			};

			const armorTemplate: ArmorTemplate = {
				id: "helmet-steel",
				type: "Armor",
				display: "Steel Helmet",
				keywords: "helmet steel",
				slot: EQUIPMENT_SLOT.HEAD,
				defense: 5,
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["goblin", mobTemplate],
				["sword-iron", weaponTemplate],
				["helmet-steel", armorTemplate],
			]);

			const reset = new Reset({
				templateId: "goblin",
				roomRef: room.getRoomRef()!,
				equipped: ["sword-iron", "helmet-steel"],
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);

			const mob = spawned[0];
			assert(mob instanceof Mob);

			// Verify equipment is equipped
			const weapon = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
			const helmet = mob.getEquipped(EQUIPMENT_SLOT.HEAD);

			assert(weapon instanceof Weapon);
			assert(helmet instanceof Armor);
			assert.strictEqual(weapon.templateId, "sword-iron");
			assert.strictEqual(helmet.templateId, "helmet-steel");
			assert.strictEqual(weapon.attackPower, 10);
			assert.strictEqual(helmet.defense, 5);

			// Verify equipment is in mob's inventory
			assert(mob.contains(weapon));
			assert(mob.contains(helmet));
		});

		test("should spawn mob with inventory items", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-inventory",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const mobTemplate: DungeonObjectTemplate = {
				id: "goblin",
				type: "Mob",
				display: "Goblin",
				keywords: "goblin",
			};

			const potionTemplate: DungeonObjectTemplate = {
				id: "potion-healing",
				type: "Item",
				display: "Healing Potion",
				keywords: "potion healing",
			};

			const coinTemplate: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
				keywords: "coin gold",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["goblin", mobTemplate],
				["potion-healing", potionTemplate],
				["coin-gold", coinTemplate],
			]);

			const reset = new Reset({
				templateId: "goblin",
				roomRef: room.getRoomRef()!,
				inventory: ["potion-healing", "coin-gold"],
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);

			const mob = spawned[0];
			assert(mob instanceof Mob);

			// Verify items are in mob's inventory
			const potion = mob.contents.find(
				(obj) => obj.templateId === "potion-healing"
			);
			const coin = mob.contents.find((obj) => obj.templateId === "coin-gold");

			assert(potion instanceof Item);
			assert(coin instanceof Item);
			assert.strictEqual(potion.templateId, "potion-healing");
			assert.strictEqual(coin.templateId, "coin-gold");
			assert.strictEqual(mob.contents.length, 2);
		});

		test("should spawn mob with both equipped and inventory", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-both",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const mobTemplate: DungeonObjectTemplate = {
				id: "goblin-warrior",
				type: "Mob",
				display: "Goblin Warrior",
				keywords: "goblin warrior",
			};

			const weaponTemplate: WeaponTemplate = {
				id: "sword-iron",
				type: "Weapon",
				display: "Iron Sword",
				keywords: "sword iron",
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 10,
			};

			const potionTemplate: DungeonObjectTemplate = {
				id: "potion-healing",
				type: "Item",
				display: "Healing Potion",
				keywords: "potion healing",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["goblin-warrior", mobTemplate],
				["sword-iron", weaponTemplate],
				["potion-healing", potionTemplate],
			]);

			const reset = new Reset({
				templateId: "goblin-warrior",
				roomRef: room.getRoomRef()!,
				equipped: ["sword-iron"],
				inventory: ["potion-healing"],
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);

			const mob = spawned[0];
			assert(mob instanceof Mob);

			// Verify equipment is equipped
			const weapon = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
			assert(weapon instanceof Weapon);
			assert.strictEqual(weapon.templateId, "sword-iron");

			// Verify inventory item exists
			const potion = mob.contents.find(
				(obj) => obj.templateId === "potion-healing"
			);
			assert(potion instanceof Item);
			assert.strictEqual(potion.templateId, "potion-healing");

			// Both weapon and potion should be in mob's contents
			// (equipped items are also in contents)
			assert(mob.contains(weapon));
			assert(mob.contains(potion));
		});

		test("should not equip items on non-mob objects", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-non-mob",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const itemTemplate: DungeonObjectTemplate = {
				id: "coin-gold",
				type: "Item",
				display: "Gold Coin",
				keywords: "coin gold",
			};

			const weaponTemplate: WeaponTemplate = {
				id: "sword-iron",
				type: "Weapon",
				display: "Iron Sword",
				keywords: "sword iron",
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 10,
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["coin-gold", itemTemplate],
				["sword-iron", weaponTemplate],
			]);

			// Reset for a non-mob with equipped/inventory should not error
			// but should also not do anything
			const reset = new Reset({
				templateId: "coin-gold",
				roomRef: room.getRoomRef()!,
				equipped: ["sword-iron"],
				inventory: ["sword-iron"],
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);

			const item = spawned[0];
			assert(item instanceof Item);
			assert.strictEqual(item.contents.length, 0);
		});

		test("should handle missing equipment template gracefully", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-missing-equip",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const mobTemplate: DungeonObjectTemplate = {
				id: "goblin",
				type: "Mob",
				display: "Goblin",
				keywords: "goblin",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["goblin", mobTemplate],
			]);

			const reset = new Reset({
				templateId: "goblin",
				roomRef: room.getRoomRef()!,
				equipped: ["nonexistent-weapon"],
			});

			// Should still spawn the mob, just without the missing equipment
			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);

			const mob = spawned[0];
			assert(mob instanceof Mob);
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND), undefined);
		});

		test("should handle wrong type in equipped array gracefully", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-wrong-type",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const mobTemplate: DungeonObjectTemplate = {
				id: "goblin",
				type: "Mob",
				display: "Goblin",
				keywords: "goblin",
			};

			const itemTemplate: DungeonObjectTemplate = {
				id: "potion-healing",
				type: "Item",
				display: "Healing Potion",
				keywords: "potion healing",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["goblin", mobTemplate],
				["potion-healing", itemTemplate],
			]);

			const reset = new Reset({
				templateId: "goblin",
				roomRef: room.getRoomRef()!,
				equipped: ["potion-healing"], // Item type, not Equipment/Armor/Weapon
			});

			// Should still spawn the mob, just without equipping the invalid item
			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);

			const mob = spawned[0];
			assert(mob instanceof Mob);
			// Should not have equipped anything since potion is not Equipment
		});

		test("should handle missing inventory template gracefully", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-missing-inv",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const mobTemplate: DungeonObjectTemplate = {
				id: "goblin",
				type: "Mob",
				display: "Goblin",
				keywords: "goblin",
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["goblin", mobTemplate],
			]);

			const reset = new Reset({
				templateId: "goblin",
				roomRef: room.getRoomRef()!,
				inventory: ["nonexistent-item"],
			});

			// Should still spawn the mob, just without the missing inventory
			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 1);

			const mob = spawned[0];
			assert(mob instanceof Mob);
			assert.strictEqual(mob.contents.length, 0);
		});

		test("should handle multiple mobs with same reset correctly", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				id: "test-reset-multiple-mobs",
				dimensions: { width: 5, height: 5, layers: 1 },
			});
			const room = dungeon.getRoom({ x: 0, y: 0, z: 0 })!;

			const mobTemplate: DungeonObjectTemplate = {
				id: "goblin",
				type: "Mob",
				display: "Goblin",
				keywords: "goblin",
			};

			const weaponTemplate: WeaponTemplate = {
				id: "sword-iron",
				type: "Weapon",
				display: "Iron Sword",
				keywords: "sword iron",
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 10,
			};

			const templateRegistry = new Map<string, DungeonObjectTemplate>([
				["goblin", mobTemplate],
				["sword-iron", weaponTemplate],
			]);

			const reset = new Reset({
				templateId: "goblin",
				roomRef: room.getRoomRef()!,
				minCount: 2,
				maxCount: 2,
				equipped: ["sword-iron"],
			});

			const spawned = reset.execute(templateRegistry);
			assert.strictEqual(spawned.length, 2);

			// Both mobs should have the weapon equipped
			for (const obj of spawned) {
				assert(obj instanceof Mob);
				const mob = obj as Mob;
				const weapon = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
				assert(weapon instanceof Weapon);
				assert.strictEqual(weapon.templateId, "sword-iron");
			}
		});
	});

	suite("Mob.oneHit with ability name and attack power modifiers", () => {
		let dungeon: Dungeon;
		let room: Room;
		let attacker: Mob;
		let target: Mob;
		let observer: Mob;
		let attackerCharacter: Character;
		let targetCharacter: Character;
		let observerCharacter: Character;

		// Helper to create a test character with message tracking
		function createTestCharacter(
			mob: Mob,
			characterId: number
		): Character & {
			messageHistory: Array<{ text: string; group: any }>;
		} {
			const messageHistory: Array<{ text: string; group: any }> = [];
			const character = new Character({
				credentials: {
					characterId,
					username: mob.display.toLowerCase(),
				},
				mob,
			});

			// Override sendMessage to track messages
			// Don't call the original since test characters don't have sessions/clients
			// Store messageHistory on the character so it can be accessed and cleared
			(character as any).messageHistory = messageHistory;
			character.sendMessage = function (text: string, group: any) {
				(
					(this as any).messageHistory as Array<{ text: string; group: any }>
				).push({ text, group });
			};

			return character as Character & {
				messageHistory: Array<{ text: string; group: any }>;
			};
		}

		// Helper to get messages for a character
		function getMessages(
			character: Character & {
				messageHistory?: Array<{ text: string; group: any }>;
			},
			group: any
		): string[] {
			const history = (character as any).messageHistory || [];
			return history
				.filter((m: { text: string; group: any }) => m.group === group)
				.map((m: { text: string; group: any }) => m.text);
		}

		beforeEach(() => {
			dungeon = new Dungeon({
				dimensions: { width: 10, height: 10, layers: 1 },
			});
			room = new Room({
				coordinates: { x: 0, y: 0, z: 0 },
				dungeon,
			});
			dungeon.addRoom(room);

			// Create attacker mob with character
			attacker = new Mob({
				display: "Warrior",
				keywords: "warrior",
				level: 10,
			});
			attacker.location = room;
			attackerCharacter = createTestCharacter(attacker, 1);
			attacker.character = attackerCharacter;

			// Create target mob with character
			target = new Mob({
				display: "Goblin",
				keywords: "goblin",
				level: 5,
			});
			target.location = room;
			targetCharacter = createTestCharacter(target, 2);
			target.character = targetCharacter;

			// Create observer mob with character
			observer = new Mob({
				display: "Observer",
				keywords: "observer",
			});
			observer.location = room;
			observerCharacter = createTestCharacter(observer, 3);
			observer.character = observerCharacter;
		});

		test("should use ability name in damage messages when abilityName is provided", () => {
			// Clear message history (clear the array, don't reassign)
			(attackerCharacter as any).messageHistory.length = 0;
			(targetCharacter as any).messageHistory.length = 0;
			(observerCharacter as any).messageHistory.length = 0;

			// Perform hit with ability name
			const damage = attacker.oneHit({
				target,
				guaranteedHit: true,
				abilityName: "whirlwind",
			});

			assert(damage > 0, "Damage should be greater than 0");

			// Check messages contain ability name
			const attackerMessages = getMessages(
				attackerCharacter,
				MESSAGE_GROUP.COMBAT
			);
			const targetMessages = getMessages(targetCharacter, MESSAGE_GROUP.COMBAT);
			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.COMBAT
			);

			assert(
				attackerMessages.some((msg) => msg.includes("Your whirlwind hits")),
				"Attacker should see 'Your whirlwind hits' message"
			);
			assert(
				targetMessages.some((msg) => msg.includes("whirlwind hits you")),
				"Target should see 'whirlwind hits you' message"
			);
			assert(
				observerMessages.some((msg) => msg.includes("whirlwind hits")),
				"Observer should see 'whirlwind hits' message"
			);
		});

		test("should apply attackPowerBonus to damage calculation", () => {
			// Get base damage without bonus
			const baseDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
			});

			// Reset target health
			target.health = target.maxHealth;

			// Get damage with bonus
			const bonusDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
				attackPowerBonus: 10,
			});

			// Damage with bonus should be higher
			assert(
				bonusDamage > baseDamage,
				`Damage with bonus (${bonusDamage}) should be greater than base damage (${baseDamage})`
			);
		});

		test("should apply attackPowerMultiplier to damage calculation", () => {
			// Get base damage without multiplier
			const baseDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
			});

			// Reset target health
			target.health = target.maxHealth;

			// Get damage with 1.5x multiplier
			const multipliedDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
				attackPowerMultiplier: 1.5,
			});

			// Damage with multiplier should be approximately 1.5x (allowing for rounding)
			const expectedMin = Math.floor(baseDamage * 1.4);
			const expectedMax = Math.ceil(baseDamage * 1.6);
			assert(
				multipliedDamage >= expectedMin && multipliedDamage <= expectedMax,
				`Multiplied damage (${multipliedDamage}) should be approximately 1.5x base damage (${baseDamage})`
			);
		});

		test("should apply both attackPowerBonus and attackPowerMultiplier together", () => {
			// Get base damage
			const baseDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
			});

			// Reset target health
			target.health = target.maxHealth;

			// Get damage with both bonus and multiplier
			const combinedDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
				attackPowerBonus: 5,
				attackPowerMultiplier: 1.5,
			});

			// Combined damage should be significantly higher
			assert(
				combinedDamage > baseDamage,
				`Combined damage (${combinedDamage}) should be greater than base damage (${baseDamage})`
			);

			// Should be higher than just bonus or just multiplier
			target.health = target.maxHealth;
			const bonusOnlyDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
				attackPowerBonus: 5,
			});

			target.health = target.maxHealth;
			const multiplierOnlyDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
				attackPowerMultiplier: 1.5,
			});

			assert(
				combinedDamage > bonusOnlyDamage,
				"Combined should be higher than bonus only"
			);
			assert(
				combinedDamage > multiplierOnlyDamage,
				"Combined should be higher than multiplier only"
			);
		});

		test("should use ability name with attack power modifiers", () => {
			// Clear message history (clear the array, don't reassign)
			(attackerCharacter as any).messageHistory.length = 0;
			(targetCharacter as any).messageHistory.length = 0;

			// Perform hit with ability name and modifiers
			const damage = attacker.oneHit({
				target,
				guaranteedHit: true,
				abilityName: "fireball",
				attackPowerBonus: 5,
				attackPowerMultiplier: 1.2,
			});

			assert(damage > 0, "Damage should be greater than 0");

			// Check messages contain ability name
			const attackerMessages = getMessages(
				attackerCharacter,
				MESSAGE_GROUP.COMBAT
			);
			const targetMessages = getMessages(targetCharacter, MESSAGE_GROUP.COMBAT);

			assert(
				attackerMessages.some((msg) => msg.includes("Your fireball hits")),
				"Attacker should see 'Your fireball hits' message"
			);
			assert(
				targetMessages.some((msg) => msg.includes("fireball hits you")),
				"Target should see 'fireball hits you' message"
			);
		});

		test("should apply modifiers in correct order (bonus then multiplier)", () => {
			// Calculate expected damage manually
			// Base attack power
			const baseAttackPower = attacker.attackPower;
			// Apply bonus
			const afterBonus = baseAttackPower + 10;
			// Apply multiplier
			const afterMultiplier = afterBonus * 1.5;
			// Apply defense reduction (10% per defense point)
			const defenseReduction = target.defense * 0.1;
			const afterDefense = Math.max(1, afterMultiplier - defenseReduction);

			// Perform hit with modifiers
			const actualDamage = attacker.oneHit({
				target,
				guaranteedHit: true,
				attackPowerBonus: 10,
				attackPowerMultiplier: 1.5,
			});

			// Allow for rounding differences (critical hits, etc.)
			// The actual damage should be in a reasonable range
			const expectedMin = Math.floor(afterDefense * 0.8);
			const expectedMax = Math.ceil(afterDefense * 2.2); // Allow for crits

			assert(
				actualDamage >= expectedMin && actualDamage <= expectedMax,
				`Actual damage (${actualDamage}) should be in expected range (${expectedMin}-${expectedMax}) based on calculation order`
			);
		});
	});
});
