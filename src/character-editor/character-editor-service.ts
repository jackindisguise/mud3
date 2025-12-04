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
import logger from "../logger.js";
import { getSafeRootDirectory } from "../utils/path.js";
import { getAllRaces, getAllJobs } from "../registry/archetype.js";
import {
	getDungeonById,
	getRegisteredDungeonIds,
} from "../registry/dungeon.js";
import {
	WEAPON_TYPES,
	compressSerializedObject,
	type SerializedDungeonObject,
	type AnySerializedDungeonObject,
} from "../core/dungeon.js";

export interface CharacterListResponse {
	characters: string[];
}

export interface CharacterResponse {
	id: string;
	yaml: string;
}

export interface CreateCharacterPayload {
	id: string;
	yaml: string;
}

export interface UpdateCharacterPayload {
	id: string;
	yaml: string;
}

export interface CharacterEditorServiceConfig {
	characterDir?: string;
}

export class CharacterEditorService {
	private readonly characterDir: string;
	private readonly validExtensions = new Set([".yaml", ".yml"]);

	constructor(config: CharacterEditorServiceConfig = {}) {
		const rootDir = getSafeRootDirectory();
		this.characterDir =
			config.characterDir || join(rootDir, "data", "characters");
	}

	async listCharacters(): Promise<CharacterListResponse> {
		try {
			await access(this.characterDir, FS_CONSTANTS.F_OK);
		} catch {
			await mkdir(this.characterDir, { recursive: true });
			return { characters: [] };
		}

		const files = await readdir(this.characterDir);
		const characters = files
			.filter((file) => {
				const ext = extname(file).toLowerCase();
				return this.validExtensions.has(ext);
			})
			.map((file) => {
				// Remove extension to get character ID (username)
				return file.replace(/\.(yaml|yml)$/i, "");
			})
			.filter((id) => id.length > 0)
			.sort();

		return { characters };
	}

	async getCharacter(id: string): Promise<CharacterResponse> {
		const filePath = this.getCharacterFilePath(id);
		await this.validateCharacterPath(filePath);

		const content = await readFile(filePath, "utf-8");
		return { id, yaml: content };
	}

	async createCharacter(payload: CreateCharacterPayload): Promise<void> {
		const { id, yaml } = payload;
		this.validateCharacterId(id);
		this.validateYaml(yaml);

		const filePath = this.getCharacterFilePath(id);

		// Check if character already exists
		try {
			await access(filePath, FS_CONSTANTS.F_OK);
			throw new Error(`Character '${id}' already exists`);
		} catch (error: any) {
			if (error.code === "ENOENT") {
				// File doesn't exist, which is what we want
			} else if (error.message?.includes("already exists")) {
				throw error;
			} else {
				// Some other error accessing the file
				throw error;
			}
		}

		// Compress contents before saving
		const compressedYaml = this.compressCharacterContents(yaml);

		await this.writeCharacterFile(filePath, compressedYaml);
		logger.info("Created character file", { id, filePath });
	}

	async updateCharacter(payload: UpdateCharacterPayload): Promise<void> {
		const { id, yaml } = payload;
		this.validateCharacterId(id);
		this.validateYaml(yaml);

		// Compress contents before saving
		const compressedYaml = this.compressCharacterContents(yaml);

		const filePath = this.getCharacterFilePath(id);
		await this.validateCharacterPath(filePath);

		await this.writeCharacterFile(filePath, compressedYaml);
		logger.info("Updated character file", { id, filePath });
	}

	private compressCharacterContents(yaml: string): string {
		try {
			const data = YAML.load(yaml) as any;
			if (data?.mob?.contents && Array.isArray(data.mob.contents)) {
				// Compress each content item recursively
				data.mob.contents = data.mob.contents.map(
					(content: AnySerializedDungeonObject) => {
						return this.compressContentItem(content);
					}
				);
			}
			return YAML.dump(data, { lineWidth: 120, noRefs: true });
		} catch (error) {
			logger.warn(
				"Failed to compress character contents, saving uncompressed",
				{
					error,
				}
			);
			// If compression fails, return original YAML
			return yaml;
		}
	}

	private compressContentItem(
		content: AnySerializedDungeonObject
	): SerializedDungeonObject {
		// Compress nested contents recursively
		if (content.contents && Array.isArray(content.contents)) {
			content.contents = content.contents.map(
				(nested: AnySerializedDungeonObject) => this.compressContentItem(nested)
			);
		}

		// Compress this item
		if (content.templateId) {
			return compressSerializedObject(
				content as SerializedDungeonObject,
				content.templateId
			);
		}
		// If no templateId, compress against type baseline
		return compressSerializedObject(content as SerializedDungeonObject);
	}

	async deleteCharacter(id: string): Promise<void> {
		const filePath = this.getCharacterFilePath(id);
		await this.validateCharacterPath(filePath);

		await unlink(filePath);
		logger.info("Deleted character file", { id, filePath });
	}

