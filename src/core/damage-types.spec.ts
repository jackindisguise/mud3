import { test, suite } from "node:test";
import assert from "node:assert";
import {
	PHYSICAL_DAMAGE_TYPE,
	MAGICAL_DAMAGE_TYPE,
	DAMAGE_TYPE,
	DAMAGE_RELATIONSHIP,
	HitType,
	DEFAULT_HIT_TYPE,
	COMMON_HIT_TYPES,
	mergeDamageRelationships,
	getDamageMultiplier,
} from "./damage-types.js";

suite("damage-types.ts", () => {
	suite("DAMAGE_TYPE enums", () => {
		test("PHYSICAL_DAMAGE_TYPE should have all physical types", () => {
			assert.strictEqual(PHYSICAL_DAMAGE_TYPE.SLASH, "SLASH");
			assert.strictEqual(PHYSICAL_DAMAGE_TYPE.STAB, "STAB");
			assert.strictEqual(PHYSICAL_DAMAGE_TYPE.CRUSH, "CRUSH");
			assert.strictEqual(PHYSICAL_DAMAGE_TYPE.EXOTIC, "EXOTIC");
		});

		test("MAGICAL_DAMAGE_TYPE should have all magical types", () => {
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.FIRE, "FIRE");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.ICE, "ICE");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.ELECTRIC, "ELECTRIC");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.WATER, "WATER");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.RADIANT, "RADIANT");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.NECROTIC, "NECROTIC");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.PSYCHIC, "PSYCHIC");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.FORCE, "FORCE");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.THUNDER, "THUNDER");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.POISON, "POISON");
			assert.strictEqual(MAGICAL_DAMAGE_TYPE.ACID, "ACID");
		});
	});

	suite("DAMAGE_RELATIONSHIP enum", () => {
		test("should have all relationship types", () => {
			assert.strictEqual(DAMAGE_RELATIONSHIP.RESIST, "RESIST");
			assert.strictEqual(DAMAGE_RELATIONSHIP.IMMUNE, "IMMUNE");
			assert.strictEqual(DAMAGE_RELATIONSHIP.VULNERABLE, "VULNERABLE");
		});
	});

	suite("DEFAULT_HIT_TYPE", () => {
		test("should have correct default values", () => {
			assert.strictEqual(DEFAULT_HIT_TYPE.verb, "punch");
			assert.strictEqual(DEFAULT_HIT_TYPE.verbThirdPerson, "punches");
			assert.strictEqual(
				DEFAULT_HIT_TYPE.damageType,
				PHYSICAL_DAMAGE_TYPE.CRUSH
			);
		});
	});

	suite("COMMON_HIT_TYPES", () => {
		test("should contain common physical hit types", () => {
			const slash = COMMON_HIT_TYPES.get("slash");
			assert(slash !== undefined);
			assert.strictEqual(slash.verb, "slash");
			assert.strictEqual(slash.verbThirdPerson, "slashes");
			assert.strictEqual(slash.damageType, PHYSICAL_DAMAGE_TYPE.SLASH);

			const stab = COMMON_HIT_TYPES.get("stab");
			assert(stab !== undefined);
			assert.strictEqual(stab.verb, "stab");
			assert.strictEqual(stab.verbThirdPerson, "stabs");
			assert.strictEqual(stab.damageType, PHYSICAL_DAMAGE_TYPE.STAB);
		});

		test("should contain magical hit types", () => {
			const burn = COMMON_HIT_TYPES.get("burn");
			assert(burn !== undefined);
			assert.strictEqual(burn.verb, "burn");
			assert.strictEqual(burn.verbThirdPerson, "burns");
			assert.strictEqual(burn.damageType, MAGICAL_DAMAGE_TYPE.FIRE);

			const freeze = COMMON_HIT_TYPES.get("freeze");
			assert(freeze !== undefined);
			assert.strictEqual(freeze.verb, "freeze");
			assert.strictEqual(freeze.verbThirdPerson, "freezes");
			assert.strictEqual(freeze.damageType, MAGICAL_DAMAGE_TYPE.ICE);
		});

		test("should contain obscure D&D damage types", () => {
			const smite = COMMON_HIT_TYPES.get("smite");
			assert(smite !== undefined);
			assert.strictEqual(smite.damageType, MAGICAL_DAMAGE_TYPE.RADIANT);

			const wither = COMMON_HIT_TYPES.get("wither");
			assert(wither !== undefined);
			assert.strictEqual(wither.damageType, MAGICAL_DAMAGE_TYPE.NECROTIC);

			const assault = COMMON_HIT_TYPES.get("assault");
			assert(assault !== undefined);
			assert.strictEqual(assault.damageType, MAGICAL_DAMAGE_TYPE.PSYCHIC);

			const pummel = COMMON_HIT_TYPES.get("pummel");
			assert(pummel !== undefined);
			assert.strictEqual(pummel.damageType, MAGICAL_DAMAGE_TYPE.FORCE);

			const resonate = COMMON_HIT_TYPES.get("resonate");
			assert(resonate !== undefined);
			assert.strictEqual(resonate.damageType, MAGICAL_DAMAGE_TYPE.THUNDER);

			const venom = COMMON_HIT_TYPES.get("venom");
			assert(venom !== undefined);
			assert.strictEqual(venom.damageType, MAGICAL_DAMAGE_TYPE.POISON);

			const corrode = COMMON_HIT_TYPES.get("corrode");
			assert(corrode !== undefined);
			assert.strictEqual(corrode.damageType, MAGICAL_DAMAGE_TYPE.ACID);
		});

		test("all hit types should have verbThirdPerson", () => {
			for (const [key, hitType] of COMMON_HIT_TYPES) {
				assert(
					hitType.verbThirdPerson !== undefined,
					`Hit type "${key}" should have verbThirdPerson`
				);
				assert.strictEqual(
					typeof hitType.verbThirdPerson,
					"string",
					`Hit type "${key}" verbThirdPerson should be a string`
				);
			}
		});
	});

	suite("getThirdPersonVerb", () => {
		test("should return explicit verbThirdPerson when provided", () => {
			const hitType: HitType = {
				verb: "punch",
				verbThirdPerson: "punches",
				damageType: PHYSICAL_DAMAGE_TYPE.CRUSH,
			};
			assert.strictEqual(hitType.verbThirdPerson, "punches");
		});

		test("should auto-conjugate regular verbs", () => {
			const hitType: HitType = {
				verb: "slash",
				verbThirdPerson: "slashes",
				damageType: PHYSICAL_DAMAGE_TYPE.SLASH,
			};
			assert.strictEqual(hitType.verbThirdPerson, "slashes");
			assert.strictEqual(hitType.damageType, PHYSICAL_DAMAGE_TYPE.SLASH);
		});

		test("should handle verbs ending in s, x, z, ch, sh (add 'es')", () => {
			const hitType1: HitType = {
				verb: "punch",
				verbThirdPerson: "punches",
				damageType: PHYSICAL_DAMAGE_TYPE.CRUSH,
			};
			assert.strictEqual(hitType1.verbThirdPerson, "punches");

			const hitType2: HitType = {
				verb: "slash",
				verbThirdPerson: "slashes",
				damageType: PHYSICAL_DAMAGE_TYPE.SLASH,
			};
			assert.strictEqual(hitType2.verbThirdPerson, "slashes");
		});

		test("should handle verbs ending in consonant + y (change to 'ies')", () => {
			const hitType: HitType = {
				verb: "purify",
				verbThirdPerson: "purifies",
				damageType: MAGICAL_DAMAGE_TYPE.RADIANT,
			};
			assert.strictEqual(hitType.verbThirdPerson, "purifies");
		});
	});

	suite("mergeDamageRelationships", () => {
		test("should merge empty relationships", () => {
			const result = mergeDamageRelationships(undefined, undefined);
			assert.deepStrictEqual(result, {});
		});

		test("should return race relationships when job is empty", () => {
			const race = {
				FIRE: DAMAGE_RELATIONSHIP.RESIST,
			};
			const result = mergeDamageRelationships(race, undefined);
			assert.deepStrictEqual(result, race);
		});

		test("should return job relationships when race is empty", () => {
			const job = {
				ICE: DAMAGE_RELATIONSHIP.VULNERABLE,
			};
			const result = mergeDamageRelationships(undefined, job);
			assert.deepStrictEqual(result, job);
		});

		test("should merge non-conflicting relationships", () => {
			const race = {
				FIRE: DAMAGE_RELATIONSHIP.RESIST,
			};
			const job = {
				ICE: DAMAGE_RELATIONSHIP.VULNERABLE,
			};
			const result = mergeDamageRelationships(race, job);
			assert.deepStrictEqual(result, {
				FIRE: DAMAGE_RELATIONSHIP.RESIST,
				ICE: DAMAGE_RELATIONSHIP.VULNERABLE,
			});
		});

		test("should prioritize IMMUNE over RESIST", () => {
			const race = {
				FIRE: DAMAGE_RELATIONSHIP.IMMUNE,
			};
			const job = {
				FIRE: DAMAGE_RELATIONSHIP.RESIST,
			};
			const result = mergeDamageRelationships(race, job);
			assert.strictEqual(result.FIRE, DAMAGE_RELATIONSHIP.IMMUNE);
		});

		test("should prioritize IMMUNE over VULNERABLE", () => {
			const race = {
				FIRE: DAMAGE_RELATIONSHIP.IMMUNE,
			};
			const job = {
				FIRE: DAMAGE_RELATIONSHIP.VULNERABLE,
			};
			const result = mergeDamageRelationships(race, job);
			assert.strictEqual(result.FIRE, DAMAGE_RELATIONSHIP.IMMUNE);
		});

		test("should prioritize RESIST over VULNERABLE", () => {
			const race = {
				FIRE: DAMAGE_RELATIONSHIP.RESIST,
			};
			const job = {
				FIRE: DAMAGE_RELATIONSHIP.VULNERABLE,
			};
			const result = mergeDamageRelationships(race, job);
			assert.strictEqual(result.FIRE, DAMAGE_RELATIONSHIP.RESIST);
		});

		test("should prioritize IMMUNE from job over RESIST from race", () => {
			const race = {
				FIRE: DAMAGE_RELATIONSHIP.RESIST,
			};
			const job = {
				FIRE: DAMAGE_RELATIONSHIP.IMMUNE,
			};
			const result = mergeDamageRelationships(race, job);
			assert.strictEqual(result.FIRE, DAMAGE_RELATIONSHIP.IMMUNE);
		});

		test("should handle complex merging scenarios", () => {
			const race = {
				FIRE: DAMAGE_RELATIONSHIP.IMMUNE,
				ICE: DAMAGE_RELATIONSHIP.RESIST,
				ELECTRIC: DAMAGE_RELATIONSHIP.VULNERABLE,
			};
			const job = {
				FIRE: DAMAGE_RELATIONSHIP.VULNERABLE,
				ICE: DAMAGE_RELATIONSHIP.VULNERABLE,
				WATER: DAMAGE_RELATIONSHIP.RESIST,
			};
			const result = mergeDamageRelationships(race, job);
			assert.strictEqual(result.FIRE, DAMAGE_RELATIONSHIP.IMMUNE);
			assert.strictEqual(result.ICE, DAMAGE_RELATIONSHIP.RESIST);
			assert.strictEqual(result.ELECTRIC, DAMAGE_RELATIONSHIP.VULNERABLE);
			assert.strictEqual(result.WATER, DAMAGE_RELATIONSHIP.RESIST);
		});
	});

	suite("getDamageMultiplier", () => {
		test("should return 1.0 for normal damage (no relationships)", () => {
			const multiplier = getDamageMultiplier(
				MAGICAL_DAMAGE_TYPE.FIRE,
				undefined
			);
			assert.strictEqual(multiplier, 1.0);
		});

		test("should return 1.0 for damage type not in relationships", () => {
			const relationships = {
				ICE: DAMAGE_RELATIONSHIP.RESIST,
			};
			const multiplier = getDamageMultiplier(
				MAGICAL_DAMAGE_TYPE.FIRE,
				relationships
			);
			assert.strictEqual(multiplier, 1.0);
		});

		test("should return 0.0 for IMMUNE", () => {
			const relationships = {
				FIRE: DAMAGE_RELATIONSHIP.IMMUNE,
			};
			const multiplier = getDamageMultiplier(
				MAGICAL_DAMAGE_TYPE.FIRE,
				relationships
			);
			assert.strictEqual(multiplier, 0.0);
		});

		test("should return 0.5 for RESIST", () => {
			const relationships = {
				FIRE: DAMAGE_RELATIONSHIP.RESIST,
			};
			const multiplier = getDamageMultiplier(
				MAGICAL_DAMAGE_TYPE.FIRE,
				relationships
			);
			assert.strictEqual(multiplier, 0.5);
		});

		test("should return 2.0 for VULNERABLE", () => {
			const relationships = {
				FIRE: DAMAGE_RELATIONSHIP.VULNERABLE,
			};
			const multiplier = getDamageMultiplier(
				MAGICAL_DAMAGE_TYPE.FIRE,
				relationships
			);
			assert.strictEqual(multiplier, 2.0);
		});

		test("should work with physical damage types", () => {
			const relationships = {
				SLASH: DAMAGE_RELATIONSHIP.RESIST,
			};
			const multiplier = getDamageMultiplier(
				PHYSICAL_DAMAGE_TYPE.SLASH,
				relationships
			);
			assert.strictEqual(multiplier, 0.5);
		});

		test("should work with all damage types", () => {
			const relationships = {
				RADIANT: DAMAGE_RELATIONSHIP.IMMUNE,
				NECROTIC: DAMAGE_RELATIONSHIP.RESIST,
				PSYCHIC: DAMAGE_RELATIONSHIP.VULNERABLE,
				FORCE: DAMAGE_RELATIONSHIP.RESIST,
				THUNDER: DAMAGE_RELATIONSHIP.VULNERABLE,
				POISON: DAMAGE_RELATIONSHIP.IMMUNE,
				ACID: DAMAGE_RELATIONSHIP.RESIST,
			};

			assert.strictEqual(
				getDamageMultiplier(MAGICAL_DAMAGE_TYPE.RADIANT, relationships),
				0.0
			);
			assert.strictEqual(
				getDamageMultiplier(MAGICAL_DAMAGE_TYPE.NECROTIC, relationships),
				0.5
			);
			assert.strictEqual(
				getDamageMultiplier(MAGICAL_DAMAGE_TYPE.PSYCHIC, relationships),
				2.0
			);
			assert.strictEqual(
				getDamageMultiplier(MAGICAL_DAMAGE_TYPE.FORCE, relationships),
				0.5
			);
			assert.strictEqual(
				getDamageMultiplier(MAGICAL_DAMAGE_TYPE.THUNDER, relationships),
				2.0
			);
			assert.strictEqual(
				getDamageMultiplier(MAGICAL_DAMAGE_TYPE.POISON, relationships),
				0.0
			);
			assert.strictEqual(
				getDamageMultiplier(MAGICAL_DAMAGE_TYPE.ACID, relationships),
				0.5
			);
		});
	});
});
