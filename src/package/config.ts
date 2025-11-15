/**
 * Package: config - YAML configuration loader
 *
 * Loads `data/config.yaml` (creating it with sensible defaults if missing),
 * merges it into the in-memory `CONFIG` object, and exposes typed config
 * shapes for game, server, and security settings.
 *
 * Behavior
 * - Reads YAML from `data/config.yaml`
 * - Merges only known keys from file into `CONFIG` (unknown keys ignored)
 * - If the file is absent/unreadable, writes `CONFIG_DEFAULT` to disk
 * - Logs details at `info`/`debug` levels, including default vs overridden
 *
 * @example
 * import configPkg, { CONFIG } from './package/config.js';
 * await configPkg.loader();
 * console.log(CONFIG.server.port);
 *
 * @module package/config
 */
import { Package } from "package-loader";
import { join, relative } from "path";
import { readFile, writeFile, rename, unlink } from "fs/promises";
import YAML from "js-yaml";
import logger from "../logger.js";

const DATA_DIRECTORY = join(process.cwd(), "data");
const CONFIG_PATH = join(DATA_DIRECTORY, "config.yaml");

export type GameConfig = {
	name: string;
	creator: string;
};

export type ServerConfig = {
	port: number;
	inactivity_timeout: number;
};

export type SecurityConfig = {
	password_salt: string;
};

export type Config = {
	game: GameConfig;
	server: ServerConfig;
	security: SecurityConfig;
};

export const CONFIG_DEFAULT: Config = {
	game: {
		name: "mud3",
		creator: "jackindisguise",
	},
	server: {
		port: 23,
		inactivity_timeout: 1800,
	},
	security: {
		password_salt: "changeme_default_salt_12345",
	},
} as const;

// make a copy of the default, don't reference it directly plz
export const CONFIG: Config = {
	game: { ...CONFIG_DEFAULT.game },
	server: { ...CONFIG_DEFAULT.server },
	security: { ...CONFIG_DEFAULT.security },
};

export async function loadConfig() {
	logger.debug(`Loading config from ${relative(process.cwd(), CONFIG_PATH)}`);
	try {
		const content = await readFile(CONFIG_PATH, "utf-8");
		const parsed = YAML.load(content) as Partial<Config> | undefined;
		const config = parsed ?? {};

		// merge game config
		if (config.game) {
			for (const key of Object.keys(config.game) as Array<keyof GameConfig>) {
				if (key in CONFIG_DEFAULT.game) {
					if (CONFIG.game[key] === config.game[key]) {
						logger.debug(`DEFAULT game.${key} = ${config.game[key]}`);
						continue;
					}
					CONFIG.game[key] = config.game[key] as any;
					logger.debug(`Set game.${key} = ${config.game[key]}`, {
						config: config,
					});
				}
			}
		}

		// merge server config
		if (config.server) {
			for (const key of Object.keys(config.server) as Array<
				keyof ServerConfig
			>) {
				if (key in CONFIG_DEFAULT.server) {
					if (CONFIG.server[key] === config.server[key]) {
						logger.debug(`DEFAULT server.${key} = ${config.server[key]}`);
						continue;
					}
					CONFIG.server[key] = config.server[key] as any;
					logger.debug(`Set server.${key} = ${config.server[key]}`);
				}
			}
		}

		// merge security config
		if (config.security) {
			for (const key of Object.keys(config.security) as Array<
				keyof SecurityConfig
			>) {
				if (key in CONFIG_DEFAULT.security) {
					if (CONFIG.security[key] === config.security[key]) {
						logger.debug(`DEFAULT security.${key} = ${config.security[key]}`);
						continue;
					}
					CONFIG.security[key] = config.security[key] as any;
					logger.debug(`Set security.${key} = ${config.security[key]}`);
				}
			}
		}

		logger.info("Config loaded successfully");
	} catch (error) {
		// if file can't be read or doesn't exist, save default config
		logger.debug(
			`Config file not found or unreadable, creating default at ${CONFIG_PATH}`
		);
		const defaultContent = YAML.dump(CONFIG_DEFAULT, {
			noRefs: true,
			lineWidth: 120,
		});
		const tempPath = `${CONFIG_PATH}.tmp`;
		try {
			// Write to temporary file first
			await writeFile(tempPath, defaultContent, "utf-8");
			// Atomically rename temp file to final location
			await rename(tempPath, CONFIG_PATH);
			logger.debug("Default config file created");
		} catch (writeError) {
			// Clean up temp file if it exists
			try {
				await unlink(tempPath);
			} catch {
				// Ignore cleanup errors
			}
			throw writeError;
		}
	}
}

export default {
	name: "config",
	loader: async () => {
		// read config.yaml
		await logger.block("config", async () => {
			await loadConfig();
		});
	},
} as Package;
