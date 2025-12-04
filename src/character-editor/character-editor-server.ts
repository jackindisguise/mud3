/**
 * Character Editor HTTP Server
 *
 * Provides a web-based interface for editing characters, including:
 * - Character management
 * - YAML editing with validation
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile, access } from "fs/promises";
import { join } from "path";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../logger.js";
import {
	createCharacterEditorService,
	CharacterEditorService,
} from "./character-editor-service.js";
import { getSafeRootDirectory } from "../utils/path.js";

const PORT = 3003; // Different port from archetype editor (3001), map editor (3000), and helpfile editor (3002)
const ROOT_DIRECTORY = getSafeRootDirectory();
const CHARACTER_EDITOR_DIR = join(ROOT_DIRECTORY, "character-editor");

// Verify character editor directory exists at startup (async check)
access(CHARACTER_EDITOR_DIR, FS_CONSTANTS.F_OK)
	.then(() => {
		logger.debug("Character editor directory verified", {
			path: CHARACTER_EDITOR_DIR,
		});
	})
	.catch((error) => {
		logger.warn("Character editor directory not found", {
			path: CHARACTER_EDITOR_DIR,
			error: error.message,
		});
	});

const service = createCharacterEditorService();

function sendJSON(res: ServerResponse, statusCode: number, data: any): void {
	res.writeHead(statusCode, { "Content-Type": "application/json" });
	res.end(JSON.stringify(data));
}

function sendError(
	res: ServerResponse,
	statusCode: number,
	message: string
): void {
	sendJSON(res, statusCode, { error: message });
}

async function handleRequest(
	req: IncomingMessage,
	res: ServerResponse
): Promise<void> {
	const url = new URL(req.url || "/", `http://${req.headers.host}`);
	const pathname = url.pathname;

	// CORS headers
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS"
	);
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

	if (req.method === "OPTIONS") {
		res.writeHead(200);
		res.end();
		return;
	}

	try {
		// API endpoints
		if (pathname === "/api/characters" && req.method === "GET") {
			const response = await service.listCharacters();
			sendJSON(res, 200, response);
			return;
		}

		if (pathname.startsWith("/api/characters/") && req.method === "GET") {
			const id = decodeURIComponent(pathname.replace("/api/characters/", ""));
			const response = await service.getCharacter(id);
			sendJSON(res, 200, response);
			return;
		}

		if (pathname === "/api/characters" && req.method === "POST") {
			let body = "";
			for await (const chunk of req) {
				body += chunk.toString();
			}

			const payload = JSON.parse(body);
			await service.createCharacter(payload);
			sendJSON(res, 201, { success: true });
			return;
		}

		if (pathname.startsWith("/api/characters/") && req.method === "PUT") {
			const id = decodeURIComponent(pathname.replace("/api/characters/", ""));
			let body = "";
			for await (const chunk of req) {
				body += chunk.toString();
			}

			const payload = JSON.parse(body);
			await service.updateCharacter({ id, ...payload });
			sendJSON(res, 200, { success: true });
			return;
		}

		if (pathname.startsWith("/api/characters/") && req.method === "DELETE") {
			const id = decodeURIComponent(pathname.replace("/api/characters/", ""));
			await service.deleteCharacter(id);
			sendJSON(res, 200, { success: true });
			return;
		}

		// Get races
		if (pathname === "/api/races" && req.method === "GET") {
			const races = service.getRaces();
			sendJSON(res, 200, { races });
			return;
		}

		// Get jobs
		if (pathname === "/api/jobs" && req.method === "GET") {
			const jobs = service.getJobs();
			sendJSON(res, 200, { jobs });
			return;
		}

		// Get template by ID
		if (pathname.startsWith("/api/templates/") && req.method === "GET") {
			const templateId = decodeURIComponent(
				pathname.replace("/api/templates/", "")
			);
			const template = await service.getTemplate(templateId);
			if (template) {
				sendJSON(res, 200, { template });
			} else {
				sendError(res, 404, "Template not found");
			}
			return;
		}

		// Get all templates
		if (pathname === "/api/templates" && req.method === "GET") {
			const templates = await service.getAllTemplates();
			sendJSON(res, 200, { templates });
			return;
		}

		// Get weapon types
		if (pathname === "/api/weapon-types" && req.method === "GET") {
			const weaponTypes = service.getWeaponTypes();
			sendJSON(res, 200, { weaponTypes });
			return;
		}

		// Static file serving
		if (pathname === "/" || pathname === "/index.html") {
			const filePath = join(CHARACTER_EDITOR_DIR, "index.html");
			const content = await readFile(filePath, "utf-8");
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(content);
			return;
		}

		// Serve static files from character-editor directory
		if (pathname.startsWith("/static/")) {
			const filePath = join(CHARACTER_EDITOR_DIR, pathname);
			// Security: ensure file is within character-editor directory
			if (!filePath.startsWith(CHARACTER_EDITOR_DIR)) {
				sendError(res, 403, "Forbidden");
				return;
			}

			try {
				const content = await readFile(filePath);
				const ext = pathname.split(".").pop()?.toLowerCase();
				const contentType =
					ext === "js"
						? "application/javascript"
						: ext === "css"
						? "text/css"
						: ext === "json"
						? "application/json"
						: "text/plain";

				res.writeHead(200, { "Content-Type": contentType });
				res.end(content);
			} catch (error: any) {
				if (error.code === "ENOENT") {
					sendError(res, 404, "File not found");
				} else {
					sendError(res, 500, "Internal server error");
				}
			}
			return;
		}

		sendError(res, 404, "Not found");
	} catch (error: any) {
		logger.error("Character editor server error", { error: error.message });
		sendError(res, 500, error.message || "Internal server error");
	}
}

export interface CharacterEditorServer {
	start(): Promise<void>;
	stop(): Promise<void>;
}

export function createCharacterEditorServer(): CharacterEditorServer {
	let server: ReturnType<typeof createServer> | null = null;

	return {
		async start() {
			return new Promise<void>((resolve, reject) => {
				try {
					server = createServer(handleRequest);
					server.listen(PORT, () => {
						logger.info(`Character editor server listening on port ${PORT}`);
						resolve();
					});

					server.on("error", (error: NodeJS.ErrnoException) => {
						if (error.code === "EADDRINUSE") {
							logger.error(
								`Character editor server port ${PORT} is already in use`
							);
						} else {
							logger.error("Character editor server error", { error });
						}
						reject(error);
					});
				} catch (error) {
					reject(error);
				}
			});
		},

		async stop() {
			return new Promise<void>((resolve) => {
				if (server) {
					server.close(() => {
						logger.info("Character editor server stopped");
						resolve();
					});
				} else {
					resolve();
				}
			});
		},
	};
}
