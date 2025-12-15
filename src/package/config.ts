/**
 * Package: config - YAML configuration loader
 *
 * Loads `data/config.yaml` (creating it with sensible defaults if missing),
 * merges it into the in-memory `CONFIG` object from the config registry.
 *
 * Behavior
 * - Reads YAML from `data/config.yaml`
 * - Merges only known keys from file into `CONFIG` (unknown keys ignored)
 * - If the file is absent/unreadable, writes `CONFIG_DEFAULT` to disk
 * - Logs details at `info`/`debug` levels, including default vs overridden
 *
 * @example
 * import configPkg from './package/config.js';
 * import { CONFIG } from '../registry/config.js';
 * await configPkg.loader();
 * console.log(CONFIG.server.port);
 *
 * @module package/config
 */
import { Package } from "package-loader";
import { join, relative } from "path";
import { readFile, writeFile, rename, unlink } from "fs/promises";
import YAML from "js-yaml";
import logger from "../utils/logger.js";
import { getSafeRootDirectory } from "../utils/path.js";
import {
	CONFIG,
	CONFIG_DEFAULT,
	type Config,
	type GameConfig,
	type ServerConfig,
	type SecurityConfig,
	setConfig,
} from "../registry/config.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const CONFIG_PATH = join(DATA_DIRECTORY, "config.yaml");

export async function loadConfig() {
	logger.debug(`Loading config from ${relative(ROOT_DIRECTORY, CONFIG_PATH)}`);
	try {
		const content = await readFile(CONFIG_PATH, "utf-8");
		const parsed = YAML.load(content) as Partial<Config> | undefined;
		const config = parsed ?? {};
		const safe: Config = { ...CONFIG_DEFAULT };

		// merge game config
		if (config.game) {
			for (const key of Object.keys(config.game) as Array<keyof GameConfig>) {
				if (key in CONFIG_DEFAULT.game) {
					if (CONFIG.game[key] === config.game[key]) {
						logger.debug(`DEFAULT game.${key} = ${config.game[key]}`);
						continue;
					}
					safe.game[key] = config.game[key] as any;
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
					safe.server[key] = config.server[key] as any;
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
					safe.security[key] = config.security[key] as any;
					logger.debug(`Set security.${key} = ${config.security[key]}`);
				}
			}
		}

		setConfig(safe);
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
		await loadConfig();
	},
} as Package;
