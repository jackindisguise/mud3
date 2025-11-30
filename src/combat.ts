/**
 * Combat system for managing mob-to-mob combat, threat generation, and combat rounds.
 *
 * Features:
 * - Combat queue that tracks all mobs currently in combat
 * - Combat rounds that run every 3 seconds
 * - Threat-based targeting for NPCs with 10% grace window
 * - Automatic target switching based on threat
 * - Damage dealing and combat messages
 *
 * @module combat
 */

import { Mob, Room, Weapon, EQUIPMENT_SLOT } from "./core/dungeon.js";
import { MESSAGE_GROUP } from "./core/character.js";
import {
	color,
	COLOR,
	gradientStringTransformer,
	repeatingColorStringTransformer,
	SIZER,
	stickyColor,
} from "./core/color.js";
import { LINEBREAK } from "./core/telnet.js";
import logger from "./logger.js";
import { getLocation, LOCATION } from "./registry/locations.js";
import { act, damageMessage } from "./act.js";
import { showRoom } from "./commands/look.js";
import {
	DEFAULT_HIT_TYPE,
	getDamageMultiplier,
	getThirdPersonVerb,
} from "./core/damage-types.js";
import { ability as PURE_POWER } from "./abilities/pure-power.js";
import { string } from "mud-ext";

/**
 * Options for the oneHit function.
 */
export interface OneHitOptions {
	/** The mob performing the attack */
	attacker: Mob;
	/** The mob being hit */
	target: Mob;
	/** Optional weapon to use for the attack. If not provided, uses unarmed/default hit type */
	weapon?: Weapon;
	/** If true, the attack will never miss (guaranteed hit) */
	guaranteedHit?: boolean;
	/** Optional ability name to use in damage messages instead of the hit verb */
	abilityName?: string;
	/** Optional flat bonus to add to attack power before damage calculation */
	attackPowerBonus?: number;
	/** Optional multiplier to apply to attack power before damage calculation */
	attackPowerMultiplier?: number;
}

/**
 * Combat queue containing all mobs currently engaged in combat.
 * Mobs are automatically added when they engage a target and removed when combat ends.
 */
const combatQueue = new Set<Mob>();

/**
 * Grace window multiplier for threat-based target switching.
 * A new attacker must have 10% more threat than the current target to cause a switch.
 */
const THREAT_GRACE_WINDOW = 1.1;

/**
 * Performs a hit attempt against a target, checking accuracy and dealing damage if successful.
 * This is the main function for combat hits. It checks accuracy vs avoidance, and if the hit
 * succeeds, calculates damage based on attack power, defense, critical hits, and damage type
 * relationships. It also handles threat generation and death if the target's health reaches 0.
 *
 * @param attacker The mob performing the attack
 * @param options Options for the hit, including target, weapon, and guaranteedHit flag
 * @returns The damage amount that was dealt (0 if missed, otherwise >= 0)
 *
 * @example
 * ```typescript
 * const attacker = new Mob();
 * const defender = new Mob();
 * const sword = new Weapon({ slot: EQUIPMENT_SLOT.MAIN_HAND, attackPower: 15 });
 *
 * // oneHit handles accuracy checks internally
 * const damage = oneHit({ attacker: attacker, target: defender, weapon: sword });
 * // Damage has already been dealt and messages sent (or miss message if missed)
 *
 * // Guaranteed hit (never misses)
 * const guaranteedDamage = oneHit({ attacker: attacker, target: defender, weapon: sword, guaranteedHit: true });
 * ```
 */
