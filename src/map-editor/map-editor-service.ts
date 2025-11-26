import {
	access,
	mkdir,
	readFile,
	rename,
	unlink,
	writeFile,
} from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import { join } from "path";
import YAML from "js-yaml";
import {
	getAllDungeonIds,
	SerializedDungeonFormat,
} from "../package/dungeon.js";
import {
	getAllJobs,
	getAllRaces,
	getJobById,
	getRaceById,
} from "../registry/archetype.js";
import { Mob, WEAPON_TYPES } from "../dungeon.js";
import { createMob } from "../package/dungeon.js";
import {
	COMMON_HIT_TYPES,
	MAGICAL_DAMAGE_TYPE,
	PHYSICAL_DAMAGE_TYPE,
} from "../damage-types.js";
import logger from "../logger.js";
import { getSafeRootDirectory } from "../utils/path.js";

export interface DungeonListResponse {
	dungeons: string[];
}

export interface DungeonResponse {
	id: string;
	dimensions: SerializedDungeonFormat["dungeon"]["dimensions"];
	resetMessage?: string;
	name?: string;
	description?: string;
	yaml: string;
}

export interface CreateDungeonPayload {
	id: string;
	yaml: string;
}

export interface UpdateDungeonPayload {
	id: string;
	yaml: string;
}

export interface HitTypesResponse {
	hitTypes: Record<
		string,
		{
			verb: string;
			verbThirdPerson?: string;
			damageType: string;
			color?: number;
		}
	>;
	physicalDamageTypes: typeof PHYSICAL_DAMAGE_TYPE;
	magicalDamageTypes: typeof MAGICAL_DAMAGE_TYPE;
}

export interface RacesResponse {
	races: Array<{ id: string; display: string }>;
}

export interface JobsResponse {
	jobs: Array<{ id: string; display: string }>;
}

export interface CalculateAttributesPayload {
	raceId: string;
	jobId: string;
	level: number;
}

export interface CalculateAttributesResponse {
	primary: Mob["primaryAttributes"];
	secondary: Mob["secondaryAttributes"];
	resourceCaps: { maxHealth: number; maxMana: number };
}

export interface MapEditorServiceConfig {
	dungeonDir?: string;
}

export class MapEditorService {
	private readonly dungeonDir: string;

	constructor(config: MapEditorServiceConfig = {}) {
		this.dungeonDir =
			config.dungeonDir ?? join(getSafeRootDirectory(), "data", "dungeons");
	}

	public async listDungeons(): Promise<DungeonListResponse> {
		const ids = await getAllDungeonIds();
		return { dungeons: ids };
	}

	public async getDungeon(id: string): Promise<DungeonResponse> {
		const filePath = this.getDungeonFilePath(id);
		const yamlContent = await readFile(filePath, "utf-8");
		const data = YAML.load(yamlContent) as SerializedDungeonFormat;

		if (!data?.dungeon) {
			throw new Error("Invalid dungeon format");
		}

		return {
			id: data.dungeon.id || id,
			dimensions: data.dungeon.dimensions,
			resetMessage: data.dungeon.resetMessage,
			name: data.dungeon.name,
			description: data.dungeon.description,
			yaml: yamlContent,
		};
	}

	public async createDungeon(payload: CreateDungeonPayload): Promise<{
		id: string;
		success: true;
	}> {
		if (!payload.yaml) {
			throw new Error("YAML data is required for dungeon creation");
		}

		const filePath = this.getDungeonFilePath(payload.id);
		await this.ensureDungeonDoesNotExist(filePath);
		await this.writeDungeonFile(filePath, payload.yaml);
		logger.debug(`Created dungeon YAML: ${payload.id}`);
		return { id: payload.id, success: true };
	}

	public async updateDungeon(payload: UpdateDungeonPayload): Promise<{
		success: true;
	}> {
		if (!payload.yaml) {
			throw new Error("YAML data is required for updates");
		}
		const filePath = this.getDungeonFilePath(payload.id);
		await this.writeDungeonFile(filePath, payload.yaml);
		logger.debug(`Saved dungeon YAML: ${payload.id}`);
		return { success: true };
	}

	public async getRaces(): Promise<RacesResponse> {
		const races = getAllRaces();
		return {
			races: races.map((race) => ({
				id: race.id,
				display: race.name,
			})),
		};
	}

	public async getJobs(): Promise<JobsResponse> {
		const jobs = getAllJobs();
		return {
			jobs: jobs.map((job) => ({
				id: job.id,
				display: job.name,
			})),
		};
	}

	public async calculateAttributes(
		payload: CalculateAttributesPayload
	): Promise<CalculateAttributesResponse> {
		const { raceId, jobId, level } = payload;

		if (!raceId || !jobId || level === undefined) {
			throw new Error("raceId, jobId, and level are required");
		}

		const race = getRaceById(raceId);
		const job = getJobById(jobId);

		if (!race || !job) {
			throw new Error("Invalid race or job ID");
		}

		const mob = createMob({
			race,
			job,
			level: Number.isFinite(level) ? level : 1,
		});

		return {
			primary: mob.primaryAttributes,
			secondary: mob.secondaryAttributes,
			resourceCaps: {
				maxHealth: mob.maxHealth,
				maxMana: mob.maxMana,
			},
		};
	}

	public async getHitTypes(): Promise<HitTypesResponse> {
		const hitTypes: HitTypesResponse["hitTypes"] = {};
		for (const [key, hitType] of COMMON_HIT_TYPES) {
			hitTypes[key] = {
				verb: hitType.verb,
				verbThirdPerson: hitType.verbThirdPerson,
				damageType: hitType.damageType,
				color: hitType.color,
			};
		}
		return {
			hitTypes,
			physicalDamageTypes: PHYSICAL_DAMAGE_TYPE,
			magicalDamageTypes: MAGICAL_DAMAGE_TYPE,
		};
	}

	public async getWeaponTypes(): Promise<{ weaponTypes: string[] }> {
		return {
			weaponTypes: [...WEAPON_TYPES],
		};
	}

	private getDungeonFilePath(id: string): string {
		return join(this.dungeonDir, `${id}.yaml`);
	}

	private async ensureDungeonDoesNotExist(filePath: string): Promise<void> {
		try {
			await access(filePath, FS_CONSTANTS.F_OK);
			throw new Error("Dungeon already exists");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return;
			}
			throw error;
		}
	}

	private async writeDungeonFile(
		filePath: string,
		content: string
	): Promise<void> {
		const tempPath = `${filePath}.tmp`;
		await mkdir(this.dungeonDir, { recursive: true });
		try {
			await writeFile(tempPath, content, "utf-8");
			await rename(tempPath, filePath);
		} catch (error) {
			try {
				await unlink(tempPath);
			} catch {
				// ignore cleanup errors
			}
			throw error;
		}
	}
}

export function createMapEditorService(
	config?: MapEditorServiceConfig
): MapEditorService {
	return new MapEditorService(config);
}
