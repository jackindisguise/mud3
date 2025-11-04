import { Package } from "package-loader";
import { join, relative } from "path";
import { readFile, writeFile } from "fs/promises";
import TOML from "smol-toml";
import logger from "../logger.js";

const DATA_DIRECTORY = join(process.cwd(), "data");
const CONFIG_PATH = join(DATA_DIRECTORY, "config.toml");

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
};

// make a copy of the default, don't reference it directly plz
export const CONFIG: Config = {
	game: { ...CONFIG_DEFAULT.game },
	server: { ...CONFIG_DEFAULT.server },
	security: { ...CONFIG_DEFAULT.security },
};

export default {
	name: "config",
	loader: async () => {
		// read config.toml
		logger.info(`Loading config from ${relative(process.cwd(), CONFIG_PATH)}`);
		try {
			const content = await readFile(CONFIG_PATH, "utf-8");
			const config = TOML.parse(content) as Partial<Config>;

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
			const defaultContent = TOML.stringify(CONFIG_DEFAULT);
			await writeFile(CONFIG_PATH, defaultContent, "utf-8");
			logger.info("Default config file created");
		}
	},
} as Package;
