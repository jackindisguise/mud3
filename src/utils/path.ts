//import { app } from "electron";
import { join } from "path";
/**
 * Returns the safe current working directory for runtime operations.
 * Prefers the `PORTABLE_EXECUTABLE_DIR` environment variable (set by
 * Electron portable builds) and falls back to `process.cwd()` otherwise.
 */
export function getSafeRootDirectory(): string {
	const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;

	if (portableDir) {
		return portableDir;
	}

	const cwd = process.cwd();
	//	if (cwd === "/") return app.getAppPath().replace(/dungedit\.app\/.+/g, "");

	return cwd;
}