export function oneHit(options: OneHitOptions): number {
	const {
		attacker,
		target,
		weapon,
		guaranteedHit = false,
		abilityName,
		attackPowerBonus = 0,
		attackPowerMultiplier = 1,
	} = options;

	// Get the room where combat is occurring
	const room = attacker.location;
	if (!room || !(room instanceof Room)) {
		return 0; // Can't hit if not in a room
	}

	// Verify target is in the same room
	if (target.location !== room) {
		return 0; // Target not in same room
	}

	// Check if attack hits (accuracy vs avoidance)
	// Skip miss check if guaranteedHit is true
	if (!guaranteedHit) {
		// Base hit chance is 50%, modified by the difference between accuracy and avoidance
		// accuracy 10 vs avoidance 10 = 50% hit chance
		const hitChance = 50 + (attacker.accuracy - target.avoidance);
		// Clamp hit chance to reasonable bounds (5% to 95%)
		const clampedHitChance = Math.max(5, Math.min(95, hitChance));
		const roll = Math.random() * 100;

		if (roll > clampedHitChance) {
			// Miss - send miss message
			act(
				{
					user: "You miss {target}!",
					target: "{User} misses you!",
					room: "{User} misses {target}!",
				},
				{
					user: attacker,
					target: target,
					room: room,
				},
				{ messageGroup: MESSAGE_GROUP.COMBAT }
			);
			return 0;
		}
	}

	// Check for Pure Power passive ability
	// Pure Power increases attack power from +0% at 0% proficiency to +200% at 100% proficiency
	let purePowerMultiplier = 1;
	let usedPurePower = false;
	if (attacker.knowsAbilityById(PURE_POWER.id)) {
		const proficiency = attacker.learnedAbilities.get(PURE_POWER.id) || 0;
		// Formula: 1 + (proficiency / 100) * 2
		// At 0%: 1 + 0 = 1.0 (no change)
		// At 50%: 1 + 1 = 2.0 (+100%)
		// At 100%: 1 + 2 = 3.0 (+200%)
		purePowerMultiplier = 1 + (proficiency / 100) * 2;
		usedPurePower = true;
	}

	// Combine Pure Power multiplier with provided multiplier
	const finalAttackPowerMultiplier =
		attackPowerMultiplier * purePowerMultiplier;

	// Attack hits - proceed with damage calculation
	// Get hit type from weapon or use default
	const hitType = weapon ? weapon.hitType : DEFAULT_HIT_TYPE;

	// Calculate base damage
	// Base attack power comes from strength (without weapon bonuses)
	// When using a weapon, add the weapon's attack power to the base
	// When unarmed, use only the base attack power
	const baseAttackPower = attacker.attackPower; // Base attack power (strength-derived, no weapon bonuses)
	let damage = weapon ? baseAttackPower + weapon.attackPower : baseAttackPower;

	// Apply attack power bonus and multiplier (from abilities, etc.)
	damage = (damage + attackPowerBonus) * finalAttackPowerMultiplier;

	// Apply defense reduction
	const defenseReduction = target.defense * 0.05; // 5% damage reduction per defense point
	damage = Math.max(0, Math.floor(damage - defenseReduction));

	// Check for critical hit
	if (Math.random() * 100 < attacker.critRate) {
		damage *= 2;
	}

	// Apply damage type relationships (resist, immune, vulnerable)
	const targetRelationships = target.getDamageRelationships();
	const damageMultiplier = getDamageMultiplier(
		hitType.damageType,
		targetRelationships
	);
	damage *= damageMultiplier;

	const finalDamage = Math.floor(damage);

	// Send combat messages
	const damageStr = color(String(finalDamage), COLOR.CRIMSON);

	// Get verb forms for different perspectives
	const verbBase = hitType.verb; // First person: "You punch"
	const verbThirdPersonBase = getThirdPersonVerb(hitType); // Third person: "punches"

	// Color the verbs based on hit type color (default to WHITE)
	let verbColor = hitType.color ?? COLOR.WHITE;
	let verb = color(verbBase, verbColor);
	let verbThirdPerson = color(verbThirdPersonBase, verbColor);

	// Get weapon name if provided
	let weaponName = undefined;
	if (weapon) {
		weaponName = weapon.display;
		verbColor = weapon.hitType.color ?? COLOR.WHITE;
		verb = color(weapon.hitType.verb, verbColor);
		verbThirdPerson = color(getThirdPersonVerb(weapon.hitType), verbColor);
	}

	// Build message templates based on whether ability, weapon, or default verb is used
	let userMsg: string;
	let targetMsg: string;
	let roomMsg: string;

	if (finalDamage <= 0) {
		if (abilityName) {
			userMsg = `{RYour{x ${abilityName}'s ${verb} {target}, having no effect!`;
			targetMsg = `{User}'s ${abilityName}'s ${verbThirdPerson} {Ryou{x, having no effect!`;
			roomMsg = `{User}'s ${abilityName}'s ${verbThirdPerson} {target}, having no effect!`;
		} else if (weaponName) {
			userMsg = `{RYou{x ${weaponName}'s ${verb} does absolutely nothing to {target}!`;
			targetMsg = `{User}'s ${weaponName}'s ${verbThirdPerson} does absolutely nothing to {Ryou{x!`;
			roomMsg = `{User}'s ${weaponName}'s ${verbThirdPerson} does absolutely nothing to {target}!`;
		} else {
			userMsg = `{RYou{x ${verb} {target}, doing absolutely nothing!`;
			targetMsg = `{User} ${verbThirdPerson} {Ryou{x, doing absolutely nothing!`;
			roomMsg = `{User} ${verbThirdPerson} {target}, doing absolutely nothing!`;
		}
	} else if (abilityName) {
		// With ability: ability is the subject, always use "hits"
		userMsg = `{RYour{x ${abilityName} ${verbThirdPerson} {target} for ${damageStr} damage!`;
		targetMsg = `{User}'s ${abilityName} ${verbThirdPerson} {Ryou{x for ${damageStr} damage!`;
		roomMsg = `{User}'s ${abilityName} ${verbThirdPerson} {target} for ${damageStr} damage!`;
	} else if (weaponName) {
		// With weapon: weapon is the subject, so always use third person
		userMsg = `{RYour{x ${weaponName} ${verbThirdPerson} {target} for ${damageStr} damage!`;
		targetMsg = `{User}'s ${weaponName} ${verbThirdPerson} {Ryou{x for ${damageStr} damage!`;
		roomMsg = `{User}'s ${weaponName} ${verbThirdPerson} {target} for ${damageStr} damage!`;
	} else {
		// Without weapon: user is the subject
		// First person (user sees): "You punch"
		userMsg = `{RYou{x ${verb} {target} for ${damageStr} damage!`;
		// Third person (target/room see): "{User} punches"
		targetMsg = `{User} ${verbThirdPerson} {Ryou{x for ${damageStr} damage!`;
		roomMsg = `{User} ${verbThirdPerson} {target} for ${damageStr} damage!`;
	}

	damageMessage(
		{
			user: userMsg,
			target: targetMsg,
			room: roomMsg,
		},
		{
			user: attacker,
			target: target,
			room: room,
		},
		target,
		finalDamage,
		{ messageGroup: MESSAGE_GROUP.COMBAT }
	);

	// Deal the damage (this handles threat generation, death, and combat initiation)
	target.damage(attacker, finalDamage);

	return finalDamage;
}

