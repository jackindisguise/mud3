/**
 * Archetype Editor HTTP Server
 *
 * Provides a web-based interface for editing race and job archetypes, including:
 * - Race archetype management
 * - Job archetype management
 * - YAML editing with validation
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile, access } from "fs/promises";
import { join } from "path";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../../logger.js";
import {
	createArchetypeEditorService,
	ArchetypeEditorService,
} from "./archetype-editor-service.js";
import { getSafeRootDirectory } from "../../utils/path.js";

const PORT = 3001; // Different port from map editor
const ROOT_DIRECTORY = getSafeRootDirectory();
const ARCHETYPE_EDITOR_DIR = join(
	ROOT_DIRECTORY,
	"editors",
	"archetype-editor"
);

// Verify archetype editor directory exists at startup (async check)
access(ARCHETYPE_EDITOR_DIR, FS_CONSTANTS.F_OK)
	.then(() => {
		logger.debug(`Archetype editor directory found: ${ARCHETYPE_EDITOR_DIR}`);
	})
	.catch((error) => {
		logger.error(
			`Archetype editor directory not found: ${ARCHETYPE_EDITOR_DIR}`
		);
		logger.error(`Current working directory: ${ROOT_DIRECTORY}`);
	});

interface ArchetypeEditorServer {
	server: ReturnType<typeof createServer>;
	start(): Promise<void>;
	stop(): Promise<void>;
}

class ArchetypeEditorServerImpl implements ArchetypeEditorServer {
	private readonly service: ArchetypeEditorService;
	public server = createServer(this.handleRequest.bind(this));

	constructor(
		service: ArchetypeEditorService = createArchetypeEditorService()
	) {
		this.service = service;
	}

	private async handleRequest(
		req: IncomingMessage,
		res: ServerResponse
	): Promise<void> {
		const url = new URL(req.url || "/", `http://${req.headers.host}`);
		const path = url.pathname;

		// CORS headers
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS"
		);
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");

		if (req.method === "OPTIONS") {
			res.writeHead(200);
			res.end();
			return;
		}

		try {
			// Serve static files
			if (path === "/" || path === "/index.html") {
				const filePath = join(ARCHETYPE_EDITOR_DIR, "index.html");
				logger.debug(`Serving index.html from: ${filePath}`);
				await this.serveFile(res, filePath, "text/html");
				return;
			}

			if (path.startsWith("/static/")) {
				const filePath = path.replace("/static/", "");
				const fullPath = join(ARCHETYPE_EDITOR_DIR, "static", filePath);
				logger.debug(`Serving static file: ${fullPath}`);
				const ext = filePath.split(".").pop()?.toLowerCase();
				const contentType =
					ext === "css"
						? "text/css"
						: ext === "js"
						? "application/javascript"
						: "text/plain";
				await this.serveFile(res, fullPath, contentType);
				return;
			}

			// API endpoints
			// List archetypes
			if (path.startsWith("/api/races") && req.method === "GET") {
				await this.listArchetypes(res, "race");
				return;
			}

			if (path.startsWith("/api/jobs") && req.method === "GET") {
				await this.listArchetypes(res, "job");
				return;
			}

			// Get archetype
			if (path.startsWith("/api/races/") && req.method === "GET") {
				const id = path.split("/")[3];
				await this.getArchetype(res, id, "race");
				return;
			}

			if (path.startsWith("/api/jobs/") && req.method === "GET") {
				const id = path.split("/")[3];
				await this.getArchetype(res, id, "job");
				return;
			}

			// Create archetype
			if (path.startsWith("/api/races/") && req.method === "POST") {
				const id = path.split("/")[3];
				await this.createArchetype(req, res, id, "race");
				return;
			}

			if (path.startsWith("/api/jobs/") && req.method === "POST") {
				const id = path.split("/")[3];
				await this.createArchetype(req, res, id, "job");
				return;
			}

			// Update archetype
			if (path.startsWith("/api/races/") && req.method === "PUT") {
				const id = path.split("/")[3];
				await this.updateArchetype(req, res, id, "race");
				return;
			}

			if (path.startsWith("/api/jobs/") && req.method === "PUT") {
				const id = path.split("/")[3];
				await this.updateArchetype(req, res, id, "job");
				return;
			}

			// Delete archetype
			if (path.startsWith("/api/races/") && req.method === "DELETE") {
				const id = path.split("/")[3];
				await this.deleteArchetype(res, id, "race");
				return;
			}

			if (path.startsWith("/api/jobs/") && req.method === "DELETE") {
				const id = path.split("/")[3];
				await this.deleteArchetype(res, id, "job");
				return;
			}

			// Get abilities list
			if (path === "/api/abilities" && req.method === "GET") {
				await this.getAbilities(res);
				return;
			}

			if (path === "/api/passives" && req.method === "GET") {
				await this.getPassives(res);
				return;
			}

			// 404
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not Found");
		} catch (error) {
			logger.error(`Archetype editor server error: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async serveFile(
		res: ServerResponse,
		filePath: string,
		contentType: string
	): Promise<void> {
		try {
			// Check if file exists first
			await access(filePath, FS_CONSTANTS.F_OK);
			const content = await readFile(filePath, "utf-8");
			res.writeHead(200, { "Content-Type": contentType });
			res.end(content);
		} catch (error) {
			logger.error(`Failed to serve file: ${filePath}`);
			logger.error(`Error details: ${error}`);
			logger.error(`Current working directory: ${ROOT_DIRECTORY}`);
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end(
				`File not found: ${filePath}\n\nCurrent directory: ${ROOT_DIRECTORY}`
			);
		}
	}

	private async listArchetypes(
		res: ServerResponse,
		type: "race" | "job"
	): Promise<void> {
		try {
			const result = await this.service.listArchetypes(type);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			logger.error(`Failed to list ${type}s: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async getArchetype(
		res: ServerResponse,
		id: string,
		type: "race" | "job"
	): Promise<void> {
		try {
			const data = await this.service.getArchetype(id, type);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(data));
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: `${type} not found` }));
			} else {
				logger.error(`Failed to read ${type} ${id}: ${error}`);
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: String(error) }));
			}
		}
	}

	private async createArchetype(
		req: IncomingMessage,
		res: ServerResponse,
		id: string,
		type: "race" | "job"
	): Promise<void> {
		let body = "";
		for await (const chunk of req) {
			body += chunk;
		}

		const data = JSON.parse(body);

		try {
			const result = await this.service.createArchetype({
				id,
				type,
				yaml: data.yaml,
			});
			res.writeHead(201, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.message === "Archetype already exists") {
				res.writeHead(409, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			if (err.message === "YAML data is required for archetype creation") {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			logger.error(`Failed to create ${type} ${id}: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async updateArchetype(
		req: IncomingMessage,
		res: ServerResponse,
		id: string,
		type: "race" | "job"
	): Promise<void> {
		let body = "";
		for await (const chunk of req) {
			body += chunk;
		}

		const data = JSON.parse(body);

		try {
			const result = await this.service.updateArchetype({
				id,
				type,
				yaml: data.yaml,
			});
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			const err = error as Error;
			if (err.message === "YAML data is required for updates") {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			logger.error(`Failed to update ${type} ${id}: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async deleteArchetype(
		res: ServerResponse,
		id: string,
		type: "race" | "job"
	): Promise<void> {
		try {
			const result = await this.service.deleteArchetype(id, type);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			const err = error as Error;
			if (err.message === `${type} not found`) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			logger.error(`Failed to delete ${type} ${id}: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async getAbilities(res: ServerResponse): Promise<void> {
		try {
			const abilities = this.service.getAbilities();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ abilities }));
		} catch (error) {
			logger.error(`Failed to get abilities: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async getPassives(res: ServerResponse): Promise<void> {
		try {
			const passives = this.service.getPassives();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ passives }));
		} catch (error) {
			logger.error(`Failed to get passives: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.server.listen(PORT, () => {
				logger.info(
					`Archetype editor server listening on http://localhost:${PORT}`
				);
				resolve();
			});
			this.server.once("error", reject);
		});
	}

	public async stop(): Promise<void> {
		return new Promise((resolve) => {
			this.server.close(() => {
				logger.info("Archetype editor server stopped");
				resolve();
			});
		});
	}
}

export function createArchetypeEditorServer(): ArchetypeEditorServer {
	return new ArchetypeEditorServerImpl();
}
