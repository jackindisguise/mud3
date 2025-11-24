import { suite, test } from "node:test";
import assert from "node:assert";
import {
	Ability,
	generateProficiencyTable,
	getProficiencyAtUses,
} from "./ability.js";
import { Mob } from "./dungeon.js";

suite("ability.ts", () => {
	suite("generateProficiencyTable", () => {
		test("should generate table with correct breakpoints", () => {
			const ability: Ability = {
				id: "test",
				name: "Test Ability",
				description: "A test ability",
				proficiencyCurve: [75, 250, 500, 1000],
			};

			const table = generateProficiencyTable(ability);

			// Check breakpoints
			assert.strictEqual(table[0], 0, "0 uses should be 0% proficiency");
			assert.strictEqual(table[75], 25, "75 uses should be 25% proficiency");
			assert.strictEqual(table[250], 50, "250 uses should be 50% proficiency");
			assert.strictEqual(table[500], 75, "500 uses should be 75% proficiency");
			assert.strictEqual(
				table[1000],
				100,
				"1000 uses should be 100% proficiency"
			);
		});

		test("should generate table with linear interpolation between breakpoints", () => {
			const ability: Ability = {
				id: "test",
				name: "Test Ability",
				description: "A test ability",
				proficiencyCurve: [100, 200, 300, 400],
			};

			const table = generateProficiencyTable(ability);

			// Test interpolation in first segment (0 to 25%)
			assert.strictEqual(
				table[50],
				13,
				"50 uses should be ~12.5% (rounded to 13%)"
			);
			assert.strictEqual(table[100], 25, "100 uses should be 25%");

			// Test interpolation in second segment (25% to 50%)
			assert.strictEqual(
				table[150],
				38,
				"150 uses should be ~37.5% (rounded to 38%)"
			);
			assert.strictEqual(table[200], 50, "200 uses should be 50%");

			// Test interpolation in third segment (50% to 75%)
			assert.strictEqual(
				table[250],
				63,
				"250 uses should be ~62.5% (rounded to 63%)"
			);
			assert.strictEqual(table[300], 75, "300 uses should be 75%");

			// Test interpolation in fourth segment (75% to 100%)
			assert.strictEqual(
				table[350],
				88,
				"350 uses should be ~87.5% (rounded to 88%)"
			);
			assert.strictEqual(table[400], 100, "400 uses should be 100%");
		});

		test("should generate table for all values from 0 to max uses", () => {
			const ability: Ability = {
				id: "test",
				name: "Test Ability",
				description: "A test ability",
				proficiencyCurve: [10, 20, 30, 40],
			};

			const table = generateProficiencyTable(ability);

			// Should have entries for 0 through 40
			for (let i = 0; i <= 40; i++) {
				assert.ok(
					table[i] !== undefined,
					`Table should have entry for ${i} uses`
				);
				assert.ok(
					table[i] >= 0 && table[i] <= 100,
					`Proficiency at ${i} uses should be between 0 and 100, got ${table[i]}`
				);
			}

			// Should not have entries beyond max
			assert.strictEqual(
				table[41],
				undefined,
				"Should not have entry beyond max uses"
			);
		});

		test("should clamp proficiency values to 0-100", () => {
			const ability: Ability = {
				id: "test",
				name: "Test Ability",
				description: "A test ability",
				proficiencyCurve: [1, 2, 3, 4],
			};

			const table = generateProficiencyTable(ability);

			// All values should be between 0 and 100
			for (const [uses, proficiency] of Object.entries(table)) {
				const prof = Number(proficiency);
				assert.ok(
					prof >= 0 && prof <= 100,
					`Proficiency at ${uses} uses should be between 0 and 100, got ${prof}`
				);
			}
		});
	});

	suite("getProficiencyAtUses", () => {
		test("should return correct proficiency at breakpoints", () => {
			const ability: Ability = {
				id: "test",
				name: "Test Ability",
				description: "A test ability",
				proficiencyCurve: [75, 250, 500, 1000],
			};
			ability.proficiencyTable = generateProficiencyTable(ability);

			assert.strictEqual(getProficiencyAtUses(ability, 0), 0);
			assert.strictEqual(getProficiencyAtUses(ability, 75), 25);
			assert.strictEqual(getProficiencyAtUses(ability, 250), 50);
			assert.strictEqual(getProficiencyAtUses(ability, 500), 75);
			assert.strictEqual(getProficiencyAtUses(ability, 1000), 100);
		});

		test("should return 100% when uses exceed max", () => {
			const ability: Ability = {
				id: "test",
				name: "Test Ability",
				description: "A test ability",
				proficiencyCurve: [75, 250, 500, 1000],
			};
			ability.proficiencyTable = generateProficiencyTable(ability);

			assert.strictEqual(getProficiencyAtUses(ability, 1001), 100);
			assert.strictEqual(getProficiencyAtUses(ability, 2000), 100);
			assert.strictEqual(getProficiencyAtUses(ability, 10000), 100);
		});

		test("should return 0% when proficiencyTable is not defined", () => {
			const ability: Ability = {
				id: "test",
				name: "Test Ability",
				description: "A test ability",
				proficiencyCurve: [75, 250, 500, 1000],
				// proficiencyTable is undefined
			};

			assert.strictEqual(getProficiencyAtUses(ability, 0), 0);
			assert.strictEqual(getProficiencyAtUses(ability, 100), 0);
			assert.strictEqual(getProficiencyAtUses(ability, 1000), 0);
		});

		test("should return correct proficiency for all values in generated table", () => {
			const ability: Ability = {
				id: "test",
				name: "Test Ability",
				description: "A test ability",
				proficiencyCurve: [10, 20, 30, 40],
			};
			ability.proficiencyTable = generateProficiencyTable(ability);

			// Test that all values from 0 to maxUses are in the table and return correct proficiency
			for (let uses = 0; uses <= 40; uses++) {
				const proficiency = getProficiencyAtUses(ability, uses);
				assert.ok(
					proficiency >= 0 && proficiency <= 100,
					`Proficiency at ${uses} uses should be between 0 and 100, got ${proficiency}`
				);
				// Verify it matches what's in the table
				assert.strictEqual(
					proficiency,
					ability.proficiencyTable![uses],
					`Proficiency at ${uses} uses should match table entry`
				);
			}
		});
	});

	suite("Mob ability proficiency integration", () => {
		test("should store uses correctly", () => {
			const mob = new Mob();

			mob.addAbility("test-ability", 0);
			assert.strictEqual(mob.getAbilityUses("test-ability"), 0);
			assert.ok(mob.knowsAbility("test-ability"));

			mob.addAbility("test-ability", 75);
			assert.strictEqual(mob.getAbilityUses("test-ability"), 75);

			mob.addAbility("test-ability", 250);
			assert.strictEqual(mob.getAbilityUses("test-ability"), 250);
		});

		test("should update proficiency snapshot when ability is added", () => {
			const mob = new Mob();

			mob.addAbility("test-ability", 0);
			// Proficiency snapshot should be updated (will be 0 if ability not in registry)
			const proficiency0 = mob.learnedAbilities.get("test-ability");
			assert.ok(
				proficiency0 !== undefined,
				"Proficiency snapshot should exist"
			);
			assert.strictEqual(
				proficiency0,
				0,
				"Proficiency should be 0 when ability not found in registry"
			);
		});

		test("should increment uses and update proficiency snapshot", () => {
			const mob = new Mob();

			mob.addAbility("test-ability", 0);
			assert.strictEqual(mob.getAbilityUses("test-ability"), 0);
			assert.strictEqual(mob.learnedAbilities.get("test-ability"), 0);

			mob.useAbilityById("test-ability", 1);
			assert.strictEqual(mob.getAbilityUses("test-ability"), 1);
			// Proficiency snapshot should be updated
			const proficiency1 = mob.learnedAbilities.get("test-ability");
			assert.ok(proficiency1 !== undefined, "Proficiency should be defined");

			mob.useAbilityById("test-ability", 9);
			assert.strictEqual(mob.getAbilityUses("test-ability"), 10);
			// Proficiency snapshot should be updated
			const proficiency10 = mob.learnedAbilities.get("test-ability");
			assert.ok(proficiency10 !== undefined, "Proficiency should be defined");
		});

		test("should increment uses by custom amount", () => {
			const mob = new Mob();

			mob.addAbility("test-ability", 5);
			mob.useAbilityById("test-ability", 10);
			assert.strictEqual(mob.getAbilityUses("test-ability"), 15);
		});

		test("should add ability with uses when incrementing unlearned ability", () => {
			const mob = new Mob();

			mob.useAbilityById("test-ability", 5);
			assert.strictEqual(mob.getAbilityUses("test-ability"), 5);
			assert.ok(mob.knowsAbility("test-ability"), "Ability should be learned");
		});

		test("should remove ability from both maps", () => {
			const mob = new Mob();

			mob.addAbility("test-ability", 100);
			assert.ok(mob.knowsAbility("test-ability"));

			const removed = mob.removeAbility("test-ability");
			assert.strictEqual(removed, true);
			assert.ok(!mob.knowsAbility("test-ability"));
			assert.strictEqual(mob.getAbilityUses("test-ability"), 0);
			assert.strictEqual(mob.learnedAbilities.get("test-ability"), undefined);
		});

		test("should track uses separately from proficiency", () => {
			const mob = new Mob();

			mob.addAbility("ability1", 50);
			mob.addAbility("ability2", 100);

			assert.strictEqual(mob.getAbilityUses("ability1"), 50);
			assert.strictEqual(mob.getAbilityUses("ability2"), 100);

			// Uses should be independent
			mob.useAbilityById("ability1", 25);
			assert.strictEqual(mob.getAbilityUses("ability1"), 75);
			assert.strictEqual(mob.getAbilityUses("ability2"), 100);
		});

		test("should return false when removing non-existent ability", () => {
			const mob = new Mob();

			const removed = mob.removeAbility("non-existent");
			assert.strictEqual(removed, false);
		});
	});
});
