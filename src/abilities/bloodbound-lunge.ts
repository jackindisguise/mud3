/**
 * Bloodbound Lunge ability - A lunge attack bound by blood.
 *
 * @example
 * ```
 * bloodbound lunge <target>
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room, EQUIPMENT_SLOT, Weapon } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../act.js";
import { oneHit } from "../combat.js";

export const ABILITY_ID = "bloodbound-lunge";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Bloodbound Lunge",
	description: "Lunge at your target with blood-bound ferocity.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 4000;
const BASE_DAMAGE_MULTIPLIER = 1.8;

export const command: CommandObject = {
	pattern: "'bloodbound lunge'~ <target:mob?>",
	aliases: ["bbl <target:mob?>"],
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

		const mainHand = actor.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
		const weapon = mainHand instanceof Weapon ? mainHand : undefined;

		act(
			{
				user: `You lunge at {target} with blood-bound ferocity!`,
				target: `{User} lunges at you with blood-bound ferocity!`,
				room: `{User} lunges at {target} with blood-bound ferocity!`,
			},
			{
				user: actor,
				target: target,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;
		const damageMultiplier =
			BASE_DAMAGE_MULTIPLIER * (1 + proficiencyPercent / 100);

		const damageDealt = oneHit({
			attacker: actor,
			target: target,
			guaranteedHit: false,
			abilityName: ability.name.toLowerCase(),
			attackPowerMultiplier: damageMultiplier,
			weapon,
		});

		// Heal for the damage dealt
		if (damageDealt > 0) {
			const oldHealth = actor.health;
			actor.health = Math.min(actor.maxHealth, actor.health + damageDealt);
			const actualHeal = actor.health - oldHealth;

			if (actualHeal > 0) {
				act(
					{
						user: `You recover ${actualHeal} health from the blood-bound strike!`,
						room: `{User} recovers ${actualHeal} health from the blood-bound strike!`,
					},
					{
						user: actor,
						room: room,
					},
					{ messageGroup: MESSAGE_GROUP.COMBAT, excludeTarget: true }
				);
			}
		}

		actor.useAbility(ability, 1);
	},
};
