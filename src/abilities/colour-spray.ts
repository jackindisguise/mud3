/**
 * Colour Spray ability - A spray of magical energy hitting with all non-martial damage types.
 *
 * @example
 * ```
 * colour spray <target>
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../utils/act.js";
import { oneMagicHit } from "../registry/combat.js";
import {
	COMMON_HIT_TYPES,
	ELEMENTAL_DAMAGE_TYPE,
	ENERGY_DAMAGE_TYPE,
	MISC_DAMAGE_TYPE,
} from "../core/damage-types.js";

export const ABILITY_ID = "colour-spray";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Colour Spray",
	description:
		"Spray your target with a rainbow of magical energy, hitting with all non-martial damage types.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 8000;
const BASE_DAMAGE_MULTIPLIER = 0.15; // Per hit, so 12 hits = 1.8x total

// Map each non-martial damage type to a hit type
const DAMAGE_TYPE_HIT_TYPES: Array<{ damageType: string; hitTypeKey: string }> =
	[
		// Elemental
		{ damageType: ELEMENTAL_DAMAGE_TYPE.FIRE, hitTypeKey: "burn" },
		{ damageType: ELEMENTAL_DAMAGE_TYPE.ICE, hitTypeKey: "freeze" },
		{ damageType: ELEMENTAL_DAMAGE_TYPE.ELECTRIC, hitTypeKey: "shock" },
		{ damageType: ELEMENTAL_DAMAGE_TYPE.WATER, hitTypeKey: "drench" },
		{ damageType: ELEMENTAL_DAMAGE_TYPE.AIR, hitTypeKey: "buffet" },
		// Energy
		{ damageType: ENERGY_DAMAGE_TYPE.RADIANT, hitTypeKey: "smite" },
		{ damageType: ENERGY_DAMAGE_TYPE.NECROTIC, hitTypeKey: "wither" },
		{ damageType: ENERGY_DAMAGE_TYPE.PSYCHIC, hitTypeKey: "assault" },
		{ damageType: ENERGY_DAMAGE_TYPE.FORCE, hitTypeKey: "pummel" },
		{ damageType: ENERGY_DAMAGE_TYPE.THUNDER, hitTypeKey: "resonate" },
		// Misc
		{ damageType: MISC_DAMAGE_TYPE.POISON, hitTypeKey: "venom" },
		{ damageType: MISC_DAMAGE_TYPE.ACID, hitTypeKey: "corrode" },
	];

export const command: CommandObject = {
	pattern: "'colour spray'~ <target:mob?>",
	aliases: ["'color spray'~ <target:mob?>", "cs <target:mob?>"],
	cooldown(context: CommandContext, args: Map<string, any>) {
		const { actor, room } = context;
		if (!actor.knowsAbilityById(ABILITY_ID)) {
			return 0;
		}
		if (!room) {
			return 0;
		}
		let target = args.get("target") as Mob | undefined;
		if (!target) target = actor.combatTarget;
		if (!target) return 0;
		return COOLDOWN_MS;
	},

	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;

		if (!actor.knowsAbilityById(ABILITY_ID)) {
			actor.sendMessage(
				"You don't know that ability.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		let target = args.get("target") as Mob | undefined;
		if (!target) target = actor.combatTarget;
		if (!target) {
			actor.sendMessage(
				"You need to specify a target.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (target.location !== room) {
			actor.sendMessage(
				"They are not in the same room as you.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		act(
			{
				user: `You unleash a brilliant spray of colours at {target}!`,
				target: `{User} unleashes a brilliant spray of colours at you!`,
				room: `{User} unleashes a brilliant spray of colours at {target}!`,
			},
			{
				user: actor,
				target: target,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		// Get proficiency to scale damage
		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;
		const damageMultiplier =
			BASE_DAMAGE_MULTIPLIER * (1 + proficiencyPercent / 100);

		let hitCount = 0;
		// Hit with all non-martial damage types
		for (const { damageType, hitTypeKey } of DAMAGE_TYPE_HIT_TYPES) {
			const hitType = COMMON_HIT_TYPES.get(hitTypeKey);
			if (hitType) {
				const damage = oneMagicHit({
					attacker: actor,
					target: target,
					guaranteedHit: false,
					abilityName: ability.name.toLowerCase(),
					hitType: hitType,
					spellPowerMultiplier: damageMultiplier,
				});
				if (damage > 0) {
					hitCount++;
				}
			}
		}

		if (hitCount > 0) {
			actor.useAbility(ability, 1);
		}
	},

	onError(context: CommandContext, result: any): void {
		if (result.error?.includes("target")) {
			context.actor.sendMessage(
				"Who do you want to attack?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
};
