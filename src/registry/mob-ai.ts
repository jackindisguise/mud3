/**
 * Mob AI System
 *
 * Provides event-driven AI scripting for NPC mobs using a VM sandbox.
 * Supports both default behavior-based scripts and custom AI scripts.
 *
 * @module mob-ai
 */

import { EventEmitter } from "events";
import { runInNewContext } from "vm";
import { Mob, BEHAVIOR, Room, MobTemplate } from "../core/dungeon.js";
import { DIRECTION, DIRECTIONS } from "../utils/direction.js";
import { initiateCombat, oneHit, OneHitOptions } from "./combat.js";
import logger from "../utils/logger.js";
import { act } from "../utils/act.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { getAbilityById } from "../registry/ability.js";
import { resolveTemplateById } from "../registry/dungeon.js";
import { AbilityCommand, CommandContext } from "../core/command.js";
import { getCommands } from "../registry/command.js";
import { Ability } from "../core/ability.js";
import { COLOR, color, COLOR_NAME_TO_COLOR, COLORS } from "../core/color.js";
import { COMMON_HIT_TYPES } from "../core/damage-types.js";
import { capitalize, capitalizeFirst } from "../utils/string.js";

/**
 * Registry of all mobs with active AI scripts.
 * Used for efficient tick event distribution.
 */
const aiMobRegistry = new Set<Mob>();

/**
 * Persistence data for mob AI scripts, keyed by mob OID.
 * Stores state that persists across game ticks.
 */
const mobPersistence = new Map<number, Record<string, any>>();

/**
 * Memory system for mobs. Each mob has its own memory of other mobs.
 * Structure: Map<mobOID, Map<otherMobOID, Record<string, any>>>
 * This allows each mob to remember information about other mobs they've encountered.
 */
const mobMemory = new Map<number, Map<number, Record<string, any>>>();

/**
 * Cache of AI scripts by template ID.
 * Stores loaded script content for reuse.
 */
const mobAIScripts = new Map<string, string>();

/**
 * WeakMap storing EventEmitters for each mob.
 * Automatically cleans up when mob is garbage collected.
 */
const mobEventEmitters = new WeakMap<Mob, EventEmitter>();

/**
 * Get or create persistence data for a mob.
 */
function getPersistence(mob: Mob): Record<string, any> {
	const oid = mob.oid;
	let data = mobPersistence.get(oid);
	if (!data) {
		data = {};
		mobPersistence.set(oid, data);
	}
	return data;
}

/**
 * Get or create memory map for a mob.
 * Each mob has its own memory map to store information about other mobs.
 */
function getMemoryMap(mob: Mob): Map<number, Record<string, any>> {
	const oid = mob.oid;
	let memoryMap = mobMemory.get(oid);
	if (!memoryMap) {
		memoryMap = new Map<number, Record<string, any>>();
		mobMemory.set(oid, memoryMap);
	}
	return memoryMap;
}

/**
 * Get memory about a specific mob from the current mob's perspective.
 * Returns an empty object if no memory exists.
 */
function getMemory(rememberingMob: Mob, targetMob: Mob): Record<string, any> {
	const memoryMap = getMemoryMap(rememberingMob);
	const memory = memoryMap.get(targetMob.oid);
	const safeMemory = memory ? memory : {};
	if (!memory) memoryMap.set(targetMob.oid, safeMemory);
	return safeMemory;
}

/**
 * Generate default behavior scripts based on mob's behavior flags.
 */
function generateDefaultBehaviorScripts(mob: Mob): string {
	const scripts: string[] = [];

	if (mob.hasBehavior(BEHAVIOR.AGGRESSIVE)) {
		scripts.push(
			`
// AGGRESSIVE behavior - attack player mobs that enter our sight
on("sight", (mob) => {
    if (mob.character && !self.combatTarget) {
        self.initiateCombat(mob);
    }
});
		`.trim()
		);
	}

	if (mob.hasBehavior(BEHAVIOR.WANDER)) {
		scripts.push(
			`
// WANDER behavior - randomly move around every tick
on("tick", () => {
    if(self.combatTarget) return;
    self.wander();
});
		`.trim()
		);
	}

	if (mob.hasBehavior(BEHAVIOR.WIMPY)) {
		scripts.push(
			`
// WIMPY behavior - flee when health drops below 25%
let fleeCooldown = 0;

on("combat-round", () => {
    if (fleeCooldown > 0) {
        fleeCooldown--;
    }
});

on("got-hit", (attacker) => {
    const healthPercent = (self.health / self.maxHealth) * 100;
    if (healthPercent <= 25 && fleeCooldown <= 0 && self.combatTarget) {
        if (self.flee()) {
            fleeCooldown = 3; // 3 round cooldown
        }
    }
});
		`.trim()
		);
	}

	return scripts.join("\n\n");
}

