import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import { appendFileSync } from "node:fs";
import logger from "../utils/logger.js";
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

function getCharacterEditorIndexPath(): string {
	if (app.isPackaged) {
		return path.join(app.getAppPath(), "character-editor", "index.html");
	}
	return path.join(getSafeRootDirectory(), "character-editor", "index.html");
}

function createMainWindow(): BrowserWindow {
	const win = new BrowserWindow({
		width: 1400,
		height: 900,
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "character-preload.cjs"),
			nodeIntegration: false,
			contextIsolation: true,
			spellcheck: false,
		},
		show: false,
	});

	const characterEditorPath = getCharacterEditorIndexPath();
	win.loadFile(characterEditorPath);

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
	// Characters
	ipcMain.handle("character-editor:list-characters", () =>
		service.listCharacters()
	);
	ipcMain.handle("character-editor:get-character", (_event, id: string) =>
		service.getCharacter(id)
	);
	ipcMain.handle(
		"character-editor:update-character",
		(_event, payload: { id: string; yaml: string }) =>
			service.updateCharacter(payload)
	);
	ipcMain.handle(
		"character-editor:create-character",
		(_event, payload: { id: string; yaml: string }) =>
			service.createCharacter(payload)
	);
	ipcMain.handle("character-editor:delete-character", (_event, id: string) =>
		service.deleteCharacter(id)
	);

	// Races
	ipcMain.handle("character-editor:get-races", () => ({
		races: service.getRaces(),
	}));

	// Jobs
	ipcMain.handle("character-editor:get-jobs", () => ({
		jobs: service.getJobs(),
	}));

	// Templates
	ipcMain.handle(
		"character-editor:get-template",
		async (_event, templateId: string) => {
			const template = await service.getTemplate(templateId);
			return template ? { template } : null;
		}
	);
	ipcMain.handle("character-editor:get-all-templates", async () => {
		const templates = await service.getAllTemplates();
		return { templates };
	});

	// Weapon types
	ipcMain.handle("character-editor:get-weapon-types", () => ({
		weaponTypes: service.getWeaponTypes(),
	}));
}

app.whenReady().then(async () => {
	try {
		dataRootPath = getSafeRootDirectory();
		logger.info(`Character editor data root set to ${dataRootPath}`);
		electronErrorLogPath = path.join(dataRootPath, "electron-errors.log");
		appendToElectronLog(
			`=== Character Editor Electron session started at ${new Date().toISOString()} ===`
		);

		// Load packages first before creating service (which might import registries)
		await ensurePackagesLoaded();

		// Import and create service
		const { createCharacterEditorService } = await import(
			"../editors/character-editor/character-editor-service.js"
		);
		service = createCharacterEditorService({
			characterDir: path.join(dataRootPath, "data", "characters"),
		});

		registerHandlers();
		createMainWindow();
	} catch (error) {
		logger.error(`Failed to start Character Editor Electron app: ${error}`);
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
