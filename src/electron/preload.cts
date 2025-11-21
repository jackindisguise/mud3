import { contextBridge, ipcRenderer } from "electron";

const api = {
	getHitTypes: () => ipcRenderer.invoke("map-editor:get-hit-types"),
	getRaces: () => ipcRenderer.invoke("map-editor:get-races"),
	getJobs: () => ipcRenderer.invoke("map-editor:get-jobs"),
	listDungeons: () => ipcRenderer.invoke("map-editor:list-dungeons"),
	getDungeon: (id: string) => ipcRenderer.invoke("map-editor:get-dungeon", id),
	updateDungeon: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("map-editor:update-dungeon", payload),
	createDungeon: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("map-editor:create-dungeon", payload),
	calculateAttributes: (payload: {
		raceId: string;
		jobId: string;
		level: number;
	}) => ipcRenderer.invoke("map-editor:calculate-attributes", payload),
};

contextBridge.exposeInMainWorld("mapEditorAPI", api);

declare global {
	interface Window {
		mapEditorAPI: typeof api;
	}
}

