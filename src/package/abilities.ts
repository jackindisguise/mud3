/**
 * Package: abilities - dynamic ability loader
 *
 * Loads ability modules from compiled TypeScript files at startup:
 * - `dist/src/abilities` (compiled TypeScript abilities from `src/abilities`)
 *
 * Each ability file should export:
 * - `ABILITY_ID: string` - unique identifier for the ability
 * - `ability: Ability` - the ability definition object
 * - `command?: CommandObject` - optional command object to register
 *
 * Files beginning with `_` are ignored. Only `.js` files are loaded (compiled from TypeScript).
 * The loader validates that all ability IDs are unique and registers
 * commands from abilities into `CommandRegistry.default`.
 *
 * @example
 * // src/abilities/whirlwind.ts
 * export const ABILITY_ID = "whirlwind";
 * export const ability: Ability = {
 *   id: "whirlwind",
 *   name: "Whirlwind",
 *   description: "A spinning attack that hits all nearby enemies."
 * };
 * export const command: CommandObject = {
 *   pattern: "whirlwind",
 *   execute(ctx, args) {
 *     const mob = ctx.actor;
 *     if (!mob || !mob.knowsAbility("whirlwind")) {
 *       mob.sendMessage("You don't know that ability.", MESSAGE_GROUP.COMMAND_RESPONSE);
 *       return;
 *     }
 *     // Execute whirlwind ability...
 *   }
 * };
 *
 * @module package/abilities
 */
import { CommandRegistry, AbilityCommand } from "../command.js";
import type { CommandObject } from "./commands.js";
import { Package } from "package-loader";
import { readdir } from "fs/promises";
import { join, relative } from "path";
import { pathToFileURL } from "url";
import logger from "../logger.js";
import { Ability, generateProficiencyTable } from "../ability.js";
import { getSafeRootDirectory } from "../utils/path.js";
import { access, constants } from "fs/promises";

/** Registry of all loaded abilities by ID */
const ABILITY_REGISTRY = new Map<string, Ability>();

/**
 * Gets an ability by its ID.
 * @param id The ability ID to look up
 * @returns The ability or undefined if not found
 */
export function getAbilityById(id: string): Ability | undefined {
	return ABILITY_REGISTRY.get(id);
}

/**
 * Gets all registered abilities.
 * @returns Array of all abilities
 */
export function getAllAbilities(): Ability[] {
	return Array.from(ABILITY_REGISTRY.values());
}

/**
 * Checks if an ability ID is already registered.
 * @param id The ability ID to check
 * @returns true if the ability ID is already registered
 */
export function hasAbility(id: string): boolean {
	return ABILITY_REGISTRY.has(id);
}