/**
 * Gets the mob with the highest threat that is in the same room as the NPC.
 * Returns undefined if no valid target is found in the room.
 *
 * @param npc The NPC to check threat for
 * @param room The room to check for targets in
 * @returns The mob with highest threat in the room, or undefined
 */
function getHighestThreatInRoom(npc: Mob, room: Room): Mob | undefined {
	if (!npc.threatTable || npc.threatTable.size === 0) {
		return undefined;
	}

	let highestThreat = -1;
	let highestThreatMob: Mob | undefined;

	for (const [mob, entry] of npc.threatTable.entries()) {
		// Only consider mobs that are in the same room
		if (mob.location === room && entry.value > highestThreat) {
			highestThreat = entry.value;
			highestThreatMob = mob;
		}
	}

	return highestThreatMob;
}

/**
 * Adds a mob to the combat queue.
 * Called automatically when a mob engages a target.
 *
 * @param mob The mob to add to combat
 */
export function addToCombatQueue(mob: Mob): void {
	if (mob.isInCombat()) {
		combatQueue.add(mob);
	}
}

/**
 * Removes a mob from the combat queue.
 * Called automatically when a mob disengages from combat.
 * For player characters with combat busy mode enabled, this will dump queued messages.
 *
 * @param mob The mob to remove from combat
 */
export function removeFromCombatQueue(mob: Mob): void {
	const wasInCombat = combatQueue.has(mob);
	combatQueue.delete(mob);

	// If this is a player character that just exited combat and has combat busy mode enabled,
	// dump their queued messages
	if (
		mob.character &&
		wasInCombat &&
		!mob.isInCombat() &&
		mob.character.settings.combatBusyModeEnabled
	) {
		const messages = mob.character.readQueuedMessages();
		if (messages.length > 0) {
			mob.character.sendMessage(
				`Combat ended. ${messages.length} queued message${
					messages.length === 1 ? "" : "s"
				} dumped.`,
				MESSAGE_GROUP.SYSTEM
			);
		}
	}
}

/**
 * Checks if a mob is in the combat queue.
 *
 * @param mob The mob to check
 * @returns True if the mob is in the combat queue
 */
export function isInCombatQueue(mob: Mob): boolean {
	return combatQueue.has(mob);
}

/**
 * Gets all mobs currently in the combat queue.
 *
 * @returns Array of all mobs in combat
 */
export function getCombatQueue(): ReadonlyArray<Mob> {
	return Array.from(combatQueue);
}

/**
 * Processes threat-based target switching for NPCs.
 * NPCs will switch targets if a new attacker has 10% more threat than the current target.
 * Only switches if the new target is in the same room as the NPC.
 *
 * @param npc The NPC mob to process threat switching for
 */
