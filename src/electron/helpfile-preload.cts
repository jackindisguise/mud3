import { contextBridge, ipcRenderer } from "electron";

const api = {
	// Helpfiles
	listHelpfiles: () => ipcRenderer.invoke("helpfile-editor:list-helpfiles"),
	getHelpfile: (id: string) =>
		ipcRenderer.invoke("helpfile-editor:get-helpfile", id),
	updateHelpfile: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("helpfile-editor:update-helpfile", payload),
	createHelpfile: (payload: { id: string; yaml: string }) =>
		ipcRenderer.invoke("helpfile-editor:create-helpfile", payload),
	deleteHelpfile: (id: string) =>
		ipcRenderer.invoke("helpfile-editor:delete-helpfile", id),
};

contextBridge.exposeInMainWorld("helpfileEditorAPI", api);

declare global {
	interface Window {
		helpfileEditorAPI: typeof api;
	}
}




