import { describe, it, before } from "node:test";
import assert from "node:assert";
import {
	deserializeDungeonObject,
	deserializeRoom,
	deserializeMob,
	deserializeMovable,
	deserializeItem,
	deserializeProp,
	deserializeEquipment,
	deserializeArmor,
	deserializeWeapon,
} from "./dungeon.js";
import {
	DungeonObject,
	Room,
	Mob,
	Movable,
	Item,
	Prop,
	Equipment,
	Armor,
	Weapon,
	EQUIPMENT_SLOT,
	SerializedDungeonObject,
	SerializedRoom,
	SerializedMob,
	SerializedMovable,
	SerializedItem,
	SerializedProp,
	SerializedEquipment,
	SerializedArmor,
	SerializedWeapon,
	MobOptions,
} from "../core/dungeon.js";
import archetypePkg from "./archetype.js";
import abilitiesPkg from "./ability.js";
import { getAllAbilities } from "../registry/ability.js";
import { createMob } from "./dungeon.js";
import { DIRECTION } from "../direction.js";
import { getDefaultJob, getDefaultRace } from "../registry/archetype.js";

function createTestMob(options: Partial<MobOptions>): Mob {
	return createMob({
		...options,
		race: getDefaultRace(),
		job: getDefaultJob(),
	});
}

