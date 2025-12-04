import { contextBridge, ipcRenderer } from "electron";

const api = {
	// Races
	listRaces: () => ipcRenderer.invoke("archetype-editor:list-races"),
	getRace: (id: string) => ipcRenderer.invoke("archetype-editor:get-race", id),
	updateRace: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("archetype-editor:update-race", payload),
	createRace: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("archetype-editor:create-race", payload),
	deleteRace: (id: string) =>
		ipcRenderer.invoke("archetype-editor:delete-race", id),

	// Jobs
	listJobs: () => ipcRenderer.invoke("archetype-editor:list-jobs"),
	getJob: (id: string) => ipcRenderer.invoke("archetype-editor:get-job", id),
	updateJob: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("archetype-editor:update-job", payload),
	createJob: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("archetype-editor:create-job", payload),
	deleteJob: (id: string) =>
		ipcRenderer.invoke("archetype-editor:delete-job", id),

	// Abilities
	getAbilities: () => ipcRenderer.invoke("archetype-editor:get-abilities"),

	// Passives
	getPassives: () => ipcRenderer.invoke("archetype-editor:get-passives"),
};

contextBridge.exposeInMainWorld("archetypeEditorAPI", api);

declare global {
	interface Window {
		archetypeEditorAPI: typeof api;
	}
}
