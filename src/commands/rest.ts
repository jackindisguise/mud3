/**
 * Rest command for recovering health, mana, and reducing exhaustion.
 *
 * Triggers a 30-second cooldown, after which the player recovers:
 * - 33% of maximum health
 * - 33% of maximum mana
 * - -33 exhaustion
 *
 * @example
 * ```
 * rest
 * ```
 *
 * **Pattern:** `rest~`
 * @module commands/rest
 */

import { CommandContext, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR } from "../core/color.js";
import { act } from "../utils/act.js";
import { restRegeneration } from "../registry/regeneration.js";

const REST_COOLDOWN_MS = 30 * 1000; // 30 seconds

export const command = {
	pattern: "rest~",
	priority: PRIORITY.HIGH,
	cooldown: (context: CommandContext, args: Map<string, any>) => {
		const { actor } = context;
		if (actor.isInCombat()) {
			return 0; // Can't rest in combat
		}
		const needHealth = actor.health < actor.maxHealth;
		const needMana = actor.mana < actor.maxMana;
		const needExhaustion = actor.exhaustion > 0;
		if (!needHealth && !needMana && !needExhaustion) {
			return 0;
		}

		return REST_COOLDOWN_MS;
	},
	execute(context: CommandContext): void {
		const { actor, room } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can rest.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (actor.isInCombat()) {
			actor.sendMessage(
				"You cannot rest while in combat.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (!room) {
			actor.sendMessage("You can't rest here.", MESSAGE_GROUP.COMMAND_RESPONSE);
			return;
		}

		if (
			actor.health >= actor.maxHealth &&
			actor.mana >= actor.maxMana &&
			actor.exhaustion <= 0
		) {
			actor.sendMessage(
				"You are already at full capacity.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		actor.sendMessage("You begin to rest.", MESSAGE_GROUP.COMMAND_RESPONSE);
		act(
			{
				room: "{User} begins to rest.",
			},
			{
				user: actor,
				room,
			},
			{ excludeUser: true }
		);

		setTimeout(() => {
			const recovery = restRegeneration(actor);

			// Build recovery message
			const recoveryParts: string[] = [];
			if (recovery.healthGain > 0) {
				recoveryParts.push(
					`${color(`+${recovery.healthGain}`, COLOR.LIME)} health`
				);
			}
			if (recovery.manaGain > 0) {
				recoveryParts.push(
					`${color(`+${recovery.manaGain}`, COLOR.CYAN)} mana`
				);
			}
			if (recovery.exhaustionReduction > 0) {
				recoveryParts.push(
					`${color(
						`${recovery.exhaustionReduction}`,
						COLOR.YELLOW
					)}% exhaustion`
				);
			}

			if (recoveryParts.length > 0) {
				actor.sendMessage(
					`You rest and recover ${recoveryParts.join(", ")}.`,
					MESSAGE_GROUP.INFO
				);
			} else {
				actor.sendMessage(
					"You don't feel any more rested.",
					MESSAGE_GROUP.INFO
				);
			}
		}, REST_COOLDOWN_MS);
	},
} satisfies CommandObject;
