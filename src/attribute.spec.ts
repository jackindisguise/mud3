import { test, suite } from "node:test";
import assert from "node:assert";
import {
	PrimaryAttributeSet,
	SecondaryAttributeSet,
	ResourceCapacities,
	SECONDARY_ATTRIBUTE_FACTORS,
	SECONDARY_ATTRIBUTE_BASE,
	HEALTH_PER_VITALITY,
	MANA_PER_WISDOM,
	ATTRIBUTE_ROUND_DECIMALS,
	clampNumber,
	roundTo,
	sumPrimaryAttributes,
	sumSecondaryAttributes,
	multiplyPrimaryAttributes,
	sumResourceCaps,
	multiplyResourceCaps,
	normalizePrimaryBonuses,
	normalizeResourceBonuses,
	prunePrimaryBonuses,
	pruneResourceBonuses,
	computeSecondaryAttributes,
	createPrimaryAttributesView,
	createSecondaryAttributesView,
	createResourceCapsView,
} from "./attribute.js";

suite("attribute.ts", () => {
	suite("Constants", () => {
		test("HEALTH_PER_VITALITY should be 2", () => {
			assert.strictEqual(HEALTH_PER_VITALITY, 2);
		});

		test("MANA_PER_WISDOM should be 2", () => {
			assert.strictEqual(MANA_PER_WISDOM, 2);
		});

		test("ATTRIBUTE_ROUND_DECIMALS should be 2", () => {
			assert.strictEqual(ATTRIBUTE_ROUND_DECIMALS, 2);
		});

		test("SECONDARY_ATTRIBUTE_BASE should have all attributes set to 0", () => {
			for (const value of Object.values(SECONDARY_ATTRIBUTE_BASE)) {
				assert.strictEqual(value, 0);
			}
		});

		test("SECONDARY_ATTRIBUTE_FACTORS should have correct structure", () => {
			const expectedKeys = [
				"attackPower",
				"vitality",
				"defense",
				"critRate",
				"avoidance",
				"accuracy",
				"endurance",
				"spellPower",
				"wisdom",
				"resilience",
			];
			for (const key of expectedKeys) {
				assert.ok(key in SECONDARY_ATTRIBUTE_FACTORS);
			}
		});
	});

	suite("clampNumber", () => {
		test("should clamp value within range", () => {
			assert.strictEqual(clampNumber(5, 0, 10), 5);
			assert.strictEqual(clampNumber(15, 0, 10), 10);
			assert.strictEqual(clampNumber(-5, 0, 10), 0);
		});

		test("should return min for non-finite values", () => {
			assert.strictEqual(clampNumber(Infinity, 0, 10), 0);
			assert.strictEqual(clampNumber(-Infinity, 0, 10), 0);
			assert.strictEqual(clampNumber(NaN, 0, 10), 0);
		});

		test("should handle edge cases", () => {
			assert.strictEqual(clampNumber(0, 0, 10), 0);
			assert.strictEqual(clampNumber(10, 0, 10), 10);
		});
	});

	suite("roundTo", () => {
		test("should round to specified decimal places", () => {
			assert.strictEqual(roundTo(1.234, 2), 1.23);
			assert.strictEqual(roundTo(1.235, 2), 1.24);
			assert.strictEqual(roundTo(1.999, 2), 2.0);
		});

		test("should handle zero decimals", () => {
			assert.strictEqual(roundTo(1.5, 0), 2);
			assert.strictEqual(roundTo(1.4, 0), 1);
		});

		test("should handle negative numbers", () => {
			assert.strictEqual(roundTo(-1.234, 2), -1.23);
		});
	});

	suite("sumPrimaryAttributes", () => {
		test("should sum multiple attribute sets", () => {
			const result = sumPrimaryAttributes(
				{ strength: 10, agility: 5, intelligence: 3 },
				{ strength: 5, agility: 2 },
				{ intelligence: 1 }
			);
			assert.strictEqual(result.strength, 15);
			assert.strictEqual(result.agility, 7);
			assert.strictEqual(result.intelligence, 4);
		});

		test("should handle undefined values", () => {
			const result = sumPrimaryAttributes({ strength: 10 }, undefined, {
				agility: 5,
			});
			assert.strictEqual(result.strength, 10);
			assert.strictEqual(result.agility, 5);
			assert.strictEqual(result.intelligence, 0);
		});

		test("should handle missing properties", () => {
			const result = sumPrimaryAttributes({ strength: 10 }, { agility: 5 });
			assert.strictEqual(result.strength, 10);
			assert.strictEqual(result.agility, 5);
			assert.strictEqual(result.intelligence, 0);
		});

		test("should return zeros for empty input", () => {
			const result = sumPrimaryAttributes();
			assert.strictEqual(result.strength, 0);
			assert.strictEqual(result.agility, 0);
			assert.strictEqual(result.intelligence, 0);
		});
	});

	suite("sumSecondaryAttributes", () => {
		test("should sum multiple secondary attribute sets", () => {
			const result = sumSecondaryAttributes(
				{ attackPower: 10, defense: 5, critRate: 2 },
				{ attackPower: 5, defense: 3 },
				{ critRate: 1 }
			);
			assert.strictEqual(result.attackPower, 15);
			assert.strictEqual(result.defense, 8);
			assert.strictEqual(result.critRate, 3);
		});

		test("should handle undefined values", () => {
			const result = sumSecondaryAttributes({ attackPower: 10 }, undefined, {
				defense: 5,
			});
			assert.strictEqual(result.attackPower, 10);
			assert.strictEqual(result.defense, 5);
			assert.strictEqual(result.vitality, 0);
		});

		test("should return zeros for empty input", () => {
			const result = sumSecondaryAttributes();
			assert.strictEqual(result.attackPower, 0);
			assert.strictEqual(result.vitality, 0);
			assert.strictEqual(result.defense, 0);
		});
	});

	suite("multiplyPrimaryAttributes", () => {
		test("should multiply all attributes by factor", () => {
			const source = { strength: 10, agility: 5, intelligence: 3 };
			const result = multiplyPrimaryAttributes(source, 2);
			assert.strictEqual(result.strength, 20);
			assert.strictEqual(result.agility, 10);
			assert.strictEqual(result.intelligence, 6);
		});

		test("should handle fractional factors", () => {
			const source = { strength: 10, agility: 5, intelligence: 3 };
			const result = multiplyPrimaryAttributes(source, 0.5);
			assert.strictEqual(result.strength, 5);
			assert.strictEqual(result.agility, 2.5);
			assert.strictEqual(result.intelligence, 1.5);
		});
	});

	suite("sumResourceCaps", () => {
		test("should sum multiple resource capacity sets", () => {
			const result = sumResourceCaps(
				{ maxHealth: 100, maxMana: 50 },
				{ maxHealth: 50, maxMana: 25 },
				{ maxHealth: 25 }
			);
			assert.strictEqual(result.maxHealth, 175);
			assert.strictEqual(result.maxMana, 75);
		});

		test("should handle undefined values", () => {
			const result = sumResourceCaps({ maxHealth: 100 }, undefined, {
				maxMana: 50,
			});
			assert.strictEqual(result.maxHealth, 100);
			assert.strictEqual(result.maxMana, 50);
		});

		test("should return zeros for empty input", () => {
			const result = sumResourceCaps();
			assert.strictEqual(result.maxHealth, 0);
			assert.strictEqual(result.maxMana, 0);
		});
	});

	suite("multiplyResourceCaps", () => {
		test("should multiply all resources by factor", () => {
			const source = { maxHealth: 100, maxMana: 50 };
			const result = multiplyResourceCaps(source, 2);
			assert.strictEqual(result.maxHealth, 200);
			assert.strictEqual(result.maxMana, 100);
		});

		test("should handle fractional factors", () => {
			const source = { maxHealth: 100, maxMana: 50 };
			const result = multiplyResourceCaps(source, 0.5);
			assert.strictEqual(result.maxHealth, 50);
			assert.strictEqual(result.maxMana, 25);
		});
	});

	suite("normalizePrimaryBonuses", () => {
		test("should normalize partial attributes to complete set", () => {
			const result = normalizePrimaryBonuses({ strength: 10 });
			assert.strictEqual(result.strength, 10);
			assert.strictEqual(result.agility, 0);
			assert.strictEqual(result.intelligence, 0);
		});

		test("should return zeros for undefined input", () => {
			const result = normalizePrimaryBonuses(undefined);
			assert.strictEqual(result.strength, 0);
			assert.strictEqual(result.agility, 0);
			assert.strictEqual(result.intelligence, 0);
		});
	});

	suite("normalizeResourceBonuses", () => {
		test("should normalize partial resources to complete set", () => {
			const result = normalizeResourceBonuses({ maxHealth: 100 });
			assert.strictEqual(result.maxHealth, 100);
			assert.strictEqual(result.maxMana, 0);
		});

		test("should return zeros for undefined input", () => {
			const result = normalizeResourceBonuses(undefined);
			assert.strictEqual(result.maxHealth, 0);
			assert.strictEqual(result.maxMana, 0);
		});
	});

	suite("prunePrimaryBonuses", () => {
		test("should remove zero values", () => {
			const result = prunePrimaryBonuses({
				strength: 10,
				agility: 0,
				intelligence: 5,
			});
			assert.strictEqual(result?.strength, 10);
			assert.strictEqual(result?.agility, undefined);
			assert.strictEqual(result?.intelligence, 5);
		});

		test("should return undefined if all values are zero", () => {
			const result = prunePrimaryBonuses({
				strength: 0,
				agility: 0,
				intelligence: 0,
			});
			assert.strictEqual(result, undefined);
		});

		test("should round values to ATTRIBUTE_ROUND_DECIMALS", () => {
			const result = prunePrimaryBonuses({
				strength: 10.123,
				agility: 5.456,
				intelligence: 0,
			});
			assert.strictEqual(result?.strength, 10.12);
			assert.strictEqual(result?.agility, 5.46);
		});
	});

	suite("pruneResourceBonuses", () => {
		test("should remove zero values", () => {
			const result = pruneResourceBonuses({
				maxHealth: 100,
				maxMana: 0,
			});
			assert.strictEqual(result?.maxHealth, 100);
			assert.strictEqual(result?.maxMana, undefined);
		});

		test("should return undefined if all values are zero", () => {
			const result = pruneResourceBonuses({
				maxHealth: 0,
				maxMana: 0,
			});
			assert.strictEqual(result, undefined);
		});

		test("should round values to ATTRIBUTE_ROUND_DECIMALS", () => {
			const result = pruneResourceBonuses({
				maxHealth: 100.123,
				maxMana: 50.456,
			});
			assert.strictEqual(result?.maxHealth, 100.12);
			assert.strictEqual(result?.maxMana, 50.46);
		});
	});

	suite("computeSecondaryAttributes", () => {
		test("should compute secondary attributes from primary", () => {
			const primary: PrimaryAttributeSet = {
				strength: 10,
				agility: 8,
				intelligence: 6,
			};
			const result = computeSecondaryAttributes(primary);

			// attackPower = 0 + 10 * 0.5 = 5
			assert.strictEqual(result.attackPower, 5);
			// vitality = 0 + 10 * 0.5 = 5
			assert.strictEqual(result.vitality, 5);
			// critRate = 0 + 8 * 0.2 = 1.6
			assert.strictEqual(result.critRate, 1.6);
			// endurance = 0 + 8 * 1 = 8
			assert.strictEqual(result.endurance, 8);
			// spellPower = 0 + 6 * 0.5 = 3
			assert.strictEqual(result.spellPower, 3);
		});

		test("should round values to ATTRIBUTE_ROUND_DECIMALS", () => {
			const primary: PrimaryAttributeSet = {
				strength: 7,
				agility: 7,
				intelligence: 7,
			};
			const result = computeSecondaryAttributes(primary);
			// All values should be rounded to 2 decimal places
			for (const value of Object.values(result)) {
				const decimals = value.toString().split(".")[1]?.length ?? 0;
				assert.ok(decimals <= 2);
			}
		});

		test("should handle zero primary attributes", () => {
			const primary: PrimaryAttributeSet = {
				strength: 0,
				agility: 0,
				intelligence: 0,
			};
			const result = computeSecondaryAttributes(primary);
			for (const value of Object.values(result)) {
				assert.strictEqual(value, 0);
			}
		});
	});

	suite("createPrimaryAttributesView", () => {
		test("should create readonly view with floored values", () => {
			const source: PrimaryAttributeSet = {
				strength: 10.7,
				agility: 5.3,
				intelligence: 3.9,
			};
			const result = createPrimaryAttributesView(source);
			assert.strictEqual(result.strength, 10);
			assert.strictEqual(result.agility, 5);
			assert.strictEqual(result.intelligence, 3);
		});

		test("should be readonly", () => {
			const source: PrimaryAttributeSet = {
				strength: 10,
				agility: 5,
				intelligence: 3,
			};
			const result = createPrimaryAttributesView(source);
			assert.throws(() => {
				(result as any).strength = 20;
			});
		});

		test("should handle non-finite values", () => {
			const source: PrimaryAttributeSet = {
				strength: Infinity,
				agility: -Infinity,
				intelligence: NaN,
			};
			const result = createPrimaryAttributesView(source);
			assert.strictEqual(result.strength, 0);
			assert.strictEqual(result.agility, 0);
			assert.strictEqual(result.intelligence, 0);
		});
	});

	suite("createSecondaryAttributesView", () => {
		test("should create readonly view with floored values", () => {
			const source: SecondaryAttributeSet = {
				attackPower: 10.7,
				vitality: 5.3,
				defense: 3.9,
				critRate: 2.5,
				avoidance: 1.2,
				accuracy: 0.8,
				endurance: 7.6,
				spellPower: 4.4,
				wisdom: 3.1,
				resilience: 2.9,
			};
			const result = createSecondaryAttributesView(source);
			assert.strictEqual(result.attackPower, 10);
			assert.strictEqual(result.vitality, 5);
			assert.strictEqual(result.defense, 3);
		});

		test("should be readonly", () => {
			const source: SecondaryAttributeSet = {
				attackPower: 10,
				vitality: 5,
				defense: 3,
				critRate: 2,
				avoidance: 1,
				accuracy: 0,
				endurance: 7,
				spellPower: 4,
				wisdom: 3,
				resilience: 2,
			};
			const result = createSecondaryAttributesView(source);
			assert.throws(() => {
				(result as any).attackPower = 20;
			});
		});
	});

	suite("createResourceCapsView", () => {
		test("should create readonly view with floored values", () => {
			const source: ResourceCapacities = {
				maxHealth: 100.7,
				maxMana: 50.3,
			};
			const result = createResourceCapsView(source);
			assert.strictEqual(result.maxHealth, 100);
			assert.strictEqual(result.maxMana, 50);
		});

		test("should be readonly", () => {
			const source: ResourceCapacities = {
				maxHealth: 100,
				maxMana: 50,
			};
			const result = createResourceCapsView(source);
			assert.throws(() => {
				(result as any).maxHealth = 200;
			});
		});
	});
});
