import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import { loadPackage } from "package-loader";
import logger from "../logger.js";
import dungeon from "../package/dungeon.js";
import archetype from "../package/archetype.js";
import { createMapEditorService } from "../map-editor-service.js";

const service = createMapEditorService();
const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function ensurePackagesLoaded() {
	await logger.block("archetype", async () => {
		await loadPackage(archetype);
	});
	await logger.block("dungeon", async () => {
		await loadPackage(dungeon);
	});
}

function createMainWindow(): BrowserWindow {
	const win = new BrowserWindow({
		width: 1400,
		height: 900,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			nodeIntegration: false,
			contextIsolation: true,
		},
		show: false,
	});

	const mapEditorPath = path.join(process.cwd(), "map-editor", "index.html");
	win.loadFile(mapEditorPath);
	win.once("ready-to-show", () => {
		win.show();
	});

	return win;
}

function registerHandlers() {
	ipcMain.handle("map-editor:get-hit-types", () => service.getHitTypes());
	ipcMain.handle("map-editor:get-races", () => service.getRaces());
	ipcMain.handle("map-editor:get-jobs", () => service.getJobs());
	ipcMain.handle("map-editor:list-dungeons", () =>
		service.listDungeons()
	);
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
		(
			_event,
			payload: { raceId: string; jobId: string; level: number }
		) => service.calculateAttributes(payload)
	);
}

app.whenReady().then(async () => {
	try {
		await ensurePackagesLoaded();
		registerHandlers();
		createMainWindow();
	} catch (error) {
		logger.error(`Failed to start Electron app: ${error}`);
		app.quit();
	}
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

