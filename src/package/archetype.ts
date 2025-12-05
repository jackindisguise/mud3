/**
 * Package: archetype - YAML loader for race and job archetypes.
 *
 * Loads archetype definitions from `data/races` and `data/jobs`, normalizes
 * them into immutable archetype definitions, and registers them in the global
 * archetype registry.
 *
 * Registry helpers are exported from `src/registry/archetype.ts` and are used
 * by gameplay systems to look up archetypes at runtime (e.g., mob deserialization).
 *
 * @module package/archetype
 */
import { extname, join, relative } from "path";
import { readdir, readFile } from "fs/promises";
import YAML from "js-yaml";
import { Package } from "package-loader";
import logger from "../logger.js";
import { getSafeRootDirectory } from "../utils/path.js";
import {
	BaseArchetypeDefinition,
	GrowthModifierCurve,
	ArchetypeSkillDefinition,
} from "../core/archetype.js";
import { PrimaryAttributeSet, ResourceCapacities } from "../core/attribute.js";
import {
	DamageTypeRelationships,
	DAMAGE_RELATIONSHIP,
	PHYSICAL_DAMAGE_TYPE,
	MAGICAL_DAMAGE_TYPE,
	DAMAGE_TYPE,
} from "../core/damage-types.js";
import {
	registerRace,
	registerJob,
	getRaceCount,
	getJobCount,
} from "../registry/archetype.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const RACES_DIRECTORY = join(DATA_DIRECTORY, "races");
const JOBS_DIRECTORY = join(DATA_DIRECTORY, "jobs");
const VALID_EXTENSIONS = new Set([".yaml", ".yml"]);

type ArchetypeType = "race" | "job";

interface RawArchetypeSkill {
	id: string;
	level?: number;
}

interface ParsedArchetypeFile {
	type: ArchetypeType;
	definition: BaseArchetypeDefinition;
}

type RawArchetypeFile = {
	archetype?: {
		id?: unknown;
		type?: unknown;
		name?: unknown;
		description?: unknown;
		startingAttributes?: Partial<Record<keyof PrimaryAttributeSet, unknown>>;
		attributeGrowthPerLevel?: Partial<
			Record<keyof PrimaryAttributeSet, unknown>
		>;
		startingResourceCaps?: Partial<Record<keyof ResourceCapacities, unknown>>;
		resourceGrowthPerLevel?: Partial<Record<keyof ResourceCapacities, unknown>>;
		skills?: Array<unknown>;
		passives?: Array<unknown>;
		growthModifier?: Partial<Record<keyof GrowthModifierCurve, unknown>>;
		damageRelationships?: Record<keyof DAMAGE_TYPE, unknown>;
		isStarter?: unknown;
	};
};

function shouldProcessFile(fileName: string): boolean {
	if (!fileName) return false;
	if (fileName.startsWith("_")) return false;
	return VALID_EXTENSIONS.has(extname(fileName).toLowerCase());
}

function coerceNumber(value: unknown, fallback = 0): number {
	const result = Number(value);
	return Number.isFinite(result) ? result : fallback;
}

function normalizePrimary(
	source?: Partial<PrimaryAttributeSet>
): PrimaryAttributeSet {
	return {
		strength: coerceNumber(source?.strength),
		agility: coerceNumber(source?.agility),
		intelligence: coerceNumber(source?.intelligence),
	};
}

function normalizeResourceCaps(
	source?: Partial<ResourceCapacities>
): ResourceCapacities {
	return {
		maxHealth: coerceNumber(source?.maxHealth),
		maxMana: coerceNumber(source?.maxMana),
	};
}

function normalizeGrowthModifier(
	source?: Partial<GrowthModifierCurve>
): GrowthModifierCurve {
	const base = coerceNumber(source?.base, 1);
	const perLevel =
		source?.perLevel !== undefined ? coerceNumber(source.perLevel) : undefined;
	return {
		base: base > 0 ? base : 1,
		...(perLevel !== undefined ? { perLevel } : {}),
	};
}

function normalizeSkills(raw?: Array<unknown>): ArchetypeSkillDefinition[] {
	if (!raw || raw.length === 0) return [];
	const result: ArchetypeSkillDefinition[] = [];
	for (const entry of raw) {
		if (typeof entry === "string") {
			const trimmed = entry.trim();
			if (trimmed.length === 0) continue;
			result.push({ id: trimmed, level: 1 });
		} else if (entry && typeof entry === "object") {
			const candidate = entry as RawArchetypeSkill;
			if (!candidate.id) continue;
			const id = String(candidate.id).trim();
			if (!id) continue;
			const level = Math.max(1, Math.floor(coerceNumber(candidate.level, 1)));
			result.push({ id, level });
		}
	}
	return result;
}

function normalizePassives(raw?: Array<unknown>): string[] {
	if (!raw || raw.length === 0) return [];
	return raw
		.map((entry) => String(entry ?? "").trim())
		.filter((value) => value.length > 0);
}

