import { suite, test } from "node:test";
import assert from "node:assert";
import { Equipment, Armor, Weapon, EQUIPMENT_SLOT } from "./dungeon.js";
import { Mob } from "./dungeon.js";
import { DungeonObject } from "./dungeon.js";

suite("equipment.ts", () => {
	suite("Equipment", () => {
		test("should create equipment with required slot", () => {
			const helmet = new Equipment({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				display: "A Steel Helmet",
			});

			assert.strictEqual(helmet.slot, EQUIPMENT_SLOT.HEAD);
			assert.strictEqual(helmet.defense, 0);
			assert.strictEqual(helmet.attackPower, 0);
			assert.strictEqual(helmet.keywords, "helmet");
			assert.strictEqual(helmet.display, "A Steel Helmet");
		});

		test("should create equipment with attribute bonuses", () => {
			const ring = new Equipment({
				slot: EQUIPMENT_SLOT.FINGER,
				keywords: "ring",
				display: "Ring of Strength",
				attributeBonuses: { strength: 5, agility: 2 },
			});

			assert.strictEqual(ring.attributeBonuses.strength, 5);
			assert.strictEqual(ring.attributeBonuses.agility, 2);
			assert.strictEqual(ring.attributeBonuses.intelligence, undefined);
		});

		test("should create equipment with resource bonuses", () => {
			const amulet = new Equipment({
				slot: EQUIPMENT_SLOT.NECK,
				keywords: "amulet",
				display: "Amulet of Health",
				resourceBonuses: { maxHealth: 50, maxMana: 25 },
			});

			assert.strictEqual(amulet.resourceBonuses.maxHealth, 50);
			assert.strictEqual(amulet.resourceBonuses.maxMana, 25);
		});

		test("should create equipment with secondary attribute bonuses", () => {
			const relic = new Equipment({
				slot: EQUIPMENT_SLOT.OFF_HAND,
				keywords: "relic",
				display: "Relic of Power",
				secondaryAttributeBonuses: { critRate: 0.05, attackPower: 5 },
			});

			assert.strictEqual(relic.secondaryAttributeBonuses.critRate, 0.05);
			assert.strictEqual(relic.secondaryAttributeBonuses.attackPower, 5);
		});

		test("should serialize and deserialize equipment", () => {
			const ring = new Equipment({
				slot: EQUIPMENT_SLOT.FINGER,
				keywords: "ring",
				display: "Ring of Strength",
				attributeBonuses: { strength: 3 },
				secondaryAttributeBonuses: { critRate: 0.02 },
			});

			const serialized = ring.serialize();
			assert.strictEqual(serialized.type, "Equipment");
			assert.strictEqual(serialized.slot, EQUIPMENT_SLOT.FINGER);
			assert.strictEqual(serialized.attributeBonuses?.strength, 3);
			assert.strictEqual(serialized.secondaryAttributeBonuses?.critRate, 0.02);

			const deserialized = Equipment.deserialize(serialized as any);
			assert.strictEqual(deserialized.slot, EQUIPMENT_SLOT.FINGER);
			assert.strictEqual(deserialized.defense, 0);
			assert.strictEqual(deserialized.attackPower, 0);
			assert.strictEqual(deserialized.attributeBonuses.strength, 3);
			assert.strictEqual(deserialized.secondaryAttributeBonuses.critRate, 0.02);
		});
	});

	suite("Armor", () => {
		test("should create armor with defense", () => {
			const armor = new Armor({
				slot: EQUIPMENT_SLOT.CHEST,
				keywords: "armor",
				display: "Plate Armor",
				defense: 10,
			});

			assert.strictEqual(armor.slot, EQUIPMENT_SLOT.CHEST);
			assert.strictEqual(armor.defense, 10);
			assert.strictEqual(armor.attackPower, 0);
			assert.ok(armor instanceof Armor);
			assert.ok(armor instanceof Equipment);
		});

		test("should serialize and deserialize armor", () => {
			const helmet = new Armor({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				display: "Steel Helmet",
				defense: 5,
				attributeBonuses: { strength: 2 },
			});

			const serialized = helmet.serialize();
			assert.strictEqual(serialized.type, "Armor");
			assert.strictEqual(serialized.slot, EQUIPMENT_SLOT.HEAD);
			assert.strictEqual(serialized.defense, 5);
			assert.strictEqual(serialized.attributeBonuses?.strength, 2);

			const deserialized = Armor.deserialize(serialized as any);
			assert.ok(deserialized instanceof Armor);
			assert.strictEqual(deserialized.slot, EQUIPMENT_SLOT.HEAD);
			assert.strictEqual(deserialized.defense, 5);
			assert.strictEqual(deserialized.attackPower, 0);
			assert.strictEqual(deserialized.attributeBonuses.strength, 2);
		});

		test("should apply template with defense", () => {
			const armor = new Armor({
				slot: EQUIPMENT_SLOT.CHEST,
				defense: 0,
			});

			armor.applyTemplate({
				id: "test-armor",
				type: "Armor",
				keywords: "armor",
				display: "Test Armor",
				defense: 15,
			} as any);

			assert.strictEqual(armor.defense, 15);
		});
	});

	suite("Weapon", () => {
		test("should create weapon with attack power", () => {
			const sword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				keywords: "sword",
				display: "Steel Sword",
				attackPower: 10,
			});

			assert.strictEqual(sword.slot, EQUIPMENT_SLOT.MAIN_HAND);
			assert.strictEqual(sword.attackPower, 10);
			assert.strictEqual(sword.defense, 0);
			assert.ok(sword instanceof Weapon);
			assert.ok(sword instanceof Equipment);
		});

		test("should serialize and deserialize weapon", () => {
			const sword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				keywords: "sword",
				display: "Steel Sword",
				attackPower: 8,
				attributeBonuses: { strength: 3 },
			});

			const serialized = sword.serialize();
			assert.strictEqual(serialized.type, "Weapon");
			assert.strictEqual(serialized.slot, EQUIPMENT_SLOT.MAIN_HAND);
			assert.strictEqual(serialized.attackPower, 8);
			assert.strictEqual(serialized.attributeBonuses?.strength, 3);

			const deserialized = Weapon.deserialize(serialized as any);
			assert.ok(deserialized instanceof Weapon);
			assert.strictEqual(deserialized.slot, EQUIPMENT_SLOT.MAIN_HAND);
			assert.strictEqual(deserialized.attackPower, 8);
			assert.strictEqual(deserialized.defense, 0);
			assert.strictEqual(deserialized.attributeBonuses.strength, 3);
		});

		test("should apply template with attackPower", () => {
			const weapon = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 0,
			});

			weapon.applyTemplate({
				id: "test-weapon",
				type: "Weapon",
				keywords: "sword",
				display: "Test Sword",
				attackPower: 12,
			} as any);

			assert.strictEqual(weapon.attackPower, 12);
		});
	});

	suite("Mob Equipment", () => {
		test("should equip armor to mob", () => {
			const mob = new Mob();
			const helmet = new Armor({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				display: "Helmet",
				defense: 5,
			});

			const oldHelmet = mob.equip(helmet);
			assert.strictEqual(oldHelmet, undefined);
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.HEAD), helmet);
			assert.strictEqual(mob.getTotalDefense(), 5);
			assert.strictEqual(mob.getTotalAttackPower(), 0);
		});

		test("should equip weapon to mob", () => {
			const mob = new Mob();
			const sword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				keywords: "sword",
				display: "Sword",
				attackPower: 10,
			});

			const oldSword = mob.equip(sword);
			assert.strictEqual(oldSword, undefined);
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND), sword);
			assert.strictEqual(mob.getTotalAttackPower(), 10);
			assert.strictEqual(mob.getTotalDefense(), 0);
		});

		test("should replace equipped item when equipping to same slot", () => {
			const mob = new Mob();
			const oldHelmet = new Armor({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "old helmet",
				display: "Old Helmet",
				defense: 3,
			});
			const newHelmet = new Armor({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "new helmet",
				display: "New Helmet",
				defense: 8,
			});

			mob.equip(oldHelmet);
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.HEAD), oldHelmet);
			assert.strictEqual(mob.getTotalDefense(), 3);

			mob.equip(newHelmet);
			// Old helmet should be replaced by new helmet
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.HEAD), newHelmet);
			assert.notStrictEqual(mob.getEquipped(EQUIPMENT_SLOT.HEAD), oldHelmet);
			assert.strictEqual(mob.getTotalDefense(), 8);
		});

		test("should unequip item from mob by slot", () => {
			const mob = new Mob();
			const armor = new Armor({
				slot: EQUIPMENT_SLOT.CHEST,
				keywords: "armor",
				display: "Armor",
				defense: 10,
			});

			mob.equip(armor);
			const unequipped = mob.unequipBySlot(EQUIPMENT_SLOT.CHEST);

			assert.strictEqual(unequipped, armor);
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.CHEST), undefined);
			assert.strictEqual(mob.getTotalDefense(), 0);
		});

		test("should apply equipment attribute bonuses to mob", () => {
			const mob = new Mob();
			const baseStrength = mob.primaryAttributes.strength;

			const ring = new Equipment({
				slot: EQUIPMENT_SLOT.FINGER,
				keywords: "ring",
				display: "Ring of Strength",
				attributeBonuses: { strength: 5 },
			});

			mob.equip(ring);
			assert.strictEqual(mob.primaryAttributes.strength, baseStrength + 5);
		});

		test("should apply equipment resource bonuses to mob", () => {
			const mob = new Mob();
			const baseMaxHealth = mob.maxHealth;

			const amulet = new Equipment({
				slot: EQUIPMENT_SLOT.NECK,
				keywords: "amulet",
				display: "Amulet of Health",
				resourceBonuses: { maxHealth: 50 },
			});

			mob.equip(amulet);
			assert.strictEqual(mob.maxHealth, baseMaxHealth + 50);
		});

		test("should handle multiple armor pieces", () => {
			const mob = new Mob();
			const helmet = new Armor({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				defense: 5,
			});
			const armor = new Armor({
				slot: EQUIPMENT_SLOT.CHEST,
				keywords: "armor",
				defense: 10,
			});
			const boots = new Armor({
				slot: EQUIPMENT_SLOT.FEET,
				keywords: "boots",
				defense: 3,
			});

			mob.equip(helmet);
			mob.equip(armor);
			mob.equip(boots);

			assert.strictEqual(mob.getTotalDefense(), 18);
			assert.strictEqual(mob.getTotalAttackPower(), 0);
			assert.strictEqual(mob.getAllEquipped().length, 3);
		});

		test("should handle multiple weapons", () => {
			const mob = new Mob();
			const sword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				keywords: "sword",
				attackPower: 10,
			});
			const dagger = new Weapon({
				slot: EQUIPMENT_SLOT.OFF_HAND,
				keywords: "dagger",
				attackPower: 5,
			});

			mob.equip(sword);
			mob.equip(dagger);

			assert.strictEqual(mob.getTotalAttackPower(), 15);
			assert.strictEqual(mob.getTotalDefense(), 0);
			assert.strictEqual(mob.getAllEquipped().length, 2);
		});

		test("should only count armor for total defense", () => {
			const mob = new Mob();
			const helmet = new Armor({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				defense: 5,
			});
			const sword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				keywords: "sword",
				attackPower: 10,
			});
			const ring = new Equipment({
				slot: EQUIPMENT_SLOT.FINGER,
				keywords: "ring",
			});

			mob.equip(helmet);
			mob.equip(sword);
			mob.equip(ring);

			// Only armor should contribute to defense
			assert.strictEqual(mob.getTotalDefense(), 5);
		});

		test("should only count weapons for total attack power", () => {
			const mob = new Mob();
			const helmet = new Armor({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				defense: 5,
			});
			const sword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				keywords: "sword",
				attackPower: 10,
			});
			const ring = new Equipment({
				slot: EQUIPMENT_SLOT.FINGER,
				keywords: "ring",
			});

			mob.equip(helmet);
			mob.equip(sword);
			mob.equip(ring);

			// Only weapons should contribute to attack power
			assert.strictEqual(mob.getTotalAttackPower(), 10);
		});

		test("should serialize and deserialize mob with armor", () => {
			const mob = new Mob();
			const helmet = new Armor({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				defense: 5,
				attributeBonuses: { strength: 2 },
			});

			mob.equip(helmet);
			const serialized = mob.serialize();

			assert(serialized.equipped);
			const headEquipped = serialized.equipped[EQUIPMENT_SLOT.HEAD];
			assert(headEquipped);
			// Handle both single items and arrays (for backward compatibility with old saves)
			const equippedData = Array.isArray(headEquipped)
				? headEquipped[0]
				: headEquipped;
			assert.strictEqual(equippedData.type, "Armor");

			const deserialized = Mob.deserialize(serialized);
			const deserializedHelmet = deserialized.getEquipped(EQUIPMENT_SLOT.HEAD);

			assert(deserializedHelmet);
			assert.ok(deserializedHelmet instanceof Armor);
			assert.strictEqual(deserializedHelmet.defense, 5);
			assert.strictEqual(deserializedHelmet.attackPower, 0);
			assert.strictEqual(deserializedHelmet.attributeBonuses.strength, 2);
			assert.strictEqual(deserialized.getTotalDefense(), 5);
		});

		test("should serialize and deserialize mob with weapon", () => {
			const mob = new Mob();
			const sword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				keywords: "sword",
				attackPower: 8,
				attributeBonuses: { strength: 3 },
			});

			mob.equip(sword);
			const serialized = mob.serialize();

			assert(serialized.equipped);
			const mainHandEquipped = serialized.equipped[EQUIPMENT_SLOT.MAIN_HAND];
			assert(mainHandEquipped);
			const equippedData = Array.isArray(mainHandEquipped)
				? mainHandEquipped[0]
				: mainHandEquipped;
			assert.strictEqual(equippedData.type, "Weapon");

			const deserialized = Mob.deserialize(serialized);
			const deserializedSword = deserialized.getEquipped(
				EQUIPMENT_SLOT.MAIN_HAND
			);

			assert(deserializedSword);
			assert.ok(deserializedSword instanceof Weapon);
			assert.strictEqual(deserializedSword.attackPower, 8);
			assert.strictEqual(deserializedSword.defense, 0);
			assert.strictEqual(deserializedSword.attributeBonuses.strength, 3);
			assert.strictEqual(deserialized.getTotalAttackPower(), 8);
		});

		test("should equip items in every slot at once", () => {
			const mob = new Mob();

			// Create equipment for every slot (using Armor for armor slots, Weapon for weapon slots, Equipment for others)
			const allEquipment = [
				new Armor({
					slot: EQUIPMENT_SLOT.HEAD,
					keywords: "helmet",
					display: "Helmet",
					defense: 5,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.NECK,
					keywords: "amulet",
					display: "Amulet",
				}),
				new Armor({
					slot: EQUIPMENT_SLOT.SHOULDERS,
					keywords: "pauldrons",
					display: "Pauldrons",
					defense: 4,
				}),
				new Armor({
					slot: EQUIPMENT_SLOT.CHEST,
					keywords: "armor",
					display: "Armor",
					defense: 10,
				}),
				new Armor({
					slot: EQUIPMENT_SLOT.HANDS,
					keywords: "gloves",
					display: "Gloves",
					defense: 3,
				}),
				new Armor({
					slot: EQUIPMENT_SLOT.WAIST,
					keywords: "belt",
					display: "Belt",
					defense: 2,
				}),
				new Armor({
					slot: EQUIPMENT_SLOT.LEGS,
					keywords: "leggings",
					display: "Leggings",
					defense: 6,
				}),
				new Armor({
					slot: EQUIPMENT_SLOT.FEET,
					keywords: "boots",
					display: "Boots",
					defense: 3,
				}),
				new Weapon({
					slot: EQUIPMENT_SLOT.MAIN_HAND,
					keywords: "sword",
					display: "Sword",
					attackPower: 8,
				}),
				new Weapon({
					slot: EQUIPMENT_SLOT.OFF_HAND,
					keywords: "shield",
					display: "Shield",
					attackPower: 5,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.FINGER,
					keywords: "ring",
					display: "Ring",
				}),
			];

			// Equip all items
			for (const equipment of allEquipment) {
				mob.equip(equipment);
			}

			// Verify all slots are equipped
			const equipped = mob.getAllEquipped();
			assert.strictEqual(
				equipped.length,
				11,
				"Should have 11 pieces of equipment"
			);

			// Verify each slot has the correct equipment
			for (const equipment of allEquipment) {
				const equippedInSlot = mob.getEquipped(equipment.slot);
				assert.strictEqual(
					equippedInSlot,
					equipment,
					`Slot ${equipment.slot} should have ${equipment.display}`
				);
			}

			// Verify total defense (only from Armor: 5+4+10+3+2+6+3 = 33)
			assert.strictEqual(mob.getTotalDefense(), 33);

			// Verify total attack power (only from Weapons: 8+5 = 13)
			assert.strictEqual(mob.getTotalAttackPower(), 13);
		});
	});
});
