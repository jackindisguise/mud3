import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import { appendFileSync } from "node:fs";
import logger from "../logger.js";
import { getSafeRootDirectory } from "../utils/path.js";
import { loadPackage } from "package-loader";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
let service: any; // Will be typed after import
let dataRootPath: string;
let electronErrorLogPath: string;

async function ensurePackagesLoaded() {
	// Load archetype, ability, and effect first
	const dungeon = await import("../package/dungeon.js");
	const archetype = await import("../package/archetype.js");
	const ability = await import("../package/ability.js");
	const effect = await import("../package/effect.js");
	await logger.block("effect", async () => {
		await loadPackage(effect.default);
	});
	await logger.block("ability", async () => {
		await loadPackage(ability.default);
	});
	await logger.block("archetype", async () => {
		await loadPackage(archetype.default);
	});
	await logger.block("dungeon", async () => {
		await loadPackage(dungeon.default);
	});
}

function appendToElectronLog(entry: string): void {
	if (!electronErrorLogPath) return;
	try {
		appendFileSync(electronErrorLogPath, `${entry}\n`, { encoding: "utf-8" });
	} catch (error) {
		logger.warn("Failed to write to electron error log", { error });
	}
}

function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.stack || error.message;
	}
	return typeof error === "string" ? error : JSON.stringify(error);
}

function logElectronError(
	source: string,
	error: unknown,
	meta?: Record<string, unknown>
): void {
	const timestamp = new Date().toISOString();
	const message = `[${timestamp}] [${source}] ${formatError(error)}${
		meta ? ` ${JSON.stringify(meta)}` : ""
	}`;
	appendToElectronLog(message);
	logger.error(`${source}: ${formatError(error)}`, meta ? { meta } : undefined);
}

function getArchetypeEditorIndexPath(): string {
	if (app.isPackaged) {
		return path.join(app.getAppPath(), "archetype-editor", "index.html");
	}
	return path.join(getSafeRootDirectory(), "archetype-editor", "index.html");
}

function createMainWindow(): BrowserWindow {
	const win = new BrowserWindow({
		width: 1400,
		height: 900,
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "archetype-preload.cjs"),
			nodeIntegration: false,
			contextIsolation: true,
			spellcheck: false,
		},
		show: false,
	});

	const archetypeEditorPath = getArchetypeEditorIndexPath();
	win.loadFile(archetypeEditorPath);

	win.webContents.on(
		"console-message",
		(_event, level, message, line, sourceId) => {
			if (level >= 2) {
				logElectronError("Renderer console", message, {
					source: sourceId,
					line,
					level,
				});
			}
		}
	);

	win.webContents.on("render-process-gone", (_event, details) => {
		logElectronError("Renderer process gone", details);
	});

	win.webContents.on(
		"did-fail-load",
		(_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
			logElectronError("Renderer failed to load", errorDescription, {
				errorCode,
				validatedURL,
				isMainFrame,
			});
		}
	);

	win.on("unresponsive", () => {
		logElectronError("Window unresponsive", "The renderer is unresponsive");
	});

	win.once("ready-to-show", () => {
		win.show();
	});

	return win;
}

function registerHandlers() {
	// Races
	ipcMain.handle("archetype-editor:list-races", () =>
		service.listArchetypes("race")
	);
	ipcMain.handle("archetype-editor:get-race", (_event, id: string) =>
		service.getArchetype(id, "race")
	);
	ipcMain.handle(
		"archetype-editor:update-race",
		(_event, payload: { id: string; yaml: string }) =>
			service.updateArchetype({ ...payload, type: "race" })
	);
	ipcMain.handle(
		"archetype-editor:create-race",
		(_event, payload: { id: string; yaml: string }) =>
			service.createArchetype({ ...payload, type: "race" })
	);
	ipcMain.handle("archetype-editor:delete-race", (_event, id: string) =>
		service.deleteArchetype(id, "race")
	);

	// Jobs
	ipcMain.handle("archetype-editor:list-jobs", () =>
		service.listArchetypes("job")
	);
	ipcMain.handle("archetype-editor:get-job", (_event, id: string) =>
		service.getArchetype(id, "job")
	);
	ipcMain.handle(
		"archetype-editor:update-job",
		(_event, payload: { id: string; yaml: string }) =>
			service.updateArchetype({ ...payload, type: "job" })
	);
	ipcMain.handle(
		"archetype-editor:create-job",
		(_event, payload: { id: string; yaml: string }) =>
			service.createArchetype({ ...payload, type: "job" })
	);
	ipcMain.handle("archetype-editor:delete-job", (_event, id: string) =>
		service.deleteArchetype(id, "job")
	);

	// Abilities
	ipcMain.handle("archetype-editor:get-abilities", () => {
		const abilities = service.getAbilities();
		return { abilities };
	});

	// Passives
	ipcMain.handle("archetype-editor:get-passives", () => {
		const passives = service.getPassives();
		return { passives };
	});
}

app.whenReady().then(async () => {
	try {
		dataRootPath = getSafeRootDirectory();
		logger.info(`Archetype editor data root set to ${dataRootPath}`);
		electronErrorLogPath = path.join(dataRootPath, "electron-errors.log");
		appendToElectronLog(
			`=== Archetype Editor Electron session started at ${new Date().toISOString()} ===`
		);

		// Load packages first before creating service (which might import registries)
		await ensurePackagesLoaded();

		// Import and create service after packages are loaded
		const { createArchetypeEditorService } = await import(
			"../archetype-editor/archetype-editor-service.js"
		);
		service = createArchetypeEditorService({
			racesDir: path.join(dataRootPath, "data", "races"),
			jobsDir: path.join(dataRootPath, "data", "jobs"),
		});

		registerHandlers();
		createMainWindow();
	} catch (error) {
		logger.error(`Failed to start Archetype Editor Electron app: ${error}`);
		app.quit();
	}
});

process.on("uncaughtException", (error) => {
	logElectronError("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
	logElectronError("Unhandled rejection", reason);
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createMainWindow();
	}
});
