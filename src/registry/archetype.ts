/**
 * Registry: archetype - centralized race and job access
 *
 * Provides a centralized location for accessing registered races and jobs.
 * The registries are populated by the archetype package.
 *
 * @module registry/archetype
 */

import logger from "../logger.js";
import {
	Race,
	Job,
	BaseArchetypeDefinition,
	freezeArchetype,
} from "../core/archetype.js";

export { READONLY_RACE_REGISTRY as RACE_REGISTRY };
export { READONLY_JOB_REGISTRY as JOB_REGISTRY };

/**
 * Global registry of loaded races.
 * Maps race IDs to their race definitions.
 */
const RACE_REGISTRY: Map<string, Race> = new Map();
const READONLY_RACE_REGISTRY: ReadonlyMap<string, Race> = RACE_REGISTRY;

/**
 * Global registry of loaded jobs.
 * Maps job IDs to their job definitions.
 */
const JOB_REGISTRY: Map<string, Job> = new Map();
const READONLY_JOB_REGISTRY: ReadonlyMap<string, Job> = JOB_REGISTRY;

/**
 * Register a race in the global registry.
 * @param definition The race definition to register
 * @returns The registered race
 */
export function registerRace(definition: BaseArchetypeDefinition): Race {
	const frozen = freezeArchetype(definition);
	const previous = RACE_REGISTRY.get(frozen.id);
	if (previous) {
		logger.warn(`Overriding existing race archetype with id "${frozen.id}"`);
	}
	RACE_REGISTRY.set(frozen.id, frozen);
	logger.debug(`Registered race: ${frozen.id} (${frozen.name})`);
	return frozen;
}

/**
 * Register a job in the global registry.
 * @param definition The job definition to register
 * @returns The registered job
 */
export function registerJob(definition: BaseArchetypeDefinition): Job {
	const frozen = freezeArchetype(definition);
	const previous = JOB_REGISTRY.get(frozen.id);
	if (previous) {
		logger.warn(`Overriding existing job archetype with id "${frozen.id}"`);
	}
	JOB_REGISTRY.set(frozen.id, frozen);
	logger.debug(`Registered job: ${frozen.id} (${frozen.name})`);
	return frozen;
}

/**
 * Get a race by its ID.
 * @param id The race ID to look up
 * @returns The race or undefined if not found
 */
export function getRaceById(id: string): Race | undefined {
	const race = RACE_REGISTRY.get(id);
	if (!race) {
		logger.warn(`Requested race '${id}' not found.`);
		return undefined;
	}
	return race;
}

/**
 * Get a job by its ID.
 * @param id The job ID to look up
 * @returns The job or undefined if not found
 */
export function getJobById(id: string): Job | undefined {
	const job = JOB_REGISTRY.get(id);
	if (!job) {
		logger.warn(`Requested job '${id}' not found.`);
		return undefined;
	}
	return job;
}

/**
 * Get all registered races.
 * @returns Array of all races
 */
export function getAllRaces(): ReadonlyArray<Race> {
	return Array.from(RACE_REGISTRY.values());
}

/**
 * Get all registered jobs.
 * @returns Array of all jobs
 */
export function getAllJobs(): ReadonlyArray<Job> {
	return Array.from(JOB_REGISTRY.values());
}

/**
 * Get all starter races (races marked as isStarter).
 * If no starter races are found, returns all races.
 * @returns Array of starter races or all races if none are marked as starter
 */
export function getStarterRaces(): ReadonlyArray<Race> {
	const starters = getAllRaces().filter((race) => race.isStarter);
	return starters.length > 0 ? starters : getAllRaces();
}

/**
 * Get all starter jobs (jobs marked as isStarter).
 * If no starter jobs are found, returns all jobs.
 * @returns Array of starter jobs or all jobs if none are marked as starter
 */
export function getStarterJobs(): ReadonlyArray<Job> {
	const starters = getAllJobs().filter((job) => job.isStarter);
	return starters.length > 0 ? starters : getAllJobs();
}

/**
 * Get the default race (first starter race, or first race if no starters).
 * @returns The default race
 * @throws Error if no races are available
 */
export function getDefaultRace(): Race {
	const starters = getStarterRaces();
	const firstRace = starters[0] ?? getAllRaces()[0];
	if (!firstRace) {
		throw new Error(
			"Cannot get default race: archetype package not loaded or no races available. Call archetypePkg.loader() first."
		);
	}
	return firstRace;
}

/**
 * Get the default job (first starter job, or first job if no starters).
 * @returns The default job
 * @throws Error if no jobs are available
 */
export function getDefaultJob(): Job {
	const starters = getStarterJobs();
	const firstJob = starters[0] ?? getAllJobs()[0];
	if (!firstJob) {
		throw new Error(
			"Cannot get default job: archetype package not loaded or no jobs available. Call archetypePkg.loader() first."
		);
	}
	return firstJob;
}

/**
 * Clear all registered races and jobs.
 * Primarily used for testing.
 */
export function clearArchetypes(): void {
	RACE_REGISTRY.clear();
	JOB_REGISTRY.clear();
	logger.debug("Cleared all archetypes");
}

/**
 * Get the total number of registered races.
 */
export function getRaceCount(): number {
	return RACE_REGISTRY.size;
}

/**
 * Get the total number of registered jobs.
 */
export function getJobCount(): number {
	return JOB_REGISTRY.size;
}
