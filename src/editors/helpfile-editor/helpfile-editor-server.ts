/**
 * Helpfile Editor HTTP Server
 *
 * Provides a web-based interface for editing helpfiles, including:
 * - Helpfile management
 * - YAML editing with validation
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile, access } from "fs/promises";
import { join } from "path";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../../logger.js";
import {
	createHelpfileEditorService,
	HelpfileEditorService,
} from "./helpfile-editor-service.js";
import { getSafeRootDirectory } from "../../utils/path.js";

const PORT = 3002; // Different port from archetype editor (3001) and map editor (3000)
const ROOT_DIRECTORY = getSafeRootDirectory();
const HELPFILE_EDITOR_DIR = join(ROOT_DIRECTORY, "editors", "helpfile-editor");

// Verify helpfile editor directory exists at startup (async check)
access(HELPFILE_EDITOR_DIR, FS_CONSTANTS.F_OK)
	.then(() => {
		logger.debug(`Helpfile editor directory found: ${HELPFILE_EDITOR_DIR}`);
	})
	.catch((error) => {
		logger.error(`Helpfile editor directory not found: ${HELPFILE_EDITOR_DIR}`);
		logger.error(`Current working directory: ${ROOT_DIRECTORY}`);
	});

interface HelpfileEditorServer {
	server: ReturnType<typeof createServer>;
	start(): Promise<void>;
	stop(): Promise<void>;
}

class HelpfileEditorServerImpl implements HelpfileEditorServer {
	private readonly service: HelpfileEditorService;
	public server = createServer(this.handleRequest.bind(this));

	constructor(service: HelpfileEditorService = createHelpfileEditorService()) {
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
				const filePath = join(HELPFILE_EDITOR_DIR, "index.html");
				logger.debug(`Serving index.html from: ${filePath}`);
				await this.serveFile(res, filePath, "text/html");
				return;
			}

			if (path.startsWith("/static/")) {
				const filePath = path.replace("/static/", "");
				const fullPath = join(HELPFILE_EDITOR_DIR, "static", filePath);
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
			// List helpfiles
			if (path === "/api/helpfiles" && req.method === "GET") {
				await this.listHelpfiles(res);
				return;
			}

			// Get helpfile
			if (path.startsWith("/api/helpfiles/") && req.method === "GET") {
				const id = path.split("/")[3];
				await this.getHelpfile(res, id);
				return;
			}

			// Create helpfile
			if (path.startsWith("/api/helpfiles/") && req.method === "POST") {
				const id = path.split("/")[3];
				await this.createHelpfile(req, res, id);
				return;
			}

			// Update helpfile
			if (path.startsWith("/api/helpfiles/") && req.method === "PUT") {
				const id = path.split("/")[3];
				await this.updateHelpfile(req, res, id);
				return;
			}

			// Delete helpfile
			if (path.startsWith("/api/helpfiles/") && req.method === "DELETE") {
				const id = path.split("/")[3];
				await this.deleteHelpfile(res, id);
				return;
			}

			// 404
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not Found");
		} catch (error) {
			logger.error(`Helpfile editor server error: ${error}`);
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

	private async listHelpfiles(res: ServerResponse): Promise<void> {
		try {
			const result = await this.service.listHelpfiles();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			logger.error(`Failed to list helpfiles: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async getHelpfile(res: ServerResponse, id: string): Promise<void> {
		try {
			const data = await this.service.getHelpfile(id);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(data));
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Helpfile not found" }));
			} else {
				logger.error(`Failed to read helpfile ${id}: ${error}`);
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: String(error) }));
			}
		}
	}

	private async createHelpfile(
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
			const result = await this.service.createHelpfile({
				id,
				yaml: data.yaml,
			});
			res.writeHead(201, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.message === "Helpfile already exists") {
				res.writeHead(409, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			if (err.message === "YAML data is required for helpfile creation") {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			logger.error(`Failed to create helpfile ${id}: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async updateHelpfile(
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
			const result = await this.service.updateHelpfile({
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
			logger.error(`Failed to update helpfile ${id}: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	private async deleteHelpfile(res: ServerResponse, id: string): Promise<void> {
		try {
			const result = await this.service.deleteHelpfile(id);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result));
		} catch (error) {
			const err = error as Error;
			if (err.message === "Helpfile not found") {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: err.message }));
				return;
			}
			logger.error(`Failed to delete helpfile ${id}: ${error}`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	}

	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.server.listen(PORT, () => {
				logger.info(
					`Helpfile editor server listening on http://localhost:${PORT}`
				);
				resolve();
			});
			this.server.once("error", reject);
		});
	}

	public async stop(): Promise<void> {
		return new Promise((resolve) => {
			this.server.close(() => {
				logger.info("Helpfile editor server stopped");
				resolve();
			});
		});
	}
}

export function createHelpfileEditorServer(): HelpfileEditorServer {
	return new HelpfileEditorServerImpl();
}
