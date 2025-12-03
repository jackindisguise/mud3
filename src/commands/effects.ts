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
	isShieldEffect,
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

function formatAttributeModifier(
	attributeName: string,
	value: number,
	reverseColor: boolean = false
): string {
	const isPositive = value > 0;
	const colorCode = reverseColor
		? isPositive
			? COLOR.CRIMSON
			: COLOR.LIME
		: isPositive
		? COLOR.LIME
		: COLOR.CRIMSON;
	const action = isPositive ? "Increases" : "Decreases";
	const absValue = Math.abs(value);
	const coloredName = color(attributeName, colorCode);
	const coloredValue = color(String(absValue), colorCode);
	return `${action} ${coloredName} by ${coloredValue}.`;
}

function formatPercentageModifier(
	attributeName: string,
	multiplier: number,
	reverseColor: boolean = false
): string {
	const percent = Math.round((multiplier - 1) * 100);
	const isPositive = percent > 0;
	const colorCode = reverseColor
		? isPositive
			? COLOR.CRIMSON
			: COLOR.LIME
		: isPositive
		? COLOR.LIME
		: COLOR.CRIMSON;
	const action = isPositive ? "Increases" : "Decreases";
	const absPercent = Math.abs(percent);
	const coloredName = color(attributeName, colorCode);
	const coloredPercent = color(`${absPercent}%`, colorCode);
	return `${action} ${coloredName} by ${coloredPercent}.`;
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
			description: string | undefined;
			source: string;
		}> = [];

		// Build sets of archetype passive IDs from race and job
		const racePassiveIds = new Set<string>();
		for (const passiveId of actor.race.passives) {
			racePassiveIds.add(passiveId);
		}
		const jobPassiveIds = new Set<string>();
		for (const passiveId of actor.job.passives) {
			jobPassiveIds.add(passiveId);
		}

		for (const effect of effects) {
			const template = effect.template;
			const isRaceEffect = racePassiveIds.has(template.id);
			const isJobEffect = jobPassiveIds.has(template.id);

			// Determine effect type
			let typeStr: string;
			let details: string = "";
			if (isPassiveEffect(template)) {
				typeStr = color("Passive", COLOR.CYAN);
				const detailParts: string[] = [];

				// Primary attributes
				if (template.primaryAttributeModifiers) {
					const primaryModifiers: Array<[string, number | undefined]> = [
						["strength", template.primaryAttributeModifiers.strength],
						["agility", template.primaryAttributeModifiers.agility],
						["intelligence", template.primaryAttributeModifiers.intelligence],
					];
					for (const [name, value] of primaryModifiers) {
						if (value) {
							detailParts.push(formatAttributeModifier(name, value));
						}
					}
				}

				// Secondary attributes
				if (template.secondaryAttributeModifiers) {
					const secondaryModifiers: Array<[string, number | undefined]> = [
						["attack power", template.secondaryAttributeModifiers.attackPower],
						["defense", template.secondaryAttributeModifiers.defense],
						["crit rate", template.secondaryAttributeModifiers.critRate],
						["avoidance", template.secondaryAttributeModifiers.avoidance],
						["accuracy", template.secondaryAttributeModifiers.accuracy],
						["spell power", template.secondaryAttributeModifiers.spellPower],
						["resilience", template.secondaryAttributeModifiers.resilience],
						["vitality", template.secondaryAttributeModifiers.vitality],
						["wisdom", template.secondaryAttributeModifiers.wisdom],
						["endurance", template.secondaryAttributeModifiers.endurance],
						["spirit", template.secondaryAttributeModifiers.spirit],
					];
					for (const [name, value] of secondaryModifiers) {
						if (value !== undefined) {
							detailParts.push(formatAttributeModifier(name, value));
						}
					}
				}

				// Resource capacities
				if (template.resourceCapacityModifiers) {
					const resourceModifiers: Array<[string, number | undefined]> = [
						["max health", template.resourceCapacityModifiers.maxHealth],
						["max mana", template.resourceCapacityModifiers.maxMana],
					];
					for (const [name, value] of resourceModifiers) {
						if (value !== undefined) {
							detailParts.push(formatAttributeModifier(name, value));
						}
					}
				}

				// Dynamic modifiers
				const percentageModifiers: Array<[string, number | undefined]> = [
					["incoming damage", template.incomingDamageMultiplier],
					["outgoing damage", template.outgoingDamageMultiplier],
					["healing received", template.healingReceivedMultiplier],
					["healing given", template.healingGivenMultiplier],
				];
				for (const [name, multiplier] of percentageModifiers) {
					if (multiplier !== undefined) {
						const reverseColor = name === "incoming damage";
						detailParts.push(
							formatPercentageModifier(name, multiplier, reverseColor)
						);
					}
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
			} else if (isShieldEffect(template)) {
				typeStr = color("Shield", COLOR.CYAN);
				const remaining = effect.remainingAbsorption ?? template.absorption;
				const total = template.absorption;
				const detailParts: string[] = [];
				detailParts.push(`${remaining}/${total} absorption remaining`);
				if (template.damageType) {
					detailParts.push(`Filters: ${template.damageType}`);
				}
				details = detailParts.join(" | ");
			} else {
				typeStr = "Unknown";
			}

			// Determine source
			let sourceStr: string;
			if (isRaceEffect) {
				sourceStr = color("Ancestry", COLOR.SILVER);
			} else if (isJobEffect) {
				sourceStr = color("Discipline", COLOR.SILVER);
			} else {
				sourceStr = effect.caster.display;
			}

			effectData.push({
				name: template.name,
				type: typeStr,
				timeRemaining: formatTimeRemaining(effect.expiresAt),
				details: details,
				description: template.description,
				source: sourceStr,
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
			"Source",
			20,
			string.ALIGN.LEFT
		)}`;
		lines.push(color(header, COLOR.CYAN));

		// Table rows
		for (const {
			name,
			type,
			timeRemaining,
			details,
			description,
			source,
		} of effectData) {
			const effectName = color(name, COLOR.WHITE);
			const sourceColored = color(source, COLOR.SILVER);

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
				string: sourceColored,
				width: 20,
				sizer: SIZER,
				textAlign: string.ALIGN.LEFT,
			})}`;
			lines.push(row);

			// Add description if present
			if (description) {
				lines.push(`  ${color(description, COLOR.SILVER)}`);
			}

			// Add details lines if present
			if (details) {
				const detailLines = details.split(" | ");
				for (const line of detailLines) {
					lines.push(`  ${line}`);
				}
			}

			// Add blank line between effects if there's any content
			if (description || details) {
				lines.push("");
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
