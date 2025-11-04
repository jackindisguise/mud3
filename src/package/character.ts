import { join, relative } from "path";
import { mkdir, readFile, writeFile, access } from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../logger.js";
import { Character, SerializedCharacter } from "../character.js";
import YAML from "js-yaml";

const CHAR_DIR = join(process.cwd(), "data", "characters");

function sanitizeUsername(username: string): string {
	// Allow alphanumerics, underscore, hyphen. Replace others with underscore.
	return username
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/gi, "_");
}

function getCharacterFilePath(username: string): string {
	const safe = sanitizeUsername(username);
	return join(CHAR_DIR, `${safe}.yaml`);
}

async function ensureDir(): Promise<void> {
	await mkdir(CHAR_DIR, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, FS_CONSTANTS.F_OK);
		return true;
	} catch {
		return false;
	}
}

export async function saveCharacter(character: Character): Promise<void> {
	await ensureDir();
	const data: SerializedCharacter = character.serialize();
	const filePath = getCharacterFilePath(character.credentials.username);
	const yaml = YAML.dump(data as any, { noRefs: true, lineWidth: 120 });
	await writeFile(filePath, yaml, "utf-8");
	logger.debug(
		`Saved character file: ${relative(process.cwd(), filePath)} for ${
			character.credentials.username
		}`
	);
}

export async function loadCharacter(
	username: string
): Promise<Character | null> {
	await ensureDir();
	const filePath = getCharacterFilePath(username);
	if (!(await fileExists(filePath))) {
		logger.debug(
			`Character file not found: ${relative(
				process.cwd(),
				filePath
			)} (username=${username})`
		);
		return null;
	}

	const content = await readFile(filePath, "utf-8");
	const raw = YAML.load(content) as SerializedCharacter;

	const character = Character.deserialize(raw);
	return character;
}

// Optional package object for package-loader compatibility
export default {
	name: "character",
	loader: async () => {
		await ensureDir();
		logger.info(
			`Character storage directory ready: ${relative(process.cwd(), CHAR_DIR)}`
		);
	},
};