/** Directory for compiled TypeScript abilities */
const ROOT_DIRECTORY = getSafeRootDirectory();
const SRC_ABILITY_DIRECTORY = join(ROOT_DIRECTORY, "dist", "src", "abilities");

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function loadAbilities() {
	const directories = [SRC_ABILITY_DIRECTORY];
	let totalCommandsRegistered = 0;
	for (const abilityDir of directories) {
		if (!(await fileExists(abilityDir))) continue;
		logger.info(
			`Loading abilities from ${relative(ROOT_DIRECTORY, abilityDir)}`
		);
		try {
			const files = await readdir(abilityDir);
			logger.debug(
				`Found ${files.length} files in ${relative(ROOT_DIRECTORY, abilityDir)}`
			);

			// Filter for JavaScript files
			const jsFiles = files.filter(
				(file) => file.endsWith(".js") && !file.startsWith("_")
			);
			logger.debug(
				`Found ${jsFiles.length} JavaScript ability files in ${relative(
					ROOT_DIRECTORY,
					abilityDir
				)}`
			);

			// Load JavaScript abilities
			for (const file of jsFiles) {
				try {
					const filePath = join(abilityDir, file);
					logger.debug(
						`Processing ability file: ${relative(ROOT_DIRECTORY, filePath)}`
					);
					const fileUrl = pathToFileURL(filePath).href;
					const abilityModule = await import(fileUrl);

					// Check for required exports
					if (!abilityModule.ABILITY_ID) {
						logger.warn(
							`Ability file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} is missing ABILITY_ID export`
						);
						continue;
					}

					const abilityId = abilityModule.ABILITY_ID;
					if (typeof abilityId !== "string") {
						logger.warn(
							`Ability file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} has invalid ABILITY_ID (must be string)`
						);
						continue;
					}

					// Check for duplicate ability IDs
					if (ABILITY_REGISTRY.has(abilityId)) {
						logger.error(
							`Duplicate ability ID "${abilityId}" found in ${relative(
								ROOT_DIRECTORY,
								filePath
							)}. Ability IDs must be unique.`
						);
						continue;
					}

					// Load ability definition
					if (!abilityModule.ability) {
						logger.warn(
							`Ability file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} is missing ability export`
						);
						continue;
					}

					const ability: Ability = abilityModule.ability;
					if (!ability.id || !ability.name || !ability.description) {
						logger.warn(
							`Ability file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} has invalid ability object (missing id, name, or description)`
						);
						continue;
					}

					// Validate proficiencyCurve is provided
					if (!ability.proficiencyCurve) {
						logger.warn(
							`Ability file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} is missing required proficiencyCurve`
						);
						continue;
					}

					// Ensure ability.id matches ABILITY_ID
					if (ability.id !== abilityId) {
						logger.warn(
							`Ability ID mismatch in ${relative(
								ROOT_DIRECTORY,
								filePath
							)}: ability.id (${
								ability.id
							}) does not match ABILITY_ID (${abilityId}). Using ABILITY_ID.`
						);
						ability.id = abilityId;
					}

					// Always generate proficiency table at runtime (ignore any supplied table)
					ability.proficiencyTable = generateProficiencyTable(ability);

					// Register the ability
					ABILITY_REGISTRY.set(abilityId, ability);
					logger.debug(
						`Loaded ability "${abilityId}" (${ability.name}) from ${relative(
							ROOT_DIRECTORY,
							filePath
						)}`
					);

					// Load command if provided (named export)
					const commandObj = abilityModule.command;
					if (commandObj && commandObj.pattern && commandObj.execute) {
						logger.debug(
							`Found command export for ability "${abilityId}" with pattern "${commandObj.pattern}"`
						);
						const command = new AbilityCommand(abilityId, commandObj);
						CommandRegistry.default.register(command);
						totalCommandsRegistered++;
						logger.debug(
							`Registered ability command "${commandObj.pattern}" for ability "${abilityId}"`
						);
						if (commandObj.aliases) {
							logger.debug(`  Aliases: ${commandObj.aliases.join(", ")}`);
						}
						if (commandObj.priority !== undefined) {
							logger.debug(`  Priority: ${commandObj.priority}`);
						}
						if (commandObj.cooldown !== undefined) {
							logger.debug(
								`  Cooldown: ${
									typeof commandObj.cooldown === "number"
										? `${commandObj.cooldown}ms`
										: "dynamic"
								}`
							);
						}
					} else {
						logger.debug(
							`Ability "${abilityId}" has no command export (ability-only, no command)`
						);
					}
				} catch (error) {
					logger.error(
						`Failed to load ability from ${relative(
							ROOT_DIRECTORY,
							join(abilityDir, file)
						)}: ${error}`
					);
				}
			}
		} catch (error) {
			logger.warn(
				`Failed to read abilities directory ${relative(
					ROOT_DIRECTORY,
					abilityDir
				)}: ${error}`
			);
		}
	}

	logger.info(
		`Ability loading complete. Total abilities registered: ${ABILITY_REGISTRY.size}, commands registered: ${totalCommandsRegistered}`
	);
	if (totalCommandsRegistered > 0) {
		logger.debug(
			`All ${totalCommandsRegistered} ability command(s) are registered with ability ID checks enabled`
		);
	}
}

export default {
	name: "abilities",
	loader: async () => {
		await logger.block("abilities", async () => {
			await loadAbilities();
		});
	},
} as Package;