export function processThreatSwitching(npc: Mob): void {
	if (!npc.threatTable || npc.character) {
		return;
	}

	const npcRoom = npc.location;
	if (!(npcRoom instanceof Room)) {
		npc.combatTarget = undefined;
		return;
	}

	const currentTarget = npc.combatTarget;
	if (!currentTarget) {
		// No current target, pick highest threat that's in the same room
		const highestThreat = getHighestThreatInRoom(npc, npcRoom);
		if (highestThreat) {
			// Use initiateCombat to properly set up combat with new target
			initiateCombat(npc, highestThreat, true);
		}
		return;
	}

	// Check if current target is still in the same room
	if (currentTarget.location !== npcRoom) {
		// Current target left the room, find a new target that's actually in the room
		const highestThreat = getHighestThreatInRoom(npc, npcRoom);
		if (highestThreat) {
			// Use initiateCombat to properly set up combat with new target
			initiateCombat(npc, highestThreat, true);
		} else {
			// No valid target in room, clear target and remove from combat queue
			npc.combatTarget = undefined;
		}
		return;
	}

	const highestThreatMob = getHighestThreatInRoom(npc, npcRoom);
	if (!highestThreatMob || highestThreatMob === currentTarget) {
		return;
	}

	const currentThreat = npc.getThreat(currentTarget);
	const highestThreat = npc.getThreat(highestThreatMob);
	const graceThreshold = currentThreat * THREAT_GRACE_WINDOW;

	if (highestThreat >= graceThreshold) {
		// Switch targets - we're already in combat, so just update the target
		// Don't use initiateCombat here as it would send engagement messages again
		initiateCombat(npc, highestThreatMob, true);
	}
}

const deathColorRepeatingTransformer = repeatingColorStringTransformer(
	[
		COLOR.OLIVE,
		COLOR.MAROON,
		COLOR.CRIMSON,
		COLOR.YELLOW,
		COLOR.CRIMSON,
		COLOR.MAROON,
	],
	3
);

/**
 * Handles mob death, removing from combat and cleaning up.
 * This is a central function for all death handling logic.
 *
 * @param deadMob The mob that died
 * @param killer The mob that killed it (if any)
 *
 * @example
 * ```typescript
 * if (mob.health <= 0) {
 *   handleDeath(mob, attacker);
 * }
 * ```
 */
export function handleDeath(deadMob: Mob, killer?: Mob): void {
	const room = deadMob.location;
	if (!room || !(room instanceof Room)) {
		return; // Can't handle death if not in a room
	}

	// Remove from combat
	deadMob.combatTarget = undefined;

	// Clear threat table
	deadMob.clearThreatTable();

	// Remove threat from other mobs' threat tables
	for (const mob of room.contents) {
		if (mob instanceof Mob) {
			mob.removeThreat(deadMob);
		}
	}

	// Send death messages
	act(
		{
			user: "You have been slain by {target}!",
			room: "{User} has been slain!",
		},
		{
			user: deadMob,
			target: killer,
			room: room,
		},
		{
			messageGroup: MESSAGE_GROUP.COMBAT,
			excludeUser: true,
			excludeTarget: true,
		}
	);

	// Award experience to killer if present
	if (killer) {
		if (!killer.character) {
			processThreatSwitching(killer);
		} else {
			if (killer.combatTarget === deadMob) killer.combatTarget = undefined;

			// Create ASCII art for "SLAIN" (3 lines tall)
			const slainArt = [
				"@@@@@@   @@@        @@@@@@   @@@  @@@  @@@",
				"@@@@@@@   @@@       @@@@@@@@  @@@  @@@@ @@@ ",
				"!@@       @@!       @@!  @@@  @@!  @@!@!@@@ ",
				"!@!       !@!       !@!  @!@  !@!  !@!!@!@! ",
				"!!@@!!    @!!       @!@!@!@!  !!@  @!@ !!@! ",
				" !!@!!!   !!!       !!!@!!!!  !!!  !@!  !!! ",
				"     !:!  !!:       !!:  !!!  !!:  !!:  !!!  ",
				"    !:!    :!:      :!:  !:!  :!:  :!:  !:!  ",
				":::: ::    :: ::::  ::   :::   ::   ::   :: ",
				":: : :    : :: : :   :   : :  :    ::    :  ",
			];

			// Build the message with "You have" on the left and mob name on the right of middle line
			const leftText = "You have ";
			const rightText = ` ${deadMob}!`;

			// Create the message lines
			const messageLines: string[] = [];
			for (let i = 0; i < slainArt.length; i++) {
				if (i === Math.ceil(slainArt.length / 2)) {
					messageLines.push(leftText + slainArt[i] + rightText);
				} else {
					messageLines.push(
						" ".repeat(leftText.length) +
							slainArt[i] +
							" ".repeat(rightText.length)
					);
				}
			}

			const box = string.box({
				input: messageLines,
				width: 73,
				color: deathColorRepeatingTransformer,
				innerColor: (str) => stickyColor(str, COLOR.CRIMSON),
				sizer: SIZER,
				style: {
					vPadding: 1,
					titleHAlign: string.ALIGN.CENTER,
					titleBorder: {
						left: ">",
						right: "<",
					},
					vertical: "****",
					horizontal: "*",
					hAlign: string.ALIGN.CENTER,
				},
			});

			killer.sendMessage(box.join("\n"), MESSAGE_GROUP.COMBAT);
			// Only players gain experience
			const experienceGained = killer.awardKillExperience(deadMob.level);
			if (experienceGained > 0) {
				// Send experience message to the killer
				killer.character.sendMessage(
					`You gain ${experienceGained} experience!`,
					MESSAGE_GROUP.INFO
				);
			}
		}
	}

	// delete NPCs
	if (!deadMob.character) {
		deadMob.destroy();
		return;
	}

	// preserve characters
	// move mob to graveyard and set HP to 1
	try {
		const graveyard = getLocation(LOCATION.GRAVEYARD);
		if (graveyard) {
			deadMob.move(graveyard);
			deadMob.resetResources();
			showRoom(deadMob, graveyard);
		}
	} catch (error) {
		logger.warn(`Failed to move ${deadMob.display} to graveyard: ${error}`);
	}

	// TODO: Handle loot, etc.
}

