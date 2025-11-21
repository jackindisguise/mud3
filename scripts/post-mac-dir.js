import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rimrafSync } from "rimraf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "build", "electron");
const targetPath = path.join(rootDir, "dungedit.app");

function ensureBuildDir() {
	if (!fs.existsSync(buildDir)) {
		throw new Error(`Electron dir build not found at ${buildDir}`);
	}
}

function findAppBundle(startDir) {
	const entries = fs.readdirSync(startDir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(startDir, entry.name);

		if (entry.isDirectory() && entry.name.endsWith(".app")) {
			return fullPath;
		}

		if (entry.isDirectory()) {
			const nested = findAppBundle(fullPath);
			if (nested) {
				return nested;
			}
		}
	}

	return null;
}

function moveAppBundle(sourcePath) {
	if (fs.existsSync(targetPath)) {
		rimrafSync(targetPath);
		console.log(`Deleted existing ${targetPath}`);
	}

	fs.renameSync(sourcePath, targetPath);
	console.log(`Moved ${path.basename(sourcePath)} to ${targetPath}`);
}

try {
	ensureBuildDir();

	const appBundle = findAppBundle(buildDir);

	if (!appBundle) {
		throw new Error(`No .app bundle found under ${buildDir}`);
	}

	moveAppBundle(appBundle);
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}

