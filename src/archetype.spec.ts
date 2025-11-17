import { test, suite } from "node:test";
import assert from "node:assert";
import {
	freezeArchetype,
	evaluateGrowthModifier,
	BaseArchetypeDefinition,
	GrowthModifierCurve,
} from "./archetype.js";
import { PrimaryAttributeSet, ResourceCapacities } from "./attribute.js";
import {
	DamageTypeRelationships,
	DAMAGE_RELATIONSHIP,
} from "./damage-types.js";

suite("archetype.ts", () => {
	suite("freezeArchetype", () => {
		test("should freeze all properties", () => {
			const def: BaseArchetypeDefinition = {
				id: "test-race",
				name: "Test Race",
				description: "A test race",
				isStarter: true,
				startingAttributes: { strength: 10, agility: 8, intelligence: 6 },
				attributeGrowthPerLevel: { strength: 2, agility: 1, intelligence: 1 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 10, maxMana: 5 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			};

			const frozen = freezeArchetype(def);

			// Should be frozen
			assert.throws(() => {
				(frozen as any).id = "changed";
			});

			// Properties should be preserved
			assert.strictEqual(frozen.id, "test-race");
			assert.strictEqual(frozen.name, "Test Race");
			assert.strictEqual(frozen.description, "A test race");
			assert.strictEqual(frozen.isStarter, true);
		});

		test("should freeze nested objects", () => {
			const def: BaseArchetypeDefinition = {
				id: "test",
				name: "Test",
				startingAttributes: { strength: 10, agility: 8, intelligence: 6 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			};

			const frozen = freezeArchetype(def);

			// Nested objects should be frozen
			assert.throws(() => {
				(frozen.startingAttributes as any).strength = 20;
			});
		});

		test("should handle isStarter defaulting to false", () => {
			const def: BaseArchetypeDefinition = {
				id: "test",
				name: "Test",
				startingAttributes: { strength: 10, agility: 8, intelligence: 6 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			};

			const frozen = freezeArchetype(def);
			assert.strictEqual(frozen.isStarter, false);
		});

		test("should freeze skills array", () => {
			const def: BaseArchetypeDefinition = {
				id: "test",
				name: "Test",
				startingAttributes: { strength: 10, agility: 8, intelligence: 6 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [
					{ id: "skill1", level: 1 },
					{ id: "skill2", level: 5 },
				],
				passives: [],
				growthModifier: { base: 1.0 },
			};

			const frozen = freezeArchetype(def);

			assert.strictEqual(frozen.skills.length, 2);
			assert.strictEqual(frozen.skills[0].id, "skill1");
			assert.strictEqual(frozen.skills[0].level, 1);

			// Should be frozen
			assert.throws(() => {
				(frozen.skills as any).push({ id: "skill3", level: 10 });
			});
		});

		test("should freeze passives array", () => {
			const def: BaseArchetypeDefinition = {
				id: "test",
				name: "Test",
				startingAttributes: { strength: 10, agility: 8, intelligence: 6 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: ["passive1", "passive2"],
				growthModifier: { base: 1.0 },
			};

			const frozen = freezeArchetype(def);

			assert.strictEqual(frozen.passives.length, 2);
			assert.strictEqual(frozen.passives[0], "passive1");

			// Should be frozen
			assert.throws(() => {
				(frozen.passives as any).push("passive3");
			});
		});

		test("should trim passive strings", () => {
			const def: BaseArchetypeDefinition = {
				id: "test",
				name: "Test",
				startingAttributes: { strength: 10, agility: 8, intelligence: 6 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: ["  passive1  ", "passive2"],
				growthModifier: { base: 1.0 },
			};

			const frozen = freezeArchetype(def);

			assert.strictEqual(frozen.passives[0], "passive1");
		});

		test("should handle damage relationships", () => {
			const damageRelationships: DamageTypeRelationships = {
				FIRE: DAMAGE_RELATIONSHIP.RESIST,
				ICE: DAMAGE_RELATIONSHIP.VULNERABLE,
			};

			const def: BaseArchetypeDefinition = {
				id: "test",
				name: "Test",
				startingAttributes: { strength: 10, agility: 8, intelligence: 6 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships,
			};

			const frozen = freezeArchetype(def);

			assert.strictEqual(
				frozen.damageRelationships?.FIRE,
				DAMAGE_RELATIONSHIP.RESIST
			);
			assert.strictEqual(
				frozen.damageRelationships?.ICE,
				DAMAGE_RELATIONSHIP.VULNERABLE
			);

			// Should be frozen
			assert.throws(() => {
				(frozen.damageRelationships as any).FIRE = DAMAGE_RELATIONSHIP.IMMUNE;
			});
		});

		test("should handle undefined damage relationships", () => {
			const def: BaseArchetypeDefinition = {
				id: "test",
				name: "Test",
				startingAttributes: { strength: 10, agility: 8, intelligence: 6 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			};

			const frozen = freezeArchetype(def);

			assert.strictEqual(frozen.damageRelationships, undefined);
		});
	});

	suite("evaluateGrowthModifier", () => {
		test("should return base value for level 1", () => {
			const curve: GrowthModifierCurve = { base: 1.0 };
			const result = evaluateGrowthModifier(curve, 1);
			assert.strictEqual(result, 1.0);
		});

		test("should calculate with perLevel modifier", () => {
			const curve: GrowthModifierCurve = {
				base: 1.0,
				perLevel: 0.1,
			};
			const result = evaluateGrowthModifier(curve, 5);
			// base + perLevel * (level - 1) = 1.0 + 0.1 * 4 = 1.4
			assert.strictEqual(result, 1.4);
		});

		test("should handle level 2 with perLevel", () => {
			const curve: GrowthModifierCurve = {
				base: 1.0,
				perLevel: 0.1,
			};
			const result = evaluateGrowthModifier(curve, 2);
			// base + perLevel * (level - 1) = 1.0 + 0.1 * 1 = 1.1
			assert.strictEqual(result, 1.1);
		});

		test("should floor level values", () => {
			const curve: GrowthModifierCurve = {
				base: 1.0,
				perLevel: 0.1,
			};
			const result = evaluateGrowthModifier(curve, 5.7);
			// Should use level 5, not 5.7
			assert.strictEqual(result, 1.4);
		});

		test("should clamp level to minimum 1", () => {
			const curve: GrowthModifierCurve = {
				base: 1.0,
				perLevel: 0.1,
			};
			const result = evaluateGrowthModifier(curve, 0);
			// Should use level 1
			assert.strictEqual(result, 1.0);
		});

		test("should clamp level to minimum 1 for negative values", () => {
			const curve: GrowthModifierCurve = {
				base: 1.0,
				perLevel: 0.1,
			};
			const result = evaluateGrowthModifier(curve, -5);
			// Should use level 1
			assert.strictEqual(result, 1.0);
		});

		test("should return minimum 1 even if calculation is less", () => {
			const curve: GrowthModifierCurve = {
				base: 0.5,
				perLevel: -0.1,
			};
			const result = evaluateGrowthModifier(curve, 10);
			// Calculation: 0.5 + (-0.1) * 9 = 0.5 - 0.9 = -0.4
			// Should return 1 (minimum)
			assert.strictEqual(result, 1);
		});

		test("should handle undefined perLevel", () => {
			const curve: GrowthModifierCurve = {
				base: 1.0,
			};
			const result = evaluateGrowthModifier(curve, 5);
			// Should use perLevel = 0
			assert.strictEqual(result, 1.0);
		});

		test("should handle high levels", () => {
			const curve: GrowthModifierCurve = {
				base: 1.0,
				perLevel: 0.05,
			};
			const result = evaluateGrowthModifier(curve, 100);
			// base + perLevel * (level - 1) = 1.0 + 0.05 * 99 = 5.95
			assert.strictEqual(result, 5.95);
		});
	});
});
