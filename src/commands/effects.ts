/**
 * Effects command for displaying active effects.
 *
 * Shows all active effects on the player's mob, including passive effects,
 * damage over time, and heal over time effects.
 *
 * @example
 * ```
 * effects
 * ```
 *
 * **Pattern:** `effects~`
 * @module commands/effects
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR, SIZER } from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";
import { string } from "mud-ext";
import {
	isPassiveEffect,
	isDamageOverTimeEffect,
	isHealOverTimeEffect,
} from "../core/effect.js";

function formatDuration(ms: number): string {
	if (ms === Number.MAX_SAFE_INTEGER) {
		return color("Permanent", COLOR.LIME);
	}
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return `${days}d ${hours % 24}h`;
	} else if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	} else {
		return `${seconds}s`;
	}
}

function formatTimeRemaining(expiresAt: number): string {
	if (expiresAt === Number.MAX_SAFE_INTEGER) {
		return color("Permanent", COLOR.LIME);
	}
	const now = Date.now();
	const remaining = expiresAt - now;
	if (remaining <= 0) {
		return color("Expired", COLOR.SILVER);
	}
	return formatDuration(remaining);
}

export default {
	pattern: "effects~",
	execute(context: CommandContext): void {
		const { actor } = context;

		const effects = actor.getEffects();

		if (effects.size === 0) {
			actor.sendMessage(
				"You have no active effects.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Collect effect data
		const effectData: Array<{
			name: string;
			type: string;
			timeRemaining: string;
			details: string;
			caster: string;
		}> = [];

		for (const effect of effects) {
			const template = effect.template;
			const isArchetype = effect.caster === actor;

			// Determine effect type
			let typeStr: string;
			let details: string = "";
			if (isPassiveEffect(template)) {
				typeStr = color("Passive", COLOR.CYAN);
				const detailParts: string[] = [];

				// Primary attributes
				if (template.primaryAttributeModifiers) {
					const mods: string[] = [];
					if (template.primaryAttributeModifiers.strength)
						mods.push(
							`STR ${
								template.primaryAttributeModifiers.strength > 0 ? "+" : ""
							}${template.primaryAttributeModifiers.strength}`
						);
					if (template.primaryAttributeModifiers.agility)
						mods.push(
							`AGI ${
								template.primaryAttributeModifiers.agility > 0 ? "+" : ""
							}${template.primaryAttributeModifiers.agility}`
						);
					if (template.primaryAttributeModifiers.intelligence)
						mods.push(
							`INT ${
								template.primaryAttributeModifiers.intelligence > 0 ? "+" : ""
							}${template.primaryAttributeModifiers.intelligence}`
						);
					if (mods.length > 0) detailParts.push(mods.join(", "));
				}

				// Secondary attributes
				if (template.secondaryAttributeModifiers) {
					const mods: string[] = [];
					if (template.secondaryAttributeModifiers.attackPower !== undefined)
						mods.push(
							`AP ${
								template.secondaryAttributeModifiers.attackPower > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.attackPower}`
						);
					if (template.secondaryAttributeModifiers.defense !== undefined)
						mods.push(
							`DEF ${
								template.secondaryAttributeModifiers.defense > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.defense}`
						);
					if (template.secondaryAttributeModifiers.critRate !== undefined)
						mods.push(
							`CRIT ${
								template.secondaryAttributeModifiers.critRate > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.critRate}`
						);
					if (template.secondaryAttributeModifiers.avoidance !== undefined)
						mods.push(
							`AVO ${
								template.secondaryAttributeModifiers.avoidance > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.avoidance}`
						);
					if (template.secondaryAttributeModifiers.accuracy !== undefined)
						mods.push(
							`ACC ${
								template.secondaryAttributeModifiers.accuracy > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.accuracy}`
						);
					if (template.secondaryAttributeModifiers.spellPower !== undefined)
						mods.push(
							`SP ${
								template.secondaryAttributeModifiers.spellPower > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.spellPower}`
						);
					if (template.secondaryAttributeModifiers.resilience !== undefined)
						mods.push(
							`RES ${
								template.secondaryAttributeModifiers.resilience > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.resilience}`
						);
					if (template.secondaryAttributeModifiers.vitality !== undefined)
						mods.push(
							`VIT ${
								template.secondaryAttributeModifiers.vitality > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.vitality}`
						);
					if (template.secondaryAttributeModifiers.wisdom !== undefined)
						mods.push(
							`WIS ${
								template.secondaryAttributeModifiers.wisdom > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.wisdom}`
						);
					if (template.secondaryAttributeModifiers.endurance !== undefined)
						mods.push(
							`END ${
								template.secondaryAttributeModifiers.endurance > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.endurance}`
						);
					if (template.secondaryAttributeModifiers.spirit !== undefined)
						mods.push(
							`SPI ${
								template.secondaryAttributeModifiers.spirit > 0 ? "+" : ""
							}${template.secondaryAttributeModifiers.spirit}`
						);
					if (mods.length > 0) detailParts.push(mods.join(", "));
				}

				// Resource capacities
				if (template.resourceCapacityModifiers) {
					const mods: string[] = [];
					if (template.resourceCapacityModifiers.maxHealth !== undefined)
						mods.push(
							`MaxHP ${
								template.resourceCapacityModifiers.maxHealth > 0 ? "+" : ""
							}${template.resourceCapacityModifiers.maxHealth}`
						);
					if (template.resourceCapacityModifiers.maxMana !== undefined)
						mods.push(
							`MaxMP ${
								template.resourceCapacityModifiers.maxMana > 0 ? "+" : ""
							}${template.resourceCapacityModifiers.maxMana}`
						);
					if (mods.length > 0) detailParts.push(mods.join(", "));
				}

				// Dynamic modifiers
				if (template.incomingDamageMultiplier !== undefined) {
					const mult = template.incomingDamageMultiplier;
					detailParts.push(
						`Incoming Damage: ${mult > 1 ? "+" : ""}${Math.round(
							(mult - 1) * 100
						)}%`
					);
				}
				if (template.outgoingDamageMultiplier !== undefined) {
					const mult = template.outgoingDamageMultiplier;
					detailParts.push(
						`Outgoing Damage: ${mult > 1 ? "+" : ""}${Math.round(
							(mult - 1) * 100
						)}%`
					);
				}
				if (template.healingReceivedMultiplier !== undefined) {
					const mult = template.healingReceivedMultiplier;
					detailParts.push(
						`Healing Received: ${mult > 1 ? "+" : ""}${Math.round(
							(mult - 1) * 100
						)}%`
					);
				}
				if (template.healingGivenMultiplier !== undefined) {
					const mult = template.healingGivenMultiplier;
					detailParts.push(
						`Healing Given: ${mult > 1 ? "+" : ""}${Math.round(
							(mult - 1) * 100
						)}%`
					);
				}

				details = detailParts.join(" | ");
			} else if (isDamageOverTimeEffect(template)) {
				typeStr = color("DoT", COLOR.CRIMSON);
				const damage = effect.tickAmount ?? template.damage;
				const ticks = effect.ticksRemaining ?? 0;
				details = `${damage} damage per tick, ${ticks} tick${
					ticks !== 1 ? "s" : ""
				} remaining`;
			} else if (isHealOverTimeEffect(template)) {
				typeStr = color("HoT", COLOR.LIME);
				const heal = effect.tickAmount ?? template.heal;
				const ticks = effect.ticksRemaining ?? 0;
				details = `${heal} heal per tick, ${ticks} tick${
					ticks !== 1 ? "s" : ""
				} remaining`;
			} else {
				typeStr = "Unknown";
			}

			// Determine caster
			let casterStr: string;
			if (isArchetype) {
				casterStr = color("Racial/Job", COLOR.SILVER);
			} else {
				casterStr = effect.caster.display;
			}

			effectData.push({
				name: template.name,
				type: typeStr,
				timeRemaining: formatTimeRemaining(effect.expiresAt),
				details: details || template.description,
				caster: casterStr,
			});
		}

		// Sort by name
		effectData.sort((a, b) => a.name.localeCompare(b.name));

		// Build table
		const lines: string[] = [];
		lines.push(color("=== Active Effects ===", COLOR.YELLOW));

		// Table header
		const header = `${string.pad("Effect", 25, string.ALIGN.LEFT)} ${string.pad(
			"Type",
			10,
			string.ALIGN.CENTER
		)} ${string.pad("Time Remaining", 18, string.ALIGN.CENTER)} ${string.pad(
			"Caster",
			20,
			string.ALIGN.LEFT
		)}`;
		lines.push(color(header, COLOR.CYAN));

		// Table rows
		for (const { name, type, timeRemaining, details, caster } of effectData) {
			const effectName = color(name, COLOR.WHITE);
			const casterColored = color(caster, COLOR.SILVER);

			const row = `${string.pad({
				string: effectName,
				width: 25,
				sizer: SIZER,
				textAlign: string.ALIGN.LEFT,
			})} ${string.pad({
				string: type,
				width: 10,
				sizer: SIZER,
				textAlign: string.ALIGN.CENTER,
			})} ${string.pad({
				string: timeRemaining,
				width: 18,
				sizer: SIZER,
				textAlign: string.ALIGN.CENTER,
			})} ${string.pad({
				string: casterColored,
				width: 20,
				sizer: SIZER,
				textAlign: string.ALIGN.LEFT,
			})}`;
			lines.push(row);

			// Add details line if present
			if (details) {
				const detailsLine = string.pad({
					string: color(`  > ${details}`, COLOR.SILVER),
					width: 80,
					sizer: SIZER,
					textAlign: string.ALIGN.LEFT,
				});
				lines.push(detailsLine);
			}
		}

		// Footer
		lines.push("");
		lines.push(
			color(
				`Total: ${effectData.length} effect${
					effectData.length === 1 ? "" : "s"
				}`,
				COLOR.SILVER
			)
		);

		// Box the output
		const boxed = string.box({
			input: lines,
			width: 80,
			sizer: SIZER,
			style: {
				...string.BOX_STYLES.PLAIN,
				hPadding: 1,
				vPadding: 1,
			},
		});

		actor.sendMessage(boxed.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
