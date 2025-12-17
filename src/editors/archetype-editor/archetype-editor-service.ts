import {
	access,
	mkdir,
	readFile,
	readdir,
	rename,
	unlink,
	writeFile,
} from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import { join, extname, dirname } from "path";
import YAML from "js-yaml";
import logger from "../../utils/logger.js";
import { getSafeRootDirectory } from "../../utils/path.js";
import { getAllEffectTemplates } from "../../registry/effect.js";

export interface ArchetypeListResponse {
	archetypes: string[];
}

export interface ArchetypeResponse {
	id: string;
	yaml: string;
}

export interface CreateArchetypePayload {
	id: string;
	type: "race" | "job";
	yaml: string;
}

export interface UpdateArchetypePayload {
	id: string;
	type: "race" | "job";
	yaml: string;
}

export interface ArchetypeEditorServiceConfig {
	racesDir?: string;
	jobsDir?: string;
}

export class ArchetypeEditorService {
	private readonly racesDir: string;
	private readonly jobsDir: string;
	private readonly validExtensions = new Set([".yaml", ".yml"]);

	constructor(config: ArchetypeEditorServiceConfig = {}) {
		const rootDir = getSafeRootDirectory();
		const dataDir = join(rootDir, "data");
		this.racesDir = config.racesDir ?? join(dataDir, "races");
		this.jobsDir = config.jobsDir ?? join(dataDir, "jobs");
	}

	public async listArchetypes(
		type: "race" | "job"
	): Promise<ArchetypeListResponse> {
		const dir = type === "race" ? this.racesDir : this.jobsDir;
		try {
			const files = await readdir(dir);
			const ids = files
				.filter((file) => this.validExtensions.has(extname(file)))
				.map((file) => file.replace(/\.(yaml|yml)$/, ""))
				.sort();
			return { archetypes: ids };
		} catch (error) {
			logger.error(`Failed to list ${type}s: ${error}`);
			return { archetypes: [] };
		}
	}

	public async getArchetype(
		id: string,
		type: "race" | "job"
	): Promise<ArchetypeResponse> {
		const filePath = this.getArchetypeFilePath(id, type);
		const yamlContent = await readFile(filePath, "utf-8");
		return { id, yaml: yamlContent };
	}

	public async createArchetype(
		payload: CreateArchetypePayload
	): Promise<{ id: string; success: true }> {
		if (!payload.yaml) {
			throw new Error("YAML data is required for archetype creation");
		}

		const filePath = this.getArchetypeFilePath(payload.id, payload.type);
		await this.ensureArchetypeDoesNotExist(filePath);
		await this.writeArchetypeFile(filePath, payload.yaml);
		logger.debug(`Created ${payload.type} YAML: ${payload.id}`);
		return { id: payload.id, success: true };
	}

	public async updateArchetype(
		payload: UpdateArchetypePayload
	): Promise<{ success: true }> {
		if (!payload.yaml) {
			throw new Error("YAML data is required for updates");
		}
		const filePath = this.getArchetypeFilePath(payload.id, payload.type);
		await this.writeArchetypeFile(filePath, payload.yaml);
		logger.debug(`Saved ${payload.type} YAML: ${payload.id}`);
		return { success: true };
	}

	public async deleteArchetype(
		id: string,
		type: "race" | "job"
	): Promise<{ success: true }> {
		const filePath = this.getArchetypeFilePath(id, type);
		try {
			await unlink(filePath);
			logger.debug(`Deleted ${type} YAML: ${id}`);
			return { success: true };
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") {
				throw new Error(`${type} not found`);
			}
			throw error;
		}
	}

	private getArchetypeFilePath(id: string, type: "race" | "job"): string {
		const dir = type === "race" ? this.racesDir : this.jobsDir;
		return join(dir, `${id}.yaml`);
	}

	private async ensureArchetypeDoesNotExist(filePath: string): Promise<void> {
		try {
			await access(filePath, FS_CONSTANTS.F_OK);
			throw new Error("Archetype already exists");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return;
			}
			throw error;
		}
	}

	private async writeArchetypeFile(
		filePath: string,
		content: string
	): Promise<void> {
		const tempPath = `${filePath}.tmp`;
		const dir = dirname(filePath);
		await mkdir(dir, { recursive: true });
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

	public async getAbilities(): Promise<Array<{ id: string; name: string }>> {
		try {
			// Import dynamically to ensure we get the latest registry state
			const { getAllAbilities } = await import("../../registry/ability.js");
			const abilities = getAllAbilities();
			logger.debug(`getAbilities: found ${abilities.length} abilities`);
			if (abilities.length === 0) {
				logger.warn(
					"getAbilities: ability registry is empty. Make sure ability package has been loaded."
				);
			}
			return abilities.map((ability) => ({
				id: ability.id,
				name: ability.name,
			}));
		} catch (error) {
			logger.error(`Failed to get abilities: ${error}`);
			return [];
		}
	}

	public getPassives(): Array<{ id: string; name: string }> {
		try {
			return getAllEffectTemplates()
				.filter((effect) => effect.type === "passive")
				.map((effect) => ({
					id: effect.id,
					name: effect.name,
				}));
		} catch (error) {
			logger.error(`Failed to get passives: ${error}`);
			return [];
		}
	}
}

export function createArchetypeEditorService(
	config?: ArchetypeEditorServiceConfig
): ArchetypeEditorService {
	return new ArchetypeEditorService(config);
}
