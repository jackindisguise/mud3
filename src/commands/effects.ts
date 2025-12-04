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

function formatAttributeName(name: string): string {
	return name
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

function formatCompactModifier(
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
	const sign = isPositive ? "+" : "";
	const formattedName = formatAttributeName(attributeName);
	const coloredValue = color(`${sign}${value}`, colorCode);
	return `${coloredValue} ${formattedName}`;
}

function formatCompactPercentageModifier(
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
	// Format name with proper capitalization (e.g., "incomingDamage" -> "Incoming Damage")
	const formattedName = formatAttributeName(attributeName);
	const coloredPercent = color(
		`${percent > 0 ? "+" : ""}${percent}%`,
		colorCode
	);
	return `${coloredPercent} ${formattedName}`;
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
			modifiers: string[];
			details: string;
			source: string;
			appliedAt: number;
			isAncestryOrDiscipline: boolean;
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
			let modifiers: string[] = [];
			let details: string = "";

			if (isPassiveEffect(template)) {
				typeStr = color("Passive", COLOR.CYAN);

				// Primary attributes
				if (template.primaryAttributeModifiers) {
					if (template.primaryAttributeModifiers.strength) {
						modifiers.push(
							formatCompactModifier(
								"strength",
								template.primaryAttributeModifiers.strength
							)
						);
					}
					if (template.primaryAttributeModifiers.agility) {
						modifiers.push(
							formatCompactModifier(
								"agility",
								template.primaryAttributeModifiers.agility
							)
						);
					}
					if (template.primaryAttributeModifiers.intelligence) {
						modifiers.push(
							formatCompactModifier(
								"intelligence",
								template.primaryAttributeModifiers.intelligence
							)
						);
					}
				}

				// Secondary attributes
				if (template.secondaryAttributeModifiers) {
					if (template.secondaryAttributeModifiers.attackPower !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"attackPower",
								template.secondaryAttributeModifiers.attackPower
							)
						);
					}
					if (template.secondaryAttributeModifiers.defense !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"defense",
								template.secondaryAttributeModifiers.defense
							)
						);
					}
					if (template.secondaryAttributeModifiers.critRate !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"critRate",
								template.secondaryAttributeModifiers.critRate
							)
						);
					}
					if (template.secondaryAttributeModifiers.avoidance !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"avoidance",
								template.secondaryAttributeModifiers.avoidance
							)
						);
					}
					if (template.secondaryAttributeModifiers.accuracy !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"accuracy",
								template.secondaryAttributeModifiers.accuracy
							)
						);
					}
					if (template.secondaryAttributeModifiers.spellPower !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"spellPower",
								template.secondaryAttributeModifiers.spellPower
							)
						);
					}
					if (template.secondaryAttributeModifiers.resilience !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"resilience",
								template.secondaryAttributeModifiers.resilience
							)
						);
					}
					if (template.secondaryAttributeModifiers.vitality !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"vitality",
								template.secondaryAttributeModifiers.vitality
							)
						);
					}
					if (template.secondaryAttributeModifiers.wisdom !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"wisdom",
								template.secondaryAttributeModifiers.wisdom
							)
						);
					}
					if (template.secondaryAttributeModifiers.endurance !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"endurance",
								template.secondaryAttributeModifiers.endurance
							)
						);
					}
					if (template.secondaryAttributeModifiers.spirit !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"spirit",
								template.secondaryAttributeModifiers.spirit
							)
						);
					}
				}

				// Resource capacities
				if (template.resourceCapacityModifiers) {
					if (template.resourceCapacityModifiers.maxHealth !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"maxHealth",
								template.resourceCapacityModifiers.maxHealth
							)
						);
					}
					if (template.resourceCapacityModifiers.maxMana !== undefined) {
						modifiers.push(
							formatCompactModifier(
								"maxMana",
								template.resourceCapacityModifiers.maxMana
							)
						);
					}
				}

				// Percentage modifiers
				if (template.incomingDamageMultiplier !== undefined) {
					modifiers.push(
						formatCompactPercentageModifier(
							"incomingDamage",
							template.incomingDamageMultiplier,
							true
						)
					);
				}
				if (template.outgoingDamageMultiplier !== undefined) {
					modifiers.push(
						formatCompactPercentageModifier(
							"outgoingDamage",
							template.outgoingDamageMultiplier
						)
					);
				}
				if (template.healingReceivedMultiplier !== undefined) {
					modifiers.push(
						formatCompactPercentageModifier(
							"healingReceived",
							template.healingReceivedMultiplier
						)
					);
				}
				if (template.healingGivenMultiplier !== undefined) {
					modifiers.push(
						formatCompactPercentageModifier(
							"healingGiven",
							template.healingGivenMultiplier
						)
					);
				}
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
				modifiers.push(`${remaining}/${total} absorption`);
				if (template.damageType) {
					modifiers.push(`Filter: ${template.damageType}`);
				}
				if (template.maxAbsorptionPerHit !== undefined) {
					modifiers.push(`Max/hit: ${template.maxAbsorptionPerHit}`);
				}
				const absorptionRate = template.absorptionRate ?? 1.0;
				const ratePercent = Math.round(absorptionRate * 100);
				modifiers.push(`Rate: ${ratePercent}%`);
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
				modifiers,
				details,
				source: sourceStr,
				appliedAt: effect.appliedAt,
				isAncestryOrDiscipline: isRaceEffect || isJobEffect,
			});
		}

		// Sort: ancestry/discipline effects first (by appliedAt), then others (by appliedAt)
		effectData.sort((a, b) => {
			// Ancestry and discipline effects always come first
			if (a.isAncestryOrDiscipline && !b.isAncestryOrDiscipline) {
				return -1;
			}
			if (!a.isAncestryOrDiscipline && b.isAncestryOrDiscipline) {
				return 1;
			}
			// Within the same category, sort by when they were applied (oldest first)
			return a.appliedAt - b.appliedAt;
		});

		// Build output lines
		const lines: string[] = [];
		lines.push(color("=== Active Effects ===", COLOR.YELLOW));

		// Display each effect
		for (const {
			name,
			type,
			timeRemaining,
			modifiers,
			details,
			source,
		} of effectData) {
			const effectName = color(name, COLOR.WHITE);
			const sourceColored = color(source, COLOR.SILVER);

			// Effect header: Name (duration) [Type] <Source>
			lines.push(
				` ${effectName} ${color("(", COLOR.SILVER)}${timeRemaining}${color(
					")",
					COLOR.SILVER
				)} ${type} ${color("<", COLOR.SILVER)}${sourceColored}${color(
					">",
					COLOR.SILVER
				)}`
			);

			// Display modifiers in 2 columns for passive effects
			if (modifiers.length > 0) {
				const columnWidth = 40;
				for (let i = 0; i < modifiers.length; i += 2) {
					const left = modifiers[i];
					const right = modifiers[i + 1];
					if (right) {
						lines.push(
							`  ${string.pad(
								left,
								columnWidth,
								string.ALIGN.LEFT,
								" ",
								SIZER
							)} ${right}`
						);
					} else {
						lines.push(`  ${left}`);
					}
				}
			}

			// Display details for DoT/HoT/Shield
			if (details) {
				lines.push(`  ${details}`);
			}

			// Add blank line between effects
			lines.push("");
		}

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
