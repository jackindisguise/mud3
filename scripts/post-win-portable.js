import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rimrafSync } from "rimraf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "build");
const electronDir = path.join(buildDir, "electron");
const targetName = "dungedit.exe";
const targetPath = path.join(rootDir, targetName);

function findPortableExe() {
	if (!fs.existsSync(electronDir)) {
		throw new Error(`Electron build directory not found at ${electronDir}`);
	}

	const entries = fs.readdirSync(electronDir);
	const exeName = entries.find(
		(file) => file.toLowerCase().endsWith(".exe") && file.includes("portable")
	);

	if (!exeName) {
		throw new Error(
			`Portable executable not found in ${electronDir}. Ensure electron-builder produced a portable build.`
		);
	}

	return path.join(electronDir, exeName);
}

function movePortableExe() {
	const sourcePath = findPortableExe();

	if (fs.existsSync(targetPath)) {
		fs.unlinkSync(targetPath);
	}

	fs.renameSync(sourcePath, targetPath);
	console.log(`Moved portable executable to ${targetPath}`);
}

function cleanupBuildDir() {
	if (fs.existsSync(buildDir)) {
		rimrafSync(buildDir);
		console.log(`Removed build directory at ${buildDir}`);
	}
}

try {
	movePortableExe();
	cleanupBuildDir();
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
