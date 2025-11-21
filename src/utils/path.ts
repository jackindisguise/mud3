/**
 * Returns the safe current working directory for runtime operations.
 * Prefers the `PORTABLE_EXECUTABLE_DIR` environment variable (set by
 * Electron portable builds) and falls back to `process.cwd()` otherwise.
 */
export function getSafeRootDirectory(): string {
	return process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
}
