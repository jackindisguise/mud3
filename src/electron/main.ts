import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import { appendFileSync } from "node:fs";
import { loadPackage } from "package-loader";
import logger from "../logger.js";
import dungeon from "../package/dungeon.js";
import archetype from "../package/archetype.js";
import {
	createMapEditorService,
	MapEditorService,
} from "../map-editor/map-editor-service.js";
import { getSafeRootDirectory } from "../utils/path.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
let service: MapEditorService;
let dataRootPath: string;
let electronErrorLogPath: string;

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

async function ensurePackagesLoaded() {
	await logger.block("archetype", async () => {
		await loadPackage(archetype);
	});
	await logger.block("dungeon", async () => {
		await loadPackage(dungeon);
	});
}

function getMapEditorIndexPath(): string {
	if (app.isPackaged) {
		return path.join(app.getAppPath(), "map-editor", "index.html");
	}
	return path.join(getSafeRootDirectory(), "map-editor", "index.html");
}

function createMainWindow(): BrowserWindow {
	const win = new BrowserWindow({
		width: 1400,
		height: 900,
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
		show: false,
	});

	const mapEditorPath = getMapEditorIndexPath();
	win.loadFile(mapEditorPath);

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
	ipcMain.handle("map-editor:get-hit-types", () => service.getHitTypes());
	ipcMain.handle("map-editor:get-weapon-types", () => service.getWeaponTypes());
	ipcMain.handle("map-editor:get-races", () => service.getRaces());
	ipcMain.handle("map-editor:get-jobs", () => service.getJobs());
	ipcMain.handle("map-editor:list-dungeons", () => service.listDungeons());
	ipcMain.handle("map-editor:get-dungeon", (_event, id: string) =>
		service.getDungeon(id)
	);
	ipcMain.handle(
		"map-editor:update-dungeon",
		(_event, payload: { id: string; yaml: string }) =>
			service.updateDungeon(payload)
	);
	ipcMain.handle(
		"map-editor:create-dungeon",
		(_event, payload: { id: string; yaml: string }) =>
			service.createDungeon(payload)
	);
	ipcMain.handle(
		"map-editor:calculate-attributes",
		(_event, payload: { raceId: string; jobId: string; level: number }) =>
			service.calculateAttributes(payload)
	);
}

app.whenReady().then(async () => {
	try {
		dataRootPath = getSafeRootDirectory();
		logger.info(`Map editor data root set to ${dataRootPath}`);
		electronErrorLogPath = path.join(dataRootPath, "electron-errors.log");
		appendToElectronLog(
			`=== Electron session started at ${new Date().toISOString()} ===`
		);
		service = createMapEditorService({
			dungeonDir: path.join(dataRootPath, "data", "dungeons"),
		});
		await ensurePackagesLoaded();
		registerHandlers();
		createMainWindow();
	} catch (error) {
		logger.error(`Failed to start Electron app: ${error}`);
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
