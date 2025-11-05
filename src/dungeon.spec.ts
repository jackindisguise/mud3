import assert from "node:assert";
import { suite, test } from "node:test";

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
	Mob,
	Item,
	Prop,
	RoomLink,
	DIRECTIONS,
	type SerializedDungeonObject,
	type SerializedRoom,
	type SerializedMovable,
	type SerializedMob,
	type SerializedItem,
	type SerializedProp,
} from "./dungeon.js";

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
			const roomX = new Room({ coordinates: { x: 5, y: 0, z: 0 } });
			const resultX = dungeon.addRoom(roomX);
			assert.strictEqual(resultX, false);
			assert.strictEqual(roomX.dungeon, undefined);

			// Try to add a room outside the y bounds
			const roomY = new Room({ coordinates: { x: 0, y: 5, z: 0 } });
			const resultY = dungeon.addRoom(roomY);
			assert.strictEqual(resultY, false);

			// Try to add a room outside the z bounds
			const roomZ = new Room({ coordinates: { x: 0, y: 0, z: 5 } });
			const resultZ = dungeon.addRoom(roomZ);
			assert.strictEqual(resultZ, false);

			// Try to add a room with negative coordinates
			const roomNeg = new Room({ coordinates: { x: -1, y: 0, z: 0 } });
			const resultNeg = dungeon.addRoom(roomNeg);
			assert.strictEqual(resultNeg, false);

			// Verify a valid room can still be added
			const validRoom = new Room({ coordinates: { x: 1, y: 1, z: 0 } });
			const resultValid = dungeon.addRoom(validRoom);
			assert.strictEqual(resultValid, true);
			assert.strictEqual(validRoom.dungeon, dungeon);
		});
	});

	suite("DungeonObject", () => {
		test("should initialize with default values", () => {
			const obj = new DungeonObject();
			assert.strictEqual(obj.keywords, "dungeon object");
			assert.strictEqual(obj.display, "Dungeon Object");
			assert.strictEqual(obj.description, undefined);
			assert.deepStrictEqual(obj.contents, []);
			assert.strictEqual(obj.dungeon, undefined);
			assert.strictEqual(obj.location, undefined);
		});

		test("should manage contents correctly", () => {
			const container = new DungeonObject({
				keywords: "leather bag",
				display: "Leather Bag",
			});
			const item = new DungeonObject({
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
				keywords: "wooden box",
				display: "Wooden Box",
			});
			const item = new DungeonObject({
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
			const obj = new DungeonObject();

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

			const obj = new DungeonObject({ keywords: "test item" });
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
				keywords: "backpack",
				display: "Backpack",
			});
			const coin = new DungeonObject({ keywords: "coin" });
			const gem = new DungeonObject({ keywords: "gem" });

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
				keywords: "wooden chest",
				display: "Wooden Chest",
				description: "A sturdy wooden chest with iron bindings.",
			});
			const coin = new DungeonObject({
				keywords: "gold coin",
				display: "Gold Coin",
			});
			const sword = new DungeonObject({ keywords: "steel sword" });
			const gem = new DungeonObject({
				keywords: "ruby gem",
				description: "A brilliant red ruby that catches the light.",
			});
			const player = new Movable({ keywords: "player hero" });

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

			const obj1 = new DungeonObject({ keywords: "object1" });
			const obj2 = new DungeonObject({ keywords: "object2" });
			room.add(obj1);
			room.add(obj2);

			// Get initial contents
			const initialContents = dungeon.contents;
			const initialLength = initialContents.length;

			// Mutate the returned array
			initialContents.push(new DungeonObject({ keywords: "fake object" }));
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

			const obj1 = new DungeonObject({ keywords: "object1" });
			const obj2 = new DungeonObject({ keywords: "object2" });

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

			const obj1 = new DungeonObject({ keywords: "object1" });
			const obj2 = new DungeonObject({ keywords: "object2" });

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
			const obj3 = new DungeonObject({ keywords: "object3" });
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
				DUNGEON_REGISTRY.delete(id);
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
				DUNGEON_REGISTRY.delete(id);
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
				DUNGEON_REGISTRY.delete(id);
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
				DUNGEON_REGISTRY.delete(id);
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
				DUNGEON_REGISTRY.delete(id);
			}
		});
	});

	suite("Room", () => {
		test("should initialize with correct coordinates", () => {
			const coordinates = { x: 1, y: 2, z: 3 };
			const room = new Room({ coordinates });

			assert.deepStrictEqual(room.coordinates, coordinates);
			assert.strictEqual(room.x, coordinates.x);
			assert.strictEqual(room.y, coordinates.y);
			assert.strictEqual(room.z, coordinates.z);
		});

		test("should have default movement permissions", () => {
			const room = new Room({ coordinates: { x: 0, y: 0, z: 0 } });
			const movable = new Movable();

			assert(room.canEnter(movable));
			assert(room.canExit(movable));
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
				DUNGEON_REGISTRY.delete(id);
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
			const player = new Movable();
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
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			const roomA = dungeon.getRoom({ x: 0, y: 0, z: 0 });
			const roomB = dungeon.getRoom({ x: 2, y: 2, z: 0 });
			assert(roomA && roomB);

			const link = RoomLink.createTunnel(roomA, DIRECTION.UP, roomB);

			// Verify link works
			assert.strictEqual(roomA.getStep(DIRECTION.UP), roomB);
			assert.strictEqual(roomB.getStep(DIRECTION.DOWN), roomA);

			// Remove link
			link.remove();

			// Verify normal spatial relationships are restored
			assert.strictEqual(roomA.getStep(DIRECTION.UP), undefined);
			assert.strictEqual(roomB.getStep(DIRECTION.DOWN), undefined);
		});

		test("should handle multiple links per room", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
			});
			const center = dungeon.getRoom({ x: 1, y: 1, z: 0 });
			const north = dungeon.getRoom({ x: 1, y: 0, z: 0 });
			const south = dungeon.getRoom({ x: 1, y: 2, z: 0 });
			const east = dungeon.getRoom({ x: 2, y: 1, z: 0 });
			assert(center && north && south && east);

			// Create portal from center to each other room
			const link1 = RoomLink.createTunnel(center, DIRECTION.UP, north);
			const link2 = RoomLink.createTunnel(center, DIRECTION.DOWN, south);
			const link3 = RoomLink.createTunnel(center, DIRECTION.WEST, east);

			// Test all portals work
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

			// But removed link doesn't
			assert.strictEqual(center.getStep(DIRECTION.DOWN), undefined);
			assert.strictEqual(south.getStep(DIRECTION.UP), undefined);
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
			const player = new Movable();
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
			const movable = new Movable();
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
			const movable = new Movable();
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
			const movable = new Movable();
			assert.strictEqual(movable.getStep(DIRECTION.NORTH), undefined);
			assert.strictEqual(movable.getStep(DIRECTION.EAST), undefined);
			assert.strictEqual(movable.getStep(DIRECTION.UP), undefined);
		});

		test("canStep() should return false when not in a room", () => {
			const movable = new Movable();
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

			const movable = new Movable();
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

			const movable = new Movable();
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
			const movable = new Movable();
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
			const movable = new Movable();
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
			const movable = new Movable();
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
			const movable = new Movable();
			const centerRoom = dungeon.getRoom({ x: 1, y: 1, z: 1 });
			assert(centerRoom);
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
			assert(movable.canStep(DIRECTION.UP));
			movable.step(DIRECTION.UP);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 2 });

			// Return to center
			movable.step(DIRECTION.DOWN);
			assert.deepStrictEqual(movable.coordinates, { x: 1, y: 1, z: 1 });

			// Test DOWN movement
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
					DUNGEON_REGISTRY.delete(dungeonId);
				}
			});

			test("should not include location when object is not in a room", () => {
				const obj = new DungeonObject();
				const container = new DungeonObject();
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

				const obj = new DungeonObject();
				room.add(obj);

				const serialized = obj.serialize();
				assert.strictEqual(serialized.location, undefined);
			});

			test("should serialize deeply nested hierarchies", () => {
				const backpack = new DungeonObject({
					keywords: "leather backpack",
					display: "Leather Backpack",
				});
				const pouch = new DungeonObject({
					keywords: "small pouch",
					display: "Small Pouch",
				});
				const coin = new DungeonObject({
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
					keywords: "wooden chest",
					display: "Wooden Chest",
				});
				const sword = new DungeonObject({
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
					keywords: "player character",
					display: "Player Character",
				});

				const serialized = movable.serialize();
				assert.strictEqual(serialized.type, "Movable");
				assert.strictEqual(serialized.keywords, "player character");
			});

			test("should serialize Mob objects with correct type", () => {
				const mob = new Mob({
					keywords: "orc warrior",
					display: "Orc Warrior",
				});

				const serialized = mob.serialize();
				assert.strictEqual(serialized.type, "Mob");
				assert.strictEqual(serialized.keywords, "orc warrior");
			});

			test("should serialize Item objects with correct type", () => {
				const item = new Item({
					keywords: "magic potion",
					display: "Magic Potion",
				});

				const serialized = item.serialize();
				assert.strictEqual(serialized.type, "Item");
				assert.strictEqual(serialized.keywords, "magic potion");
			});

			test("should serialize Prop objects with correct type", () => {
				const prop = new Prop({
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

			test("should deserialize nested contents recursively", () => {
				const data: SerializedDungeonObject = {
					type: "DungeonObject",
					keywords: "wooden chest",
					display: "Wooden Chest",
					description: "A wooden chest.",
					contents: [
						{
							type: "DungeonObject",
							keywords: "gold coin",
							display: "Gold Coin",
							description: "A shiny gold coin.",
							contents: [],
						},
						{
							type: "Item",
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
					keywords: "leather backpack",
					display: "Leather Backpack",
					description: "A worn leather backpack.",
					contents: [
						{
							type: "DungeonObject",
							keywords: "small pouch",
							display: "Small Pouch",
							description: "A small cloth pouch.",
							contents: [
								{
									type: "DungeonObject",
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
					keywords: "treasure room",
					display: "Treasure Room",
					description: "A room filled with treasure.",
					contents: [],
					coordinates: { x: 5, y: 3, z: 1 },
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
					keywords: "start room",
					display: "Starting Room",
					description: "Where the adventure begins.",
					coordinates: { x: 0, y: 0, z: 0 },
					contents: [
						{
							type: "DungeonObject",
							keywords: "wooden table",
							display: "Wooden Table",
							description: "A simple wooden table.",
							contents: [],
						},
						{
							type: "Movable",
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
					keywords: "orc warrior",
					display: "Orc Warrior",
					description: "A fierce orc warrior.",
					contents: [],
				};

				const mob = DungeonObject.deserialize(data);

				assert(mob instanceof Mob);
				assert.strictEqual(mob.keywords, "orc warrior");
			});

			test("should deserialize Item objects correctly", () => {
				const data: SerializedItem = {
					type: "Item",
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
					keywords: "treasure chest",
					display: "Treasure Chest",
					description: "A chest full of various treasures.",
					contents: [
						{
							type: "Item",
							keywords: "magic sword",
							display: "Magic Sword",
							description: "A magical blade.",
							contents: [],
						},
						{
							type: "DungeonObject",
							keywords: "coin purse",
							display: "Coin Purse",
							description: "A small purse.",
							contents: [
								{
									type: "Item",
									keywords: "gold coin",
									display: "Gold Coin",
									description: "A shiny coin.",
									contents: [],
								},
							],
						},
						{
							type: "Prop",
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
				keywords: "gold coin",
				display: "Gold Coin",
			});
			const coin2 = new Item({
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
					keywords: "rusty sword blade",
					display: "Rusty Sword",
					description: "A rusty but still dangerous sword.",
				});
				const potion = new Item({
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
				DUNGEON_REGISTRY.delete(dungeonId);
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
				DUNGEON_REGISTRY.delete(dungeonId);
			}
		});

		test("should handle objects without location correctly", () => {
			const container = new DungeonObject({
				keywords: "storage box",
				display: "Storage Box",
			});
			const item = new Item({
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
});
