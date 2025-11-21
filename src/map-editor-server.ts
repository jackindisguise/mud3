/**
 * Map Editor HTTP Server
 *
 * Provides a web-based interface for editing dungeons, including:
 * - Room template management
 * - Mob/object template management
 * - Grid-based map editing
 * - Reset management
 * - Dimension editing with confirmation
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile, access } from "fs/promises";
import { join } from "path";
import { constants as FS_CONSTANTS } from "fs";
import logger from "./logger.js";
import {
	createMapEditorService,
	MapEditorService,
} from "./map-editor-service.js";
import { getSafeRootDirectory } from "./utils/path.js";

const PORT = 3000;
const ROOT_DIRECTORY = getSafeRootDirectory();
const MAP_EDITOR_DIR = join(ROOT_DIRECTORY, "map-editor");

// Verify map editor directory exists at startup (async check)
access(MAP_EDITOR_DIR, FS_CONSTANTS.F_OK)
	.then(() => {
		logger.debug(`Map editor directory found: ${MAP_EDITOR_DIR}`);
	})
	.catch((error) => {
		logger.error(`Map editor directory not found: ${MAP_EDITOR_DIR}`);
		logger.error(`Current working directory: ${ROOT_DIRECTORY}`);
	});

interface MapEditorServer {
	server: ReturnType<typeof createServer>;
	start(): Promise<void>;
	stop(): Promise<void>;
}

class MapEditorServerImpl implements MapEditorServer {
	private readonly service: MapEditorService;
	public server = createServer(this.handleRequest.bind(this));

	constructor(service: MapEditorService = createMapEditorService()) {
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
				const filePath = join(MAP_EDITOR_DIR, "index.html");
				logger.debug(`Serving index.html from: ${filePath}`);
				await this.serveFile(res, filePath, "text/html");
				return;
			}

			if (path.startsWith("/static/")) {
				const filePath = path.replace("/static/", "");
				const fullPath = join(MAP_EDITOR_DIR, "static", filePath);
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
			if (path === "/api/dungeons" && req.method === "GET") {
				await this.listDungeons(res);
				return;
			}

			if (path.startsWith("/api/dungeons/") && req.method === "GET") {
				const id = path.split("/")[3];
				await this.getDungeon(res, id);
				return;
			}

			if (path.startsWith("/api/dungeons/") && req.method === "POST") {
				const id = path.split("/")[3];
				await this.createDungeon(req, res, id);
				return;
			}

			if (path.startsWith("/api/dungeons/") && req.method === "PUT") {
				const id = path.split("/")[3];
				await this.updateDungeon(req, res, id);
				return;
			}

			if (path === "/api/races" && req.method === "GET") {
				await this.getRaces(res);
				return;
			}

			if (path === "/api/jobs" && req.method === "GET") {
				await this.getJobs(res);
				return;
			}

			if (path === "/api/calculate-attributes" && req.method === "POST") {
				await this.calculateAttributes(req, res);
				return;
			}

			if (path === "/api/hit-types" && req.method === "GET") {
				await this.getHitTypes(res);
				return;
			}

			// 404
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not Found");
		} catch (error) {
			logger.error(`Map editor server error: ${error}`);
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

	private async listDungeons(res: ServerResponse): Promise<void> {
		const ids = await this.service.listDungeons();
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify(ids));
	}

	private async getDungeon(res: ServerResponse, id: string): Promise<void> {
		try {
			const data = await this.service.getDungeon(id);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(data));
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Dungeon not found" }));
			} else {
				logger.error(`Failed to read dungeon ${id}: ${error}`);
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: String(error) }));
			}
		}
	}

	private async createDungeon(
		req: IncomingMessage,
		res: ServerResponse,
		id: string
	): Promise<void> {
		let body = "";
		for await (const chunk of req) {
			body += chunk;
		}

		const data = JSON.parse(body);

		try {
			const result = await this.service.createDungeon({
				id,
				yaml: data.yaml,
			});
			res.writeHead(201, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") {
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: String(error) }));
				return;
			}
			if (err.message === "Dungeon already exists") {
				res.writeHead(409, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			if (err.message === "YAML data is required for dungeon creation") {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			logger.error(`Failed to create dungeon ${id}: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async updateDungeon(
		req: IncomingMessage,
		res: ServerResponse,
		id: string
	): Promise<void> {
		let body = "";
		for await (const chunk of req) {
			body += chunk;
		}

		const data = JSON.parse(body);

		try {
			const result = await this.service.updateDungeon({
				id,
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
			logger.error(`Failed to update dungeon ${id}: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async getRaces(res: ServerResponse): Promise<void> {
		try {
			const races = await this.service.getRaces();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(races));
		} catch (error) {
			logger.error(`Failed to get races: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async getJobs(res: ServerResponse): Promise<void> {
		try {
			const jobs = await this.service.getJobs();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(jobs));
		} catch (error) {
			logger.error(`Failed to get jobs: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async calculateAttributes(
		req: IncomingMessage,
		res: ServerResponse
	): Promise<void> {
		let body = "";
		for await (const chunk of req) {
			body += chunk;
		}

		try {
			const data = JSON.parse(body);
			const result = await this.service.calculateAttributes({
				raceId: data.raceId,
				jobId: data.jobId,
				level: data.level,
			});
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			logger.error(`Failed to calculate attributes: ${error}`);
			const err = error as Error;
			res.writeHead(400, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: err.message }));
		}
	}

	private async getHitTypes(res: ServerResponse): Promise<void> {
		try {
			const data = await this.service.getHitTypes();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(data));
		} catch (error) {
			logger.error(`Failed to get hit types: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.server.listen(PORT, () => {
				logger.info(`Map editor server listening on http://localhost:${PORT}`);
				resolve();
			});
			this.server.once("error", reject);
		});
	}

	public async stop(): Promise<void> {
		return new Promise((resolve) => {
			this.server.close(() => {
				logger.info("Map editor server stopped");
				resolve();
			});
		});
	}
}

export function createMapEditorServer(): MapEditorServer {
	return new MapEditorServerImpl();
}
