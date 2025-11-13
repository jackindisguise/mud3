import { suite, test } from "node:test";
import assert from "node:assert";
import { Equipment, EQUIPMENT_SLOT } from "./equipment.js";
import { Mob } from "./mob.js";
import type { PrimaryAttributeSet, ResourceCapacities } from "./mob.js";

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
			assert.strictEqual(helmet.keywords, "helmet");
			assert.strictEqual(helmet.display, "A Steel Helmet");
		});

		test("should create equipment with defense", () => {
			const armor = new Equipment({
				slot: EQUIPMENT_SLOT.CHEST,
				keywords: "armor",
				display: "Plate Armor",
				defense: 10,
			});

			assert.strictEqual(armor.slot, EQUIPMENT_SLOT.CHEST);
			assert.strictEqual(armor.defense, 10);
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

		test("should serialize and deserialize equipment", () => {
			const sword = new Equipment({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				keywords: "sword",
				display: "Steel Sword",
				defense: 5,
				attributeBonuses: { strength: 3 },
			});

			const serialized = sword.serialize();
			assert.strictEqual(serialized.type, "Equipment");
			assert.strictEqual(serialized.slot, EQUIPMENT_SLOT.MAIN_HAND);
			assert.strictEqual(serialized.defense, 5);
			assert.strictEqual(serialized.attributeBonuses?.strength, 3);

			const deserialized = Equipment.deserialize(serialized as any);
			assert.strictEqual(deserialized.slot, EQUIPMENT_SLOT.MAIN_HAND);
			assert.strictEqual(deserialized.defense, 5);
			assert.strictEqual(deserialized.attributeBonuses.strength, 3);
		});
	});

	suite("Mob Equipment", () => {
		test("should equip item to mob", () => {
			const mob = new Mob();
			const helmet = new Equipment({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				display: "Helmet",
				defense: 5,
			});

			const oldHelmet = mob.equip(helmet);
			assert.strictEqual(oldHelmet, undefined);
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.HEAD), helmet);
			assert.strictEqual(mob.getTotalDefense(), 5);
		});

		test("should replace equipped item when equipping to same slot", () => {
			const mob = new Mob();
			const oldHelmet = new Equipment({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "old helmet",
				display: "Old Helmet",
				defense: 3,
			});
			const newHelmet = new Equipment({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "new helmet",
				display: "New Helmet",
				defense: 8,
			});

			mob.equip(oldHelmet);
			mob.equip(newHelmet);

			// Old helmet should be replaced by new helmet
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.HEAD), newHelmet);
			assert.notStrictEqual(mob.getEquipped(EQUIPMENT_SLOT.HEAD), oldHelmet);
			assert.strictEqual(mob.getTotalDefense(), 8);
		});

		test("should unequip item from mob by slot", () => {
			const mob = new Mob();
			const armor = new Equipment({
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

		test("should handle multiple equipment pieces", () => {
			const mob = new Mob();
			const helmet = new Equipment({
				slot: EQUIPMENT_SLOT.HEAD,
				keywords: "helmet",
				defense: 5,
			});
			const armor = new Equipment({
				slot: EQUIPMENT_SLOT.CHEST,
				keywords: "armor",
				defense: 10,
			});
			const boots = new Equipment({
				slot: EQUIPMENT_SLOT.FEET,
				keywords: "boots",
				defense: 3,
			});

			mob.equip(helmet);
			mob.equip(armor);
			mob.equip(boots);

			assert.strictEqual(mob.getTotalDefense(), 18);
			assert.strictEqual(mob.getAllEquipped().length, 3);
		});

		test("should handle finger slot correctly", () => {
			const mob = new Mob();
			const ring1 = new Equipment({
				slot: EQUIPMENT_SLOT.FINGER,
				keywords: "ring1",
				defense: 1,
			});
			const ring2 = new Equipment({
				slot: EQUIPMENT_SLOT.FINGER,
				keywords: "ring2",
				defense: 2,
			});

			mob.equip(ring1);
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.FINGER), ring1);

			// Equipping second ring replaces first
			mob.equip(ring2);
			assert.strictEqual(mob.getEquipped(EQUIPMENT_SLOT.FINGER), ring2);
			assert.strictEqual(mob.getTotalDefense(), 2);
		});

		test("should serialize and deserialize mob with equipment", () => {
			const mob = new Mob();
			const helmet = new Equipment({
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
			if (Array.isArray(headEquipped)) {
				assert.strictEqual(headEquipped[0]?.type, "Equipment");
			} else {
				assert.strictEqual(headEquipped.type, "Equipment");
			}

			const deserialized = Mob.deserialize(serialized);
			const deserializedHelmet = deserialized.getEquipped(EQUIPMENT_SLOT.HEAD);

			assert(deserializedHelmet);
			assert.strictEqual(deserializedHelmet.defense, 5);
			assert.strictEqual(deserializedHelmet.attributeBonuses.strength, 2);
			assert.strictEqual(deserialized.getTotalDefense(), 5);
		});

		test("should equip items in every slot at once", () => {
			const mob = new Mob();

			// Create equipment for every slot
			const allEquipment = [
				new Equipment({
					slot: EQUIPMENT_SLOT.HEAD,
					keywords: "helmet",
					display: "Helmet",
					defense: 5,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.NECK,
					keywords: "amulet",
					display: "Amulet",
					defense: 2,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.SHOULDERS,
					keywords: "pauldrons",
					display: "Pauldrons",
					defense: 4,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.CHEST,
					keywords: "armor",
					display: "Armor",
					defense: 10,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.HANDS,
					keywords: "gloves",
					display: "Gloves",
					defense: 3,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.WAIST,
					keywords: "belt",
					display: "Belt",
					defense: 2,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.LEGS,
					keywords: "leggings",
					display: "Leggings",
					defense: 6,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.FEET,
					keywords: "boots",
					display: "Boots",
					defense: 3,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.MAIN_HAND,
					keywords: "sword",
					display: "Sword",
					defense: 8,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.OFF_HAND,
					keywords: "shield",
					display: "Shield",
					defense: 7,
				}),
				new Equipment({
					slot: EQUIPMENT_SLOT.FINGER,
					keywords: "ring",
					display: "Ring",
					defense: 1,
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

			console.log(
				...mob
					.getAllEquipped()
					.values()
					.map((e) => e.display)
			);
			// Verify total defense (5+2+4+10+3+2+6+3+8+7+1 = 51)
			assert.strictEqual(mob.getTotalDefense(), 51);
		});
	});
});
