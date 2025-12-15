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

export interface HelpfileListResponse {
	helpfiles: string[];
}

export interface HelpfileResponse {
	id: string;
	yaml: string;
}

export interface CreateHelpfilePayload {
	id: string;
	yaml: string;
}

export interface UpdateHelpfilePayload {
	id: string;
	yaml: string;
}

export interface HelpfileEditorServiceConfig {
	helpDir?: string;
}

export class HelpfileEditorService {
	private readonly helpDir: string;
	private readonly validExtensions = new Set([".yaml", ".yml"]);

	constructor(config: HelpfileEditorServiceConfig = {}) {
		const rootDir = getSafeRootDirectory();
		const dataDir = join(rootDir, "data");
		this.helpDir = config.helpDir ?? join(dataDir, "help");
	}

	public async listHelpfiles(): Promise<HelpfileListResponse> {
		try {
			const files = await readdir(this.helpDir);
			const ids = files
				.filter((file) => this.validExtensions.has(extname(file)))
				.map((file) => file.replace(/\.(yaml|yml)$/, ""))
				.sort();
			return { helpfiles: ids };
		} catch (error) {
			logger.error(`Failed to list helpfiles: ${error}`);
			return { helpfiles: [] };
		}
	}

	public async getHelpfile(id: string): Promise<HelpfileResponse> {
		const filePath = this.getHelpfileFilePath(id);
		const yamlContent = await readFile(filePath, "utf-8");
		return { id, yaml: yamlContent };
	}

	public async createHelpfile(
		payload: CreateHelpfilePayload
	): Promise<{ id: string; success: true }> {
		if (!payload.yaml) {
			throw new Error("YAML data is required for helpfile creation");
		}

		const filePath = this.getHelpfileFilePath(payload.id);
		await this.ensureHelpfileDoesNotExist(filePath);
		await this.writeHelpfileFile(filePath, payload.yaml);
		logger.debug(`Created helpfile YAML: ${payload.id}`);
		return { id: payload.id, success: true };
	}

	public async updateHelpfile(
		payload: UpdateHelpfilePayload
	): Promise<{ success: true }> {
		if (!payload.yaml) {
			throw new Error("YAML data is required for updates");
		}
		const filePath = this.getHelpfileFilePath(payload.id);
		await this.writeHelpfileFile(filePath, payload.yaml);
		logger.debug(`Saved helpfile YAML: ${payload.id}`);
		return { success: true };
	}

	public async deleteHelpfile(id: string): Promise<{ success: true }> {
		const filePath = this.getHelpfileFilePath(id);
		try {
			await unlink(filePath);
			logger.debug(`Deleted helpfile YAML: ${id}`);
			return { success: true };
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") {
				throw new Error("Helpfile not found");
			}
			throw error;
		}
	}

	private getHelpfileFilePath(id: string): string {
		return join(this.helpDir, `${id}.yaml`);
	}

	private async ensureHelpfileDoesNotExist(filePath: string): Promise<void> {
		try {
			await access(filePath, FS_CONSTANTS.F_OK);
			throw new Error("Helpfile already exists");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return;
			}
			throw error;
		}
	}

	private async writeHelpfileFile(
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
}

export function createHelpfileEditorService(
	config?: HelpfileEditorServiceConfig
): HelpfileEditorService {
	return new HelpfileEditorService(config);
}
