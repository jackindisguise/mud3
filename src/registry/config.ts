/**
 * Registry: config - centralized configuration access
 *
 * Provides a centralized location for accessing the game configuration.
 * The CONFIG object is loaded and updated by the config package.
 *
 * @module registry/config
 */

import { DeepReadonly } from "../utils/types.js";

export { READONLY_CONFIG as CONFIG };

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
const CONFIG: Config = {
	game: { ...CONFIG_DEFAULT.game },
	server: { ...CONFIG_DEFAULT.server },
	security: { ...CONFIG_DEFAULT.security },
};

// export a readonly version of the config
const READONLY_CONFIG: DeepReadonly<Config> = CONFIG;

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

/**
 * Set the config object.
 * @param config - The config object to set.
 */
export function setConfig(config: Config) {
	CONFIG.game = config.game;
	CONFIG.server = config.server;
	CONFIG.security = config.security;
}
