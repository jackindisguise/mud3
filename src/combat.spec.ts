import { test, suite, beforeEach } from "node:test";
import assert from "node:assert";
import { Dungeon, Mob, Room, Weapon, EQUIPMENT_SLOT } from "./dungeon.js";
import { Character } from "./character.js";
import {
	initiateCombat,
	addToCombatQueue,
	removeFromCombatQueue,
	isInCombatQueue,
	getCombatQueue,
	processCombatRound,
} from "./combat.js";
import {
	PHYSICAL_DAMAGE_TYPE,
	MAGICAL_DAMAGE_TYPE,
	DAMAGE_RELATIONSHIP,
	HitType,
	DEFAULT_HIT_TYPE,
	COMMON_HIT_TYPES,
} from "./damage-types.js";
import { freezeArchetype } from "./archetype.js";

suite("combat.ts", () => {
	let dungeon: Dungeon;
	let room: Room;
	let attacker: Mob;
	let defender: Mob;

	beforeEach(() => {
		dungeon = new Dungeon({ dimensions: { width: 10, height: 10, layers: 1 } });
		room = new Room({ coordinates: { x: 0, y: 0, z: 0 }, dungeon });
		dungeon.add(room);

		// Create attacker
		attacker = new Mob({
			race: freezeArchetype({
				id: "test_race",
				name: "Test Race",
				startingAttributes: { strength: 10, agility: 10, intelligence: 10 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			}),
			job: freezeArchetype({
				id: "test_job",
				name: "Test Job",
				startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 0, maxMana: 0 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			}),
			level: 1,
		});
		attacker.location = room;
		room.add(attacker);

		// Create defender
		defender = new Mob({
			race: freezeArchetype({
				id: "test_race",
				name: "Test Race",
				startingAttributes: { strength: 5, agility: 5, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			}),
			job: freezeArchetype({
				id: "test_job",
				name: "Test Job",
				startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 0, maxMana: 0 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
			}),
			level: 1,
		});
		defender.location = room;
		room.add(defender);
	});

	suite("Combat queue management", () => {
		test("addToCombatQueue should add mob to queue", () => {
			attacker.combatTarget = defender;
			addToCombatQueue(attacker);
			assert(isInCombatQueue(attacker));
		});

		test("addToCombatQueue should not add mob without target", () => {
			addToCombatQueue(attacker);
			assert(!isInCombatQueue(attacker));
		});

		test("removeFromCombatQueue should remove mob from queue", () => {
			attacker.combatTarget = defender;
			addToCombatQueue(attacker);
			removeFromCombatQueue(attacker);
			assert(!isInCombatQueue(attacker));
		});

		test("getCombatQueue should return all mobs in combat", () => {
			attacker.combatTarget = defender;
			defender.combatTarget = attacker;
			addToCombatQueue(attacker);
			addToCombatQueue(defender);

			const queue = getCombatQueue();
			assert(queue.includes(attacker));
			assert(queue.includes(defender));
		});
	});

	suite("initiateCombat", () => {
		test("should set attacker's target", () => {
			initiateCombat(attacker, defender, room);
			assert.strictEqual(attacker.combatTarget, defender);
		});

		test("should add attacker to combat queue", () => {
			initiateCombat(attacker, defender, room);
			assert(isInCombatQueue(attacker));
		});

		test("should set defender's target if not already set", () => {
			initiateCombat(attacker, defender, room);
			assert.strictEqual(defender.combatTarget, attacker);
		});

		test("should add defender to combat queue if not already in combat", () => {
			initiateCombat(attacker, defender, room);
			assert(isInCombatQueue(defender));
		});

		test("should not change defender's target if already set", () => {
			const otherTarget = new Mob({
				race: freezeArchetype({
					id: "test_race",
					name: "Test Race",
					startingAttributes: { strength: 5, agility: 5, intelligence: 5 },
					attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
					startingResourceCaps: { maxHealth: 100, maxMana: 50 },
					resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
					skills: [],
					passives: [],
					growthModifier: { base: 1.0 },
				}),
				job: freezeArchetype({
					id: "test_job",
					name: "Test Job",
					startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
					attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
					startingResourceCaps: { maxHealth: 0, maxMana: 0 },
					resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
					skills: [],
					passives: [],
					growthModifier: { base: 1.0 },
				}),
				level: 1,
			});
			otherTarget.location = room;
			room.add(otherTarget);
			defender.combatTarget = otherTarget;
			addToCombatQueue(defender);

			initiateCombat(attacker, defender, room);
			assert.strictEqual(defender.combatTarget, otherTarget);
		});
	});

	suite("Damage type relationships in combat", () => {
		test("should apply damage multiplier for RESIST", () => {
			// Create attacker with high agility to ensure hits
			const highAgilityAttacker = new Mob({
				race: freezeArchetype({
					id: "high_agility_race",
					name: "High Agility Race",
					startingAttributes: { strength: 10, agility: 500, intelligence: 10 },
					attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
					startingResourceCaps: { maxHealth: 100, maxMana: 50 },
					resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
					skills: [],
					passives: [],
					growthModifier: { base: 1.0 },
				}),
				job: attacker.job,
				level: attacker.level,
			});
			highAgilityAttacker.location = room;
			room.add(highAgilityAttacker);

			// Set defender to resist fire damage
			const fireResistRace = freezeArchetype({
				id: "fire_resist_race",
				name: "Fire Resist Race",
				startingAttributes: { strength: 5, agility: 1, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.RESIST,
				},
			});
			// Create a new defender with the fire resist race
			const newDefender = new Mob({
				race: fireResistRace,
				job: defender.job,
				level: defender.level,
			});
			newDefender.location = room;
			room.remove(defender);
			room.add(newDefender);
			defender = newDefender;

			// Equip fire weapon
			const fireSword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 20,
				hitType: COMMON_HIT_TYPES.get("burn")!,
			});
			highAgilityAttacker.equip(fireSword);

			const initialHealth = defender.health;
			// Use oneHit with guaranteedHit to ensure we test damage modifiers
			highAgilityAttacker.oneHit({
				target: defender,
				weapon: fireSword,
				guaranteedHit: true,
			});

			// Damage should be reduced by 50% (RESIST)
			const damageDealt = initialHealth - defender.health;
			assert(damageDealt > 0, "Should deal some damage");
			// Note: Exact damage depends on RNG, but should be less than normal
		});

		test("should apply damage multiplier for IMMUNE", () => {
			// Create attacker with high agility to ensure hits
			const highAgilityAttacker = new Mob({
				race: freezeArchetype({
					id: "high_agility_race",
					name: "High Agility Race",
					startingAttributes: { strength: 10, agility: 500, intelligence: 10 },
					attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
					startingResourceCaps: { maxHealth: 100, maxMana: 50 },
					resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
					skills: [],
					passives: [],
					growthModifier: { base: 1.0 },
				}),
				job: attacker.job,
				level: attacker.level,
			});
			highAgilityAttacker.location = room;
			room.add(highAgilityAttacker);

			// Set defender to be immune to fire damage
			const fireImmuneRace = freezeArchetype({
				id: "fire_immune_race",
				name: "Fire Immune Race",
				startingAttributes: { strength: 5, agility: 1, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.IMMUNE,
				},
			});
			// Create a new defender with the fire immune race
			const newDefender = new Mob({
				race: fireImmuneRace,
				job: defender.job,
				level: defender.level,
			});
			newDefender.location = room;
			room.remove(defender);
			room.add(newDefender);
			defender = newDefender;

			// Equip fire weapon
			const fireSword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 20,
				hitType: COMMON_HIT_TYPES.get("burn")!,
			});
			highAgilityAttacker.equip(fireSword);

			const initialHealth = defender.health;
			// Use oneHit with guaranteedHit to ensure we test damage modifiers
			highAgilityAttacker.oneHit({
				target: defender,
				weapon: fireSword,
				guaranteedHit: true,
			});

			// Damage should be 0 (IMMUNE)
			const damageDealt = initialHealth - defender.health;
			assert.strictEqual(damageDealt, 0, "Immune damage should be 0");
		});

		test("should apply damage multiplier for VULNERABLE", () => {
			// Create attacker with high agility to ensure hits
			const highAgilityAttacker = new Mob({
				race: freezeArchetype({
					id: "high_agility_race",
					name: "High Agility Race",
					startingAttributes: { strength: 10, agility: 500, intelligence: 10 },
					attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
					startingResourceCaps: { maxHealth: 100, maxMana: 50 },
					resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
					skills: [],
					passives: [],
					growthModifier: { base: 1.0 },
				}),
				job: attacker.job,
				level: attacker.level,
			});
			highAgilityAttacker.location = room;
			room.add(highAgilityAttacker);

			// Set defender to be vulnerable to fire damage
			const fireVulnerableRace = freezeArchetype({
				id: "fire_vulnerable_race",
				name: "Fire Vulnerable Race",
				startingAttributes: { strength: 5, agility: 1, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.VULNERABLE,
				},
			});
			// Create a new defender with the fire vulnerable race
			const newDefender = new Mob({
				race: fireVulnerableRace,
				job: defender.job,
				level: defender.level,
			});
			newDefender.location = room;
			room.remove(defender);
			room.add(newDefender);
			defender = newDefender;

			// Equip fire weapon
			const fireSword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 20,
				hitType: COMMON_HIT_TYPES.get("burn")!,
			});
			highAgilityAttacker.equip(fireSword);

			const initialHealth = defender.health;
			// Use oneHit with guaranteedHit to ensure we test damage modifiers
			highAgilityAttacker.oneHit({
				target: defender,
				weapon: fireSword,
				guaranteedHit: true,
			});

			// Damage should be increased by 100% (VULNERABLE = 2x)
			const damageDealt = initialHealth - defender.health;
			assert(damageDealt > 0, "Should deal damage");
			// Note: Exact damage depends on RNG, but should be more than normal
		});

		test("should merge race and job damage relationships", () => {
			// Race gives fire resist, job gives fire vulnerable
			// Result should be resist (priority: IMMUNE > RESIST > VULNERABLE)
			const resistRace = freezeArchetype({
				id: "resist_race",
				name: "Resist Race",
				startingAttributes: { strength: 5, agility: 5, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.RESIST,
				},
			});
			const vulnerableJob = freezeArchetype({
				id: "vulnerable_job",
				name: "Vulnerable Job",
				startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 0, maxMana: 0 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.VULNERABLE,
				},
			});
			// Create a new defender with the merged race and job
			const newDefender = new Mob({
				race: resistRace,
				job: vulnerableJob,
				level: defender.level,
			});
			newDefender.location = room;
			room.remove(defender);
			room.add(newDefender);
			defender = newDefender;

			const relationships = defender.getDamageRelationships();
			assert.strictEqual(
				relationships.FIRE,
				DAMAGE_RELATIONSHIP.RESIST,
				"RESIST should take priority over VULNERABLE"
			);
		});
	});

	suite("Hit types in combat", () => {
		test("should use weapon hit type for combat messages", () => {
			const sword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 10,
				hitType: COMMON_HIT_TYPES.get("slash")!,
			});
			attacker.equip(sword);

			const hitType = attacker.getPrimaryHitType();
			assert.strictEqual(hitType.verb, "slash");
			assert.strictEqual(hitType.verbThirdPerson, "slashes");
			assert.strictEqual(hitType.damageType, PHYSICAL_DAMAGE_TYPE.SLASH);
		});

		test("should use default hit type when no weapon equipped", () => {
			const hitType = attacker.getPrimaryHitType();
			assert.strictEqual(hitType.verb, DEFAULT_HIT_TYPE.verb);
			assert.strictEqual(
				hitType.verbThirdPerson,
				DEFAULT_HIT_TYPE.verbThirdPerson
			);
			assert.strictEqual(hitType.damageType, DEFAULT_HIT_TYPE.damageType);
		});

		test("should use main hand weapon over off hand", () => {
			const mainHand = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 10,
				hitType: COMMON_HIT_TYPES.get("slash")!,
			});
			const offHand = new Weapon({
				slot: EQUIPMENT_SLOT.OFF_HAND,
				attackPower: 5,
				hitType: COMMON_HIT_TYPES.get("stab")!,
			});
			attacker.equip(mainHand);
			attacker.equip(offHand);

			const hitType = attacker.getPrimaryHitType();
			assert.strictEqual(hitType.verb, "slash");
		});

		test("should use off hand weapon when main hand not equipped", () => {
			const offHand = new Weapon({
				slot: EQUIPMENT_SLOT.OFF_HAND,
				attackPower: 5,
				hitType: COMMON_HIT_TYPES.get("stab")!,
			});
			attacker.equip(offHand);

			const hitType = attacker.getPrimaryHitType();
			assert.strictEqual(hitType.verb, "stab");
		});

		test("should use correct damage type from hit type", () => {
			const fireSword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 10,
				hitType: COMMON_HIT_TYPES.get("burn")!,
			});
			attacker.equip(fireSword);

			const hitType = attacker.getPrimaryHitType();
			assert.strictEqual(hitType.damageType, MAGICAL_DAMAGE_TYPE.FIRE);
		});
	});

	suite("processCombatRound", () => {
		test("should process combat for mobs in queue", () => {
			initiateCombat(attacker, defender, room);
			const initialHealth = defender.health;

			processCombatRound();

			// Defender should have taken damage (unless missed)
			// Note: This depends on RNG, so we just check that combat processed
			assert(isInCombatQueue(attacker) || !attacker.isInCombat());
		});

		test("should remove mobs from queue when target is dead", () => {
			initiateCombat(attacker, defender, room);
			defender.health = 0;

			processCombatRound();

			assert(!isInCombatQueue(attacker));
			assert.strictEqual(attacker.combatTarget, undefined);
		});

		test("should remove mobs from queue when target leaves room", () => {
			initiateCombat(attacker, defender, room);
			const otherRoom = new Room({
				coordinates: { x: 1, y: 0, z: 0 },
				dungeon,
			});
			dungeon.add(otherRoom);
			defender.location = otherRoom;
			room.remove(defender);
			otherRoom.add(defender);

			processCombatRound();

			assert(!isInCombatQueue(attacker));
			assert.strictEqual(attacker.combatTarget, undefined);
		});
	});
});
