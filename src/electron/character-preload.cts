import { contextBridge, ipcRenderer } from "electron";

const api = {
	// Characters
	listCharacters: () => ipcRenderer.invoke("character-editor:list-characters"),
	getCharacter: (id: string) =>
		ipcRenderer.invoke("character-editor:get-character", id),
	updateCharacter: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("character-editor:update-character", payload),
	createCharacter: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("character-editor:create-character", payload),
	deleteCharacter: (id: string) =>
		ipcRenderer.invoke("character-editor:delete-character", id),
	// Races and Jobs
	getRaces: () => ipcRenderer.invoke("character-editor:get-races"),
	getJobs: () => ipcRenderer.invoke("character-editor:get-jobs"),
	// Templates
	getTemplate: (templateId: string) =>
		ipcRenderer.invoke("character-editor:get-template", templateId),
	getAllTemplates: () => ipcRenderer.invoke("character-editor:get-all-templates"),
	// Weapon types
	getWeaponTypes: () => ipcRenderer.invoke("character-editor:get-weapon-types"),
};

contextBridge.exposeInMainWorld("characterEditorAPI", api);

declare global {
	interface Window {
		characterEditorAPI: typeof api;
	}
}

