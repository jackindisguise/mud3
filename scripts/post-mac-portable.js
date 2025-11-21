import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rimrafSync } from "rimraf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "build");
const electronDir = path.join(buildDir, "electron");
const targetName = "dungedit-arm64.dmg";
const targetPath = path.join(rootDir, targetName);

function findDmg() {
	if (!fs.existsSync(electronDir)) {
		throw new Error(`Electron build directory not found at ${electronDir}`);
	}

	const entries = fs.readdirSync(electronDir);
	const dmgName = entries.find((file) => file.toLowerCase().endsWith(".dmg"));

	if (!dmgName) {
		throw new Error(
			`DMG file not found in ${electronDir}. Ensure electron-builder produced a mac dmg build.`
		);
	}

	return path.join(electronDir, dmgName);
}

function moveDmg() {
	const sourcePath = findDmg();

	if (fs.existsSync(targetPath)) {
		fs.unlinkSync(targetPath);
		console.log(`Deleted existing ${targetName} at project root`);
	}

	fs.renameSync(sourcePath, targetPath);
	console.log(`Moved mac portable DMG to ${targetPath}`);
}

function cleanupBuildDir() {
	if (fs.existsSync(buildDir)) {
		rimrafSync(buildDir);
		console.log(`Removed build directory at ${buildDir}`);
	}
}

try {
	moveDmg();
	cleanupBuildDir();
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