/**
 * Processes a single combat round for a mob.
 * The mob attacks its target if it has one and is still in the same room.
 *
 * @param mob The mob to process a combat round for
 */
function processMobCombatRound(mob: Mob): void {
	if (!mob.location || !(mob.location instanceof Room)) {
		mob.combatTarget = undefined;
		return;
	}

	if (!mob.combatTarget) {
		mob.combatTarget = undefined;
		return;
	}

	// Check if target is still in the same room
	if (mob.combatTarget.location !== mob.location) {
		mob.combatTarget = undefined;
		return;
	}

	// Process threat switching for NPCs
	if (!mob.character) {
		processThreatSwitching(mob);
		if (!mob.combatTarget) {
			removeFromCombatQueue(mob);
			return;
		}
	}

	// Perform the hit (oneHit handles accuracy checks, damage calculation, messages, and damage dealing)
	const mainHand = mob.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
	const weapon = mainHand instanceof Weapon ? mainHand : undefined;
	oneHit({ attacker: mob, target: mob.combatTarget, weapon });

	// extra hit when dual wielding
	const offHand = mob.getEquipped(EQUIPMENT_SLOT.OFF_HAND);
	const weaponOff = offHand instanceof Weapon ? offHand : undefined;
	if (weaponOff)
		oneHit({ attacker: mob, target: mob.combatTarget, weapon: weaponOff });
}

/**
 * Processes a full combat round for all mobs in the combat queue.
 * Mobs are sorted by agility (highest first) and each attacks their target.
 * This function is called every 3 seconds by the game loop.
 */
export function processCombatRound(): void {
	// Sort combat queue by agility (highest first)
	const sortedMobs = Array.from(combatQueue).sort((a, b) => {
		return b.agility - a.agility;
	});

	// Process each mob's combat round
	const characters = sortedMobs.filter((mob) => mob.character);
	for (const mob of sortedMobs) {
		processMobCombatRound(mob);
	}
	characters.forEach((mob) => !mob.isInCombat() || mob.character!.showPrompt());
}

/**
 * Initiates combat between two mobs.
 * The attacker engages the defender, and both are added to the combat queue.
 *
 * @param attacker The mob initiating combat
 * @param defender The mob being attacked
 * @param room The room where combat is occurring
 */
export function initiateCombat(
	attacker: Mob,
	defender: Mob,
	reaction: boolean = false
): void {
	if (attacker.combatTarget === defender) {
		return;
	}

	const originalTarget = attacker.combatTarget;
	attacker.combatTarget = defender;
	// not a reactionary initiation (backfoot)
	if (!reaction) {
		// defender	is an NPC? defender needs to consider us a threat
		if (!defender.character) {
			defender.addToThreatTable(attacker);
		} else {
			// defender is a character and not in combat? initiate combat
			if (!defender.isInCombat()) {
				initiateCombat(defender, attacker, true);
			}
		}

		// we didn't have a target before, free round of combat
		if (!originalTarget) {
			processMobCombatRound(attacker);
		}
	}
}