/**
 * Create a sandboxed VM context for AI script execution.
 */
function createAISandbox(mob: Mob): Record<string, any> {
	const emitter = mob.aiEvents || mobEventEmitters.get(mob);
	if (!emitter) {
		throw new Error(`No EventEmitter found for mob ${mob.oid}`);
	}

	const persistence = getPersistence(mob);

	// used for wander and flee
	const wander = () => {
		// Shuffle directions
		const shuffled = [...DIRECTIONS].sort(() => Math.random() - 0.5);
		for (const dir of shuffled) {
			if (mob.canStep(dir)) {
				mob.step(dir);
				return true;
			}
		}

		return false;
	};

	// Create limited Mob API proxy
	const mobProxy = {
		toString: () => {
			return mob.display;
		},
		get display() {
			return mob.display;
		},
		get health() {
			return mob.health;
		},
		get maxHealth() {
			return mob.maxHealth;
		},
		get mana() {
			return mob.mana;
		},
		get maxMana() {
			return mob.maxMana;
		},
		get combatTarget() {
			return mob.combatTarget;
		},
		set combatTarget(target: Mob | undefined) {
			mob.combatTarget = target;
		},
		initiateCombat: (target: Mob) => {
			initiateCombat(mob, target);
		},
		canStep: (direction: DIRECTION) => mob.canStep(direction),
		step: (direction: DIRECTION) => mob.step(direction),
		say: (message: string) => {
			const room = mob.location;
			if (room instanceof Room) {
				act(
					{
						user: `You say "${message}"`,
						room: `{User} says "${message}"`,
					},
					{
						user: mob,
						room: room,
					},
					{
						messageGroup: MESSAGE_GROUP.ACTION,
					}
				);
			}
		},
		wander,
		flee: () => {
			// Clear combat target first
			mob.combatTarget = undefined;
			return wander();
		},
		getMemory: (otherMob: Mob) => {
			return getMemory(mob, otherMob);
		},
		learnAbility: (ability: Ability) => {
			mob.addAbility(ability, ability.proficiencyCurve[3]);
		},
		useAbility: (ability: Ability, target?: Mob) => {
			// Validate inputs
			if (!ability || !ability.id) {
				logger.warn("AI script called useAbility() with invalid ability");
				return;
			}
			if (!mob.knowsAbilityById(ability.id)) {
				logger.warn(
					`AI script attempted to use ability ${ability.id} that mob does not know`
				);
				return;
			}
			// Find the command for this ability
			const allCommands = getCommands();
			const abilityCommand = allCommands.find(
				(cmd) => cmd instanceof AbilityCommand && cmd.abilityId === ability.id
			) as AbilityCommand | undefined;
			if (!abilityCommand) {
				logger.warn(`No command found for ability: ${ability.id}`);
				return;
			}
			// Create command context and args
			const room = mob.location instanceof Room ? mob.location : undefined;
			if (!room) {
				logger.warn(
					`AI script attempted to use ability ${ability.id} but caster is not in a room`
				);
				return;
			}
			if (target && target.location !== room) {
				logger.warn(
					`AI script attempted to use ability ${ability.id} on target not in same room`
				);
				return;
			}
			const context: CommandContext = {
				actor: mob,
				room: room,
			};
			const args = new Map<string, any>();
			args.set("target", target);
			// Execute the ability command
			// Note: We bypass cooldowns for NPCs using abilities through AI scripts
			// as the AI script can manage its own cooldown logic if needed
			try {
				abilityCommand.execute(context, args);
			} catch (error) {
				logger.error(
					`Error executing ability ${ability.id} from AI script:`,
					error
				);
			}
		},
		oneHit: (options: Omit<OneHitOptions, "attacker">) => {
			const _options: OneHitOptions = {
				...options,
				attacker: mob,
			};
			oneHit({ ..._options });
		},
	};

	return {
		// Persistence data (global scope variables persist here)
		...persistence,
		directions: DIRECTIONS,

		// Event registration
		on: (eventName: string, callback: (...args: any[]) => void) => {
			emitter.on(eventName, callback);
		},

		// Mob reference (limited API)
		self: mobProxy,

		getAbilityById: (abilityId: string) => {
			// Look up ability from registry
			const ability = getAbilityById(abilityId);
			if (!ability) {
				logger.warn(`AI script requested unknown ability: ${abilityId}`);
				return null;
			}
			return ability;
		},
		world: {
			getMemory: (otherMob: Mob) => {
				return getPersistence(otherMob);
			},
		},

		// Constants
		DIRECTION,
		DIRECTIONS,
		color,
		COLOR,
		COLORS,
		COLOR_NAME_TO_COLOR,
		COMMON_HIT_TYPES,
		capitalize,
		capitalizeFirst,

		// Console for debugging
		console: {
			log: (...args: any[]) =>
				logger.debug(`[Mob AI ${mob.oid}] ${args.join(" ")}`),
			error: (...args: any[]) =>
				logger.error(`[Mob AI ${mob.oid}] ${args.join(" ")}`),
			warn: (...args: any[]) =>
				logger.warn(`[Mob AI ${mob.oid}] ${args.join(" ")}`),
		},
	};
}

