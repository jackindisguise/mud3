/**
 * Package: archetype - YAML loader for race and class archetypes.
 *
 * Loads archetype definitions from `data/races` and `data/classes`, normalizes
 * them into immutable archetype definitions, and registers them in runtime
 * registries with default fallbacks.
 *
 * Registry helpers exported from this module are used by gameplay systems to
 * look up archetypes at runtime (e.g., mob deserialization).
 *
 * @module package/archetype
 */
import { extname, join, relative } from "path";
import { mkdir, readdir, readFile } from "fs/promises";
import YAML from "js-yaml";
import { Package } from "package-loader";
import logger from "../logger.js";
import {
	BaseArchetypeDefinition,
	Class,
	GrowthModifierCurve,
	Race,
	ArchetypeSkillDefinition,
	freezeArchetype,
} from "../archetype.js";
import { PrimaryAttributeSet, ResourceCapacities } from "../mob.js";

const DATA_DIRECTORY = join(process.cwd(), "data");
const RACES_DIRECTORY = join(DATA_DIRECTORY, "races");
const CLASSES_DIRECTORY = join(DATA_DIRECTORY, "classes");
const VALID_EXTENSIONS = new Set([".yaml", ".yml"]);

type ArchetypeType = "race" | "class";

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
		isDefault?: unknown;
	};
};

const raceRegistry: Map<string, Race> = new Map();
const classRegistry: Map<string, Class> = new Map();

const FALLBACK_RACE: Race = freezeArchetype({
	id: "__fallback_race__",
	name: "Fallback Race",
	description:
		"Internal fallback race used when no race archetypes have been loaded.",
	startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
	attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
	startingResourceCaps: { maxHealth: 1, maxMana: 1 },
	resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
	skills: [],
	passives: [],
	growthModifier: { base: 1 },
});

const FALLBACK_CLASS: Class = freezeArchetype({
	id: "__fallback_class__",
	name: "Fallback Class",
	description:
		"Internal fallback class used when no class archetypes have been loaded.",
	startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
	attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
	startingResourceCaps: { maxHealth: 1, maxMana: 1 },
	resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
	skills: [],
	passives: [],
	growthModifier: { base: 1 },
});

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
					process.cwd(),
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
					process.cwd(),
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
		};

		return { type, definition };
	} catch (error) {
		logger.error(
			`Failed to parse archetype file ${relative(
				process.cwd(),
				filePath
			)}: ${error}`
		);
		return undefined;
	}
}

function registerArchetype(
	type: ArchetypeType,
	definition: BaseArchetypeDefinition
): Readonly<BaseArchetypeDefinition> {
	const frozen = freezeArchetype(definition);
	const registry = type === "race" ? raceRegistry : classRegistry;
	const previous = registry.get(frozen.id);
	if (previous) {
		logger.warn(`Overriding existing ${type} archetype with id "${frozen.id}"`);
	}
	registry.set(frozen.id, frozen);
	return frozen;
}

function getRegistry(
	type: ArchetypeType
): Map<string, Readonly<BaseArchetypeDefinition>> {
	return type === "race" ? raceRegistry : classRegistry;
}

async function loadDirectory(
	directory: string,
	type: ArchetypeType
): Promise<number> {
	const entries = await readdir(directory, { withFileTypes: true });
	let count = 0;

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!shouldProcessFile(entry.name)) continue;

		const filePath = join(directory, entry.name);
		const raw = await readFile(filePath, "utf-8");
		const parsed = parseArchetypeFile(raw, filePath, type);
		if (!parsed) continue;

		registerArchetype(type, parsed.definition);
		count++;
	}

	return count;
}

function logSummary(): void {
	const raceCount = raceRegistry.size;
	const classCount = classRegistry.size;
	logger.info(
		`Loaded ${raceCount} race archetype(s) and ${classCount} class archetype(s).`
	);
}

function resolveArchetype(
	type: ArchetypeType,
	id: string
): Race | Class | undefined {
	const registry = getRegistry(type);
	const archetype = registry.get(id);
	if (!archetype) {
		logger.warn(
			`Requested ${type} '${id}' not found. Falling back to default.`
		);
		return;
	}
	return archetype;
}

export function getRaceById(id: string): Race | undefined {
	return resolveArchetype("race", id);
}

export function getClassById(id: string): Class | undefined {
	return resolveArchetype("class", id);
}

export function getAllRaces(): ReadonlyArray<Race> {
	return Array.from(raceRegistry.values());
}

export function getAllClasses(): ReadonlyArray<Class> {
	return Array.from(classRegistry.values());
}

export function getDefaultRace(): Race {
	const firstRace = getAllRaces()[0];
	return firstRace ?? FALLBACK_RACE;
}

export function getDefaultClass(): Class {
	const firstClass = getAllClasses()[0];
	return firstClass ?? FALLBACK_CLASS;
}

export function registerRace(
	definition: BaseArchetypeDefinition,
	options: { isDefault?: boolean } = {}
): Race {
	const result = registerArchetype("race", definition);
	return result as Race;
}

export function registerClass(
	definition: BaseArchetypeDefinition,
	options: { isDefault?: boolean } = {}
): Class {
	const result = registerArchetype("class", definition);
	return result as Class;
}

export default {
	name: "archetype",
	loader: async () => {
		logger.info("================================================");
		logger.info("Loading archetype definitions...");

		const raceCount = await loadDirectory(RACES_DIRECTORY, "race");
		const classCount = await loadDirectory(CLASSES_DIRECTORY, "class");

		if (raceCount === 0) {
			logger.warn(
				`No race archetypes found in ${relative(
					process.cwd(),
					RACES_DIRECTORY
				)}`
			);
			throw new Error("No race archetypes found");
		}

		if (classCount === 0) {
			logger.warn(
				`No class archetypes found in ${relative(
					process.cwd(),
					CLASSES_DIRECTORY
				)}`
			);
			throw new Error("No class archetypes found");
		}

		logSummary();
		logger.info("================================================");
	},
} as Package;