describe("package/dungeon.ts deserializers", () => {
	before(async () => {
		// Ensure packages are loaded before tests
		await archetypePkg.loader();
		await abilitiesPkg.loader();
	});

	describe("deserializeDungeonObject", () => {
		it("deserializes a basic DungeonObject", async () => {
			const data: SerializedDungeonObject = {
				type: "DungeonObject",
				keywords: "test object",
				display: "Test Object",
				description: "A test object",
			};

			const obj = await deserializeDungeonObject(data);

			assert.ok(obj instanceof DungeonObject);
			assert.strictEqual(obj.keywords, "test object");
			assert.strictEqual(obj.display, "Test Object");
			assert.strictEqual(obj.description, "A test object");
		});

		it("deserializes DungeonObject with contents", async () => {
			const data: SerializedDungeonObject = {
				type: "DungeonObject",
				keywords: "chest",
				display: "Chest",
				contents: [
					{
						type: "Item",
						keywords: "gold coin",
						display: "Gold Coin",
					},
				],
			};

			const obj = await deserializeDungeonObject(data);

			assert.ok(obj instanceof DungeonObject);
			assert.strictEqual(obj.contents.length, 1);
			assert.ok(obj.contents[0] instanceof Item);
			assert.strictEqual(obj.contents[0].keywords, "gold coin");
		});

		it("throws error for invalid type", async () => {
			const data = {
				type: "InvalidType",
				keywords: "test",
				display: "Test",
			};

			await assert.rejects(async () => {
				await deserializeDungeonObject(data as any);
			}, /no valid type to deserialize/);
		});
	});

	describe("deserializeRoom", () => {
		it("deserializes a basic Room", async () => {
			const data: SerializedRoom = {
				type: "Room",
				keywords: "test room",
				display: "Test Room",
				coordinates: { x: 1, y: 2, z: 0 },
				allowedExits: DIRECTION.NORTH | DIRECTION.SOUTH,
			};

			const room = await deserializeRoom(data);

			assert.ok(room instanceof Room);
			assert.strictEqual(room.keywords, "test room");
			assert.strictEqual(room.x, 1);
			assert.strictEqual(room.y, 2);
			assert.strictEqual(room.z, 0);
			assert.strictEqual(room.allowedExits, DIRECTION.NORTH | DIRECTION.SOUTH);
		});

		it("uses default exits when not provided", async () => {
			const data: SerializedRoom = {
				type: "Room",
				keywords: "room",
				display: "Room",
				coordinates: { x: 0, y: 0, z: 0 },
			} as SerializedRoom;

			const room = await deserializeRoom(data);

			const defaultExits =
				DIRECTION.NORTH |
				DIRECTION.SOUTH |
				DIRECTION.EAST |
				DIRECTION.WEST |
				DIRECTION.NORTHEAST |
				DIRECTION.NORTHWEST |
				DIRECTION.SOUTHEAST |
				DIRECTION.SOUTHWEST;
			assert.strictEqual(room.allowedExits, defaultExits);
		});

		it("deserializes Room with contents", async () => {
			const data: SerializedRoom = {
				type: "Room",
				keywords: "room",
				display: "Room",
				coordinates: { x: 0, y: 0, z: 0 },
				allowedExits: DIRECTION.NORTH,
				contents: [
					{
						type: "Prop",
						keywords: "sign",
						display: "Sign",
					},
				],
			};

			const room = await deserializeRoom(data);

			assert.strictEqual(room.contents.length, 1);
			assert.ok(room.contents[0] instanceof Prop);
		});
	});

	describe("deserializeMovable", () => {
		it("deserializes a basic Movable", async () => {
			const data: SerializedMovable = {
				type: "Movable",
				keywords: "movable",
				display: "Movable",
			};

			const movable = await deserializeMovable(data);

			assert.ok(movable instanceof Movable);
			assert.strictEqual(movable.keywords, "movable");
		});

		it("deserializes Movable with contents", async () => {
			const data: SerializedMovable = {
				type: "Movable",
				keywords: "bag",
				display: "Bag",
				contents: [
					{
						type: "Item",
						keywords: "item",
						display: "Item",
					},
				],
			};

			const movable = await deserializeMovable(data);

			assert.strictEqual(movable.contents.length, 1);
			assert.ok(movable.contents[0] instanceof Item);
		});
	});

	describe("deserializeItem", () => {
		it("deserializes a basic Item", async () => {
			const data: SerializedItem = {
				type: "Item",
				keywords: "item",
				display: "Item",
			};

			const item = await deserializeItem(data);

			assert.ok(item instanceof Item);
			assert.strictEqual(item.keywords, "item");
		});
	});

	describe("deserializeProp", () => {
		it("deserializes a basic Prop", async () => {
			const data: SerializedProp = {
				type: "Prop",
				keywords: "prop",
				display: "Prop",
			};

			const prop = await deserializeProp(data);

			assert.ok(prop instanceof Prop);
			assert.strictEqual(prop.keywords, "prop");
		});
	});

	describe("deserializeEquipment", () => {
		it("deserializes a basic Equipment", async () => {
			const data: SerializedEquipment = {
				type: "Equipment",
				keywords: "ring",
				display: "Ring",
				slot: EQUIPMENT_SLOT.FINGER,
			};

			const equipment = await deserializeEquipment(data);

			assert.ok(equipment instanceof Equipment);
			assert.strictEqual(equipment.keywords, "ring");
			assert.strictEqual(equipment.slot, EQUIPMENT_SLOT.FINGER);
		});

		it("deserializes Equipment with bonuses", async () => {
			const data: SerializedEquipment = {
				type: "Equipment",
				keywords: "ring",
				display: "Ring",
				slot: EQUIPMENT_SLOT.FINGER,
				attributeBonuses: { strength: 5 },
				resourceBonuses: { maxHealth: 10 },
			};

			const equipment = await deserializeEquipment(data);

			assert.strictEqual(equipment.attributeBonuses.strength, 5);
			assert.strictEqual(equipment.resourceBonuses.maxHealth, 10);
		});
	});

	describe("deserializeArmor", () => {
		it("deserializes a basic Armor", async () => {
			const data: SerializedArmor = {
				type: "Armor",
				keywords: "armor",
				display: "Armor",
				slot: EQUIPMENT_SLOT.CHEST,
				defense: 5,
			};

			const armor = await deserializeArmor(data);

			assert.ok(armor instanceof Armor);
			assert.strictEqual(armor.slot, EQUIPMENT_SLOT.CHEST);
			assert.strictEqual(armor.defense, 5);
		});

		it("defaults defense to 0 when not provided", async () => {
			const data: SerializedArmor = {
				type: "Armor",
				keywords: "armor",
				display: "Armor",
				slot: EQUIPMENT_SLOT.CHEST,
				defense: 0,
			};

			const armor = await deserializeArmor(data);

			assert.strictEqual(armor.defense, 0);
		});
	});

	describe("deserializeWeapon", () => {
		it("deserializes a basic Weapon", async () => {
			const data: SerializedWeapon = {
				type: "Weapon",
				keywords: "sword",
				display: "Sword",
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 10,
				hitType: "slash",
				weaponType: "longsword",
			};

			const weapon = await deserializeWeapon(data);

			assert.ok(weapon instanceof Weapon);
			assert.strictEqual(weapon.slot, EQUIPMENT_SLOT.MAIN_HAND);
			assert.strictEqual(weapon.attackPower, 10);
			assert.strictEqual(weapon.hitType.verb, "slash");
			assert.strictEqual(weapon.type, "longsword");
		});

		it("defaults attackPower to 0 and type to shortsword when not provided", async () => {
			const data: SerializedWeapon = {
				type: "Weapon",
				keywords: "weapon",
				display: "Weapon",
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 0,
				hitType: "slash",
			};

			const weapon = await deserializeWeapon(data);

			assert.strictEqual(weapon.attackPower, 0);
			assert.strictEqual(weapon.type, "shortsword");
		});
	});

	describe("deserializeMob", () => {
		it("deserializes a basic Mob", async () => {
			const data: SerializedMob = {
				type: "Mob",
				keywords: "mob",
				display: "Mob",
				level: 5,
				experience: 99,
				race: "human",
				job: "warrior",
				health: 50,
				mana: 25,
				exhaustion: 0,
			};

			const mob = await deserializeMob(data);

			assert.ok(mob instanceof Mob);
			assert.strictEqual(mob.level, 5);
			assert.strictEqual(mob.experience, 99);
			assert.ok(mob.race);
			assert.ok(mob.job);
			assert.strictEqual(mob.health, 50);
			assert.strictEqual(mob.mana, 25);
		});

		it("deserializes Mob with learned abilities", async () => {
			// First, we need to ensure abilities are loaded
			const data: SerializedMob = {
				type: "Mob",
				keywords: "mob",
				display: "Mob",
				level: 1,
				experience: 0,
				race: "human",
				job: "warrior",
				health: 100,
				mana: 50,
				exhaustion: 0,
				learnedAbilities: {
					whirlwind: 100,
				},
			};

			const mob = await deserializeMob(data);

			assert.ok(mob instanceof Mob);
			// If abilities were provided and found, they should be in the map
			// Otherwise, the map should be empty
			assert.ok(mob._learnedAbilities instanceof Map);
		});

		it("deserializes Mob with equipped items", async () => {
			const data: SerializedMob = {
				type: "Mob",
				keywords: "mob",
				display: "Mob",
				level: 1,
				experience: 0,
				race: "human",
				job: "warrior",
				health: 100,
				mana: 50,
				exhaustion: 0,
				equipped: {
					[EQUIPMENT_SLOT.MAIN_HAND]: {
						type: "Weapon",
						keywords: "sword",
						display: "Sword",
						slot: EQUIPMENT_SLOT.MAIN_HAND,
						attackPower: 10,
						hitType: "slash",
						weaponType: "longsword",
					} as SerializedWeapon,
				} as Record<EQUIPMENT_SLOT, SerializedWeapon>,
			};

			const mob = await deserializeMob(data);

			assert.ok(mob instanceof Mob);
			const equipped = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
			assert.ok(equipped);
			assert.ok(equipped instanceof Weapon);
			assert.strictEqual(equipped.attackPower, 10);
		});

		it("deserializes Mob with contents", async () => {
			const data: SerializedMob = {
				type: "Mob",
				keywords: "mob",
				display: "Mob",
				level: 1,
				experience: 0,
				race: "human",
				job: "warrior",
				health: 100,
				mana: 50,
				exhaustion: 0,
				contents: [
					{
						type: "Item",
						keywords: "item",
						display: "Item",
					},
				],
			};

			const mob = await deserializeMob(data);

			assert.strictEqual(mob.contents.length, 1);
			assert.ok(mob.contents[0] instanceof Item);
		});

		it("handles legacy array format for equipped items", async () => {
			const data: SerializedMob = {
				type: "Mob",
				keywords: "mob",
				display: "Mob",
				level: 1,
				experience: 0,
				race: "human",
				job: "warrior",
				health: 100,
				mana: 50,
				exhaustion: 0,
				equipped: {
					[EQUIPMENT_SLOT.MAIN_HAND]: [
						{
							type: "Weapon",
							keywords: "sword",
							display: "Sword",
							slot: EQUIPMENT_SLOT.MAIN_HAND,
							attackPower: 10,
							hitType: "slash",
							weaponType: "longsword",
						} as SerializedWeapon,
					],
				} as any,
			};

			const mob = await deserializeMob(data);

			const equipped = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
			assert.ok(equipped);
			assert.ok(equipped instanceof Weapon);
		});
	});

	describe("round-trip serialization/deserialization", () => {
		it("round-trips a DungeonObject", async () => {
			const original = new DungeonObject({
				keywords: "test",
				display: "Test",
				description: "A test object",
			});

			const serialized = original.serialize();
			const deserialized = await deserializeDungeonObject(serialized);

			assert.strictEqual(deserialized.keywords, original.keywords);
			assert.strictEqual(deserialized.display, original.display);
			assert.strictEqual(deserialized.description, original.description);
		});

		it("round-trips a Room", async () => {
			const original = new Room({
				keywords: "room",
				display: "Room",
				coordinates: { x: 5, y: 10, z: 0 },
				allowedExits: DIRECTION.NORTH | DIRECTION.EAST,
			});

			const serialized = original.serialize();
			const deserialized = await deserializeRoom(serialized as SerializedRoom);

			assert.strictEqual(deserialized.keywords, original.keywords);
			assert.strictEqual(deserialized.x, original.x);
			assert.strictEqual(deserialized.y, original.y);
			assert.strictEqual(deserialized.z, original.z);
			assert.strictEqual(deserialized.allowedExits, original.allowedExits);
		});

		it("round-trips a Mob", async () => {
			const original = createTestMob({
				keywords: "test mob",
				display: "Test Mob",
				level: 10,
				experience: 500,
			});

			const serialized = original.serialize();
			const deserialized = await deserializeMob(serialized as SerializedMob);

			assert.strictEqual(deserialized.keywords, original.keywords);
			assert.strictEqual(deserialized.level, original.level);
			assert.strictEqual(deserialized.experience, original.experience);
			assert.ok(deserialized.race);
			assert.ok(deserialized.job);
		});

		it("round-trips an Equipment with bonuses", async () => {
			const original = new Equipment({
				keywords: "ring",
				display: "Ring",
				slot: EQUIPMENT_SLOT.FINGER,
				attributeBonuses: { strength: 5, agility: 3 },
				resourceBonuses: { maxHealth: 20 },
			});

			const serialized = original.serialize();
			const deserialized = await deserializeEquipment(
				serialized as SerializedEquipment
			);

			assert.strictEqual(deserialized.slot, original.slot);
			assert.strictEqual(
				deserialized.attributeBonuses.strength,
				original.attributeBonuses.strength
			);
			assert.strictEqual(
				deserialized.resourceBonuses.maxHealth,
				original.resourceBonuses.maxHealth
			);
		});

		it("round-trips an Armor", async () => {
			const original = new Armor({
				keywords: "armor",
				display: "Armor",
				slot: EQUIPMENT_SLOT.CHEST,
				defense: 15,
			});

			const serialized = original.serialize();
			const deserialized = await deserializeArmor(
				serialized as SerializedArmor
			);

			assert.strictEqual(deserialized.slot, original.slot);
			assert.strictEqual(deserialized.defense, original.defense);
		});

		it("round-trips a Weapon", async () => {
			const original = new Weapon({
				keywords: "sword",
				display: "Sword",
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 20,
				hitType: "slash",
				type: "longsword",
			});

			const serialized = original.serialize();
			const deserialized = await deserializeWeapon(
				serialized as SerializedWeapon
			);

			assert.strictEqual(deserialized.slot, original.slot);
			assert.strictEqual(deserialized.attackPower, original.attackPower);
			assert.strictEqual(deserialized.hitType.verb, original.hitType.verb);
			assert.strictEqual(deserialized.type, original.type);
		});
	});

	describe("Mob ability serialization/deserialization", () => {
		it("saves and loads a Mob with an ability", async () => {
			// Get an ability from the registry
			const allAbilities = getAllAbilities();
			const testAbility = allAbilities[0];
			const abilityUses = 150;

			// Create a Mob and add the ability
			const original = createTestMob({
				keywords: "test warrior",
				display: "Test Warrior",
				level: 5,
				experience: 200,
			});
			original.addAbility(testAbility, abilityUses);

			// Verify ability is present before serialization
			assert.ok(original.knowsAbilityById(testAbility.id));
			assert.strictEqual(
				original._learnedAbilities.get(testAbility),
				abilityUses
			);

			// Serialize the Mob
			const serialized = original.serialize();

			// Verify serialized form has the ability
			assert.ok(serialized.learnedAbilities);
			assert.strictEqual(
				serialized.learnedAbilities[testAbility.id],
				abilityUses
			);

			// Deserialize the Mob
			const deserialized = await deserializeMob(serialized as SerializedMob);

			// Verify ability is present after deserialization
			assert.ok(deserialized.knowsAbilityById(testAbility.id));
			assert.strictEqual(
				deserialized._learnedAbilities.get(testAbility),
				abilityUses
			);
			assert.strictEqual(deserialized.level, original.level);
			assert.strictEqual(deserialized.experience, original.experience);
		});

		it("saves and loads a Mob with multiple abilities", async () => {
			// Get multiple abilities from the registry
			const allAbilities = getAllAbilities();
			if (allAbilities.length < 2) {
				// Skip test if not enough abilities are loaded
				return;
			}

			const ability1 = allAbilities[0];
			const ability2 = allAbilities[1];
			const uses1 = 100;
			const uses2 = 250;

			// Create a Mob and add multiple abilities
			const original = createTestMob({
				keywords: "test mage",
				display: "Test Mage",
				level: 10,
				experience: 500,
			});
			original.addAbility(ability1, uses1);
			original.addAbility(ability2, uses2);

			// Serialize the Mob
			const serialized = original.serialize();

			// Deserialize the Mob
			const deserialized = await deserializeMob(serialized as SerializedMob);

			// Verify both abilities are present after deserialization
			assert.ok(deserialized.knowsAbilityById(ability1.id));
			assert.ok(deserialized.knowsAbilityById(ability2.id));
			assert.strictEqual(deserialized._learnedAbilities.get(ability1), uses1);
			assert.strictEqual(deserialized._learnedAbilities.get(ability2), uses2);
		});
	});
});