function normalizeDamageRelationships(
	raw?: Record<string, unknown>
): DamageTypeRelationships | undefined {
	if (!raw || typeof raw !== "object") return undefined;

	const result: DamageTypeRelationships = {};
	const validTypes = new Set<DAMAGE_TYPE>([
		...Object.values(PHYSICAL_DAMAGE_TYPE),
		...Object.values(MAGICAL_DAMAGE_TYPE),
	]);
	const validRelationships = new Set<DAMAGE_RELATIONSHIP>(
		Object.values(DAMAGE_RELATIONSHIP)
	);

	for (const [key, value] of Object.entries(raw)) {
		const upperKey = key.toUpperCase();
		if (!validTypes.has(upperKey as DAMAGE_TYPE)) {
			logger.warn(
				`Unknown damage type in damageRelationships: ${key}. Skipping.`
			);
			continue;
		}

		const upperValue = String(value ?? "").toUpperCase();
		if (!validRelationships.has(upperValue as DAMAGE_RELATIONSHIP)) {
			logger.warn(
				`Invalid damage relationship for ${key}: ${value}. Must be RESIST, IMMUNE, or VULNERABLE. Skipping.`
			);
			continue;
		}

		result[upperKey as DAMAGE_TYPE] = upperValue as DAMAGE_RELATIONSHIP;
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

function parseArchetypeFile(
	raw: string,
	filePath: string,
	type: ArchetypeType
): ParsedArchetypeFile | undefined {
	try {
		const data = YAML.load(raw) as RawArchetypeFile;
		const archetype = data?.archetype;
		if (!archetype) {
			logger.warn(
				`Skipping archetype file without 'archetype' root: ${relative(
					ROOT_DIRECTORY,
					filePath
				)}`
			);
			return undefined;
		}

		const id = String(archetype.id ?? "").trim();
		const name = String(archetype.name ?? "").trim();
		if (!id || !name) {
			logger.warn(
				`Skipping archetype missing required fields (id, name): ${relative(
					ROOT_DIRECTORY,
					filePath
				)}`
			);
			return undefined;
		}

		const definition: BaseArchetypeDefinition = {
			id,
			name,
			description:
				typeof archetype.description === "string"
					? archetype.description.trim()
					: undefined,
			isStarter: archetype.isStarter === true,
			startingAttributes: normalizePrimary(
				(archetype.startingAttributes ?? {}) as Partial<PrimaryAttributeSet>
			),
			attributeGrowthPerLevel: normalizePrimary(
				(archetype.attributeGrowthPerLevel ??
					{}) as Partial<PrimaryAttributeSet>
			),
			startingResourceCaps: normalizeResourceCaps(
				(archetype.startingResourceCaps ?? {}) as Partial<ResourceCapacities>
			),
			resourceGrowthPerLevel: normalizeResourceCaps(
				(archetype.resourceGrowthPerLevel ?? {}) as Partial<ResourceCapacities>
			),
			skills: normalizeSkills(archetype.skills),
			passives: normalizePassives(archetype.passives),
			growthModifier: normalizeGrowthModifier(
				(archetype.growthModifier ?? {}) as Partial<GrowthModifierCurve>
			),
			damageRelationships: normalizeDamageRelationships(
				archetype.damageRelationships as Record<string, unknown> | undefined
			),
		};

		return { type, definition };
	} catch (error) {
		logger.error(
			`Failed to parse archetype file ${relative(
				ROOT_DIRECTORY,
				filePath
			)}: ${error}`
		);
		return undefined;
	}
}

async function loadDirectory(
	directory: string,
	type: ArchetypeType
): Promise<number> {
	const entries = await readdir(directory, { withFileTypes: true });
	let count = 0;
	logger.debug(
		`Loading archetypes from ${relative(ROOT_DIRECTORY, directory)}...`
	);

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!shouldProcessFile(entry.name)) continue;

		const filePath = join(directory, entry.name);
		const raw = await readFile(filePath, "utf-8");
		const parsed = parseArchetypeFile(raw, filePath, type);
		if (!parsed) continue;

		if (type === "race") {
			const registered = registerRace(parsed.definition);
			logger.debug(
				`Loaded and registered race: ${registered.id} (${registered.name})`,
				{
					id: registered.id,
					name: registered.name,
					filePath: relative(ROOT_DIRECTORY, filePath),
					type: "race",
				}
			);
		} else {
			const registered = registerJob(parsed.definition);
			logger.debug(
				`Loaded and registered job: ${registered.id} (${registered.name})`,
				{
					id: registered.id,
					name: registered.name,
					filePath: relative(ROOT_DIRECTORY, filePath),
					type: "job",
				}
			);
		}
		count++;
	}

	return count;
}

function logSummary(): void {
	const raceCount = getRaceCount();
	const jobCount = getJobCount();
	logger.info(
		`Loaded ${raceCount} race archetype(s) and ${jobCount} job archetype(s).`
	);
}

export default {
	name: "archetype",
	loader: async () => {
		logger.debug("Loading races...");
		await logger.block("races", async () => {
			const raceCount = await loadDirectory(RACES_DIRECTORY, "race");
			if (raceCount === 0) {
				logger.warn(
					`No race archetypes found in ${relative(
						ROOT_DIRECTORY,
						RACES_DIRECTORY
					)}`
				);
				throw new Error("No race archetypes found");
			}
		});
		logger.debug("Loading jobs...");
		await logger.block("jobs", async () => {
			const jobCount = await loadDirectory(JOBS_DIRECTORY, "job");
			if (jobCount === 0) {
				logger.warn(
					`No job archetypes found in ${relative(
						ROOT_DIRECTORY,
						JOBS_DIRECTORY
					)}`
				);
				throw new Error("No job archetypes found");
			}
		});

		logSummary();
	},
} as Package;
