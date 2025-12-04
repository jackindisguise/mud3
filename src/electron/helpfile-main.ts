import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import { appendFileSync } from "node:fs";
import logger from "../logger.js";
import { getSafeRootDirectory } from "../utils/path.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
let service: any; // Will be typed after import
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

function getHelpfileEditorIndexPath(): string {
	if (app.isPackaged) {
		return path.join(app.getAppPath(), "helpfile-editor", "index.html");
	}
	return path.join(getSafeRootDirectory(), "helpfile-editor", "index.html");
}

function createMainWindow(): BrowserWindow {
	const win = new BrowserWindow({
		width: 1400,
		height: 900,
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "helpfile-preload.cjs"),
			nodeIntegration: false,
			contextIsolation: true,
			spellcheck: false,
		},
		show: false,
	});

	const helpfileEditorPath = getHelpfileEditorIndexPath();
	win.loadFile(helpfileEditorPath);

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
	// Helpfiles
	ipcMain.handle("helpfile-editor:list-helpfiles", () =>
		service.listHelpfiles()
	);
	ipcMain.handle("helpfile-editor:get-helpfile", (_event, id: string) =>
		service.getHelpfile(id)
	);
	ipcMain.handle(
		"helpfile-editor:update-helpfile",
		(_event, payload: { id: string; yaml: string }) =>
			service.updateHelpfile(payload)
	);
	ipcMain.handle(
		"helpfile-editor:create-helpfile",
		(_event, payload: { id: string; yaml: string }) =>
			service.createHelpfile(payload)
	);
	ipcMain.handle("helpfile-editor:delete-helpfile", (_event, id: string) =>
		service.deleteHelpfile(id)
	);
}

app.whenReady().then(async () => {
	try {
		dataRootPath = getSafeRootDirectory();
		logger.info(`Helpfile editor data root set to ${dataRootPath}`);
		electronErrorLogPath = path.join(dataRootPath, "electron-errors.log");
		appendToElectronLog(
			`=== Helpfile Editor Electron session started at ${new Date().toISOString()} ===`
		);

		// Import and create service
		const { createHelpfileEditorService } = await import(
			"../helpfile-editor/helpfile-editor-service.js"
		);
		service = createHelpfileEditorService({
			helpDir: path.join(dataRootPath, "data", "help"),
		});

		registerHandlers();
		createMainWindow();
	} catch (error) {
		logger.error(`Failed to start Helpfile Editor Electron app: ${error}`);
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