	private getCharacterFilePath(id: string): string {
		// Sanitize the ID to prevent directory traversal
		const safeId = id.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
		if (safeId !== id.toLowerCase()) {
			throw new Error(`Invalid character ID: ${id}`);
		}
		return join(this.characterDir, `${safeId}.yaml`);
	}

	private async validateCharacterPath(filePath: string): Promise<void> {
		// Ensure the file is within the character directory
		const resolvedPath = join(this.characterDir, dirname(join("/", filePath)));
		if (!resolvedPath.startsWith(this.characterDir)) {
			throw new Error("Invalid character path");
		}

		try {
			await access(filePath, FS_CONSTANTS.F_OK);
		} catch {
			throw new Error("Character file not found");
		}
	}

	private validateCharacterId(id: string): void {
		if (!id || typeof id !== "string") {
			throw new Error("Character ID is required");
		}

		// Character IDs should be lowercase alphanumeric with hyphens/underscores
		if (!/^[a-z0-9_-]+$/.test(id)) {
			throw new Error(
				"Character ID must contain only lowercase letters, numbers, hyphens, and underscores"
			);
		}
	}

	private validateYaml(yaml: string): void {
		if (!yaml || typeof yaml !== "string") {
			throw new Error("YAML content is required");
		}

		try {
			YAML.load(yaml);
		} catch (error: any) {
			throw new Error(`Invalid YAML: ${error.message}`);
		}
	}

	private async writeCharacterFile(
		filePath: string,
		yaml: string
	): Promise<void> {
		// Ensure directory exists
		await mkdir(dirname(filePath), { recursive: true });

		// Write to temporary file first, then rename atomically
		const tempPath = `${filePath}.tmp`;
		await writeFile(tempPath, yaml, "utf-8");

		try {
			await rename(tempPath, filePath);
		} catch (error) {
			// Clean up temp file on error
			try {
				await unlink(tempPath);
			} catch {
				// Ignore cleanup errors
			}
			throw error;
		}
	}

	public getRaces(): Array<{ id: string; display: string }> {
		try {
			const races = getAllRaces();
			return races.map((race) => ({
				id: race.id,
				display: race.name,
			}));
		} catch (error) {
			logger.error(`Failed to get races: ${error}`);
			return [];
		}
	}

	public getJobs(): Array<{ id: string; display: string }> {
		try {
			const jobs = getAllJobs();
			return jobs.map((job) => ({
				id: job.id,
				display: job.name,
			}));
		} catch (error) {
			logger.error(`Failed to get jobs: ${error}`);
			return [];
		}
	}

	public getWeaponTypes(): Array<string> {
		try {
			return [...WEAPON_TYPES];
		} catch (error) {
			logger.error(`Failed to get weapon types: ${error}`);
			return [];
		}
	}

	public async getTemplate(templateId: string): Promise<any> {
		try {
			// Get all registered dungeon IDs
			const dungeonIds = getRegisteredDungeonIds();

			// Parse @dungeon:id form
			const m = templateId.match(/^@([^:]+):(.+)$/);
			let targetDungeonId: string | undefined;
			let localTemplateId: string;

			if (m) {
				targetDungeonId = m[1];
				localTemplateId = m[2];
			} else {
				localTemplateId = templateId;
			}

			// Try to find template in specified dungeon or search all
			const searchDungeons = targetDungeonId ? [targetDungeonId] : dungeonIds;

			for (const dungeonId of searchDungeons) {
				const dungeon = getDungeonById(dungeonId);
				if (!dungeon) continue;

				const globalId = targetDungeonId
					? templateId
					: `@${dungeonId}:${localTemplateId}`;
				const template =
					dungeon.templates.get(globalId) ||
					dungeon.templates.get(localTemplateId);

				if (template) {
					// Convert template to serializable format
					const baseSerialized = template.baseSerialized || {};
					return {
						id: template.id,
						type: template.type,
						...baseSerialized,
					};
				}
			}

			return null;
		} catch (error) {
			logger.error(`Failed to get template ${templateId}: ${error}`);
			return null;
		}
	}

	public async getAllTemplates(): Promise<
		Array<{ id: string; display: string; type: string; dungeonId: string }>
	> {
		try {
			const templates: Array<{
				id: string;
				display: string;
				type: string;
				dungeonId: string;
			}> = [];
			const dungeonIds = getRegisteredDungeonIds();

			for (const dungeonId of dungeonIds) {
				const dungeon = getDungeonById(dungeonId);
				if (!dungeon) continue;

				for (const [templateId, template] of dungeon.templates.entries()) {
					templates.push({
						id: templateId,
						display: template.display || template.id,
						type: template.type,
						dungeonId: dungeonId,
					});
				}
			}

			return templates;
		} catch (error) {
			logger.error(`Failed to get all templates: ${error}`);
			return [];
		}
	}
}

export function createCharacterEditorService(
	config?: CharacterEditorServiceConfig
): CharacterEditorService {
	return new CharacterEditorService(config);
}