/**
 * Execute an AI script in a sandboxed VM context.
 */
function executeAIScript(mob: Mob, script: string): void {
	if (!script || script.trim().length === 0) {
		return;
	}

	try {
		const sandbox = createAISandbox(mob);

		// Wrap code in an async function if it contains await
		const wrappedCode = script.includes("await")
			? `(async () => { ${script} })()`
			: script;

		// Execute script in sandboxed context
		runInNewContext(wrappedCode, sandbox, {
			timeout: 5000, // 5 second timeout
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(
			`AI script execution error for mob ${mob.oid} (${mob.display}): ${errorMessage}`
		);
		// Continue game execution even if AI script fails
	}
}

/**
 * Initialize AI system for a mob.
 * Sets up EventEmitter and executes AI scripts (default behaviors + custom).
 */
export function initializeMobAI(mob: Mob) {
	// Only initialize for NPCs (mobs without character)
	if (mob.character) {
		return;
	}

	try {
		// Get or create EventEmitter for this mob
		const emitter = mob.initializeAIEvents();
		mobEventEmitters.set(mob, emitter);

		// Get custom AI script from template if present and execute it first
		const templateId = mob.templateId;
		let scriptLoaded = false;
		if (templateId) {
			// Try to get script from cache first
			let customScript = mobAIScripts.get(templateId);

			// If not in cache, get from template
			if (!customScript) {
				const template = resolveTemplateById(templateId);
				if (template && template.type === "Mob") {
					const mobTemplate = template as MobTemplate;
					if (mobTemplate.aiScript) {
						customScript = mobTemplate.aiScript;
					}
				}
			}

			if (customScript) {
				executeAIScript(mob, customScript);
				scriptLoaded = true;
			}
		}

		// Generate and execute default behavior scripts after custom scripts
		const defaultScript = generateDefaultBehaviorScripts(mob);
		if (defaultScript) {
			executeAIScript(mob, defaultScript);
			scriptLoaded = true;
		}

		// Add mob to registry
		if (scriptLoaded) {
			//logger.info(`Initialized AI for mob ${mob.oid} (${mob.display})`);
			aiMobRegistry.add(mob);
		} else {
			logger.info(`No AI script found for mob ${mob.oid} (${mob.display})`);
		}
	} catch (error) {
		logger.error(`Failed to initialize AI for mob ${mob.oid}: ${error}`);
	}
}

/**
 * Clean up AI resources for a mob.
 * Removes from registry, deregisters event listeners, and clears persistence.
 */
export function cleanupMobAI(mob: Mob): void {
	try {
		// Remove from registry
		if (aiMobRegistry.has(mob)) {
			aiMobRegistry.delete(mob);
		}

		// Get EventEmitter and remove all listeners
		const emitter = mobEventEmitters.get(mob);
		if (emitter) {
			emitter.removeAllListeners();
		}

		// Clear persistence data
		if (mobPersistence.has(mob.oid)) {
			mobPersistence.delete(mob.oid);
		}

		// Clear memory data
		if (mobMemory.has(mob.oid)) {
			mobMemory.delete(mob.oid);
		}

		logger.debug(`Cleaned up AI for mob ${mob.oid}`);
	} catch (error) {
		logger.error(`Error cleaning up AI for mob ${mob.oid}: ${error}`);
	}
}

/**
 * Get the EventEmitter for a mob's AI events.
 */
export function getMobAIEvents(mob: Mob): EventEmitter | undefined {
	return mobEventEmitters.get(mob);
}

/**
 * Process AI tick events for all mobs in registry.
 * Called by game-wide tick event system.
 */
export function processAITick(): void {
	for (const mob of aiMobRegistry) {
		const emitter = mobEventEmitters.get(mob);
		if (emitter) {
			emitter.emit("tick");
		}
	}
}

/**
 * Cache an AI script for a template ID.
 * Used when loading templates.
 */
export function cacheAIScript(templateId: string, script: string): void {
	mobAIScripts.set(templateId, script);
}

/**
 * Get a cached AI script for a template ID.
 */
export function getCachedAIScript(templateId: string): string | undefined {
	return mobAIScripts.get(templateId);
}
