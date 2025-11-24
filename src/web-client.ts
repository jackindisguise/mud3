/**
 * Web-based MUD client server
 *
 * Provides a web interface for connecting to the MUD via WebSocket.
 * Serves an HTML client and bridges WebSocket connections to MudClient.
 *
 * @module web-client
 */

import { createServer, Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { EventEmitter } from "events";
import logger from "./logger.js";
import { MudClient } from "./io.js";
import { LINEBREAK } from "./telnet.js";
import {
	stripColors,
	COLOR_ESCAPE,
	COLOR,
	COLOR_TAG,
	TEXT_STYLE,
	TEXT_STYLE_TAG,
} from "./color.js";
import { getSafeRootDirectory } from "./utils/path.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Map color tag letters to CSS class names
 */
const HTML_COLOR_MAP: Record<string, string> = {
	[COLOR_TAG[COLOR.BLACK]]: "color-black",
	[COLOR_TAG[COLOR.MAROON]]: "color-maroon",
	[COLOR_TAG[COLOR.DARK_GREEN]]: "color-dark-green",
	[COLOR_TAG[COLOR.OLIVE]]: "color-olive",
	[COLOR_TAG[COLOR.DARK_BLUE]]: "color-dark-blue",
	[COLOR_TAG[COLOR.PURPLE]]: "color-purple",
	[COLOR_TAG[COLOR.TEAL]]: "color-teal",
	[COLOR_TAG[COLOR.SILVER]]: "color-silver",
	[COLOR_TAG[COLOR.GREY]]: "color-grey",
	[COLOR_TAG[COLOR.CRIMSON]]: "color-crimson",
	[COLOR_TAG[COLOR.LIME]]: "color-lime",
	[COLOR_TAG[COLOR.YELLOW]]: "color-yellow",
	[COLOR_TAG[COLOR.LIGHT_BLUE]]: "color-light-blue",
	[COLOR_TAG[COLOR.PINK]]: "color-pink",
	[COLOR_TAG[COLOR.CYAN]]: "color-cyan",
	[COLOR_TAG[COLOR.WHITE]]: "color-white",
	[TEXT_STYLE_TAG[TEXT_STYLE.BOLD]]: "bold",
	[TEXT_STYLE_TAG[TEXT_STYLE.ITALIC]]: "italic",
	[TEXT_STYLE_TAG[TEXT_STYLE.UNDERLINE]]: "underline",
	[TEXT_STYLE_TAG[TEXT_STYLE.BLINK]]: "", // Not supported in CSS
	[TEXT_STYLE_TAG[TEXT_STYLE.REVERSE]]: "", // Not supported in CSS
	[TEXT_STYLE_TAG[TEXT_STYLE.STRIKETHROUGH]]: "", // Could add if needed
	[TEXT_STYLE_TAG[TEXT_STYLE.RESET_ALL]]: "", // Reset code
	[TEXT_STYLE_TAG[TEXT_STYLE.RESET_ALL_UPPERCASE]]: "", // Reset code
};

/**
 * Convert {letter color codes to HTML spans for web clients
 * Format: {letter (no closing brace)
 *
 * Every color code colors until the NEXT color code OR until the end of the string OR until a reset color code.
 * Reset color codes should not produce anything (just close the current span).
 *
 * Example: "{Rthis is {ca string." becomes
 * "<span class='color-crimson'>this is </span><span class='color-teal'>a string.</span>"
 */
function colorizeForWeb(text: string): string {
	const colorMap = HTML_COLOR_MAP;

	let result = "";
	let i = 0;
	let currentSpan: { className: string; text: string } | null = null;

	while (i < text.length) {
		if (text[i] === COLOR_ESCAPE) {
			// Check for escaped {{ (two consecutive {)
			if (i + 1 < text.length && text[i + 1] === COLOR_ESCAPE) {
				if (currentSpan) {
					currentSpan.text += COLOR_ESCAPE;
				} else {
					result += COLOR_ESCAPE;
				}
				i += 2;
				continue;
			}

			// Get the next character (the color code letter)
			if (i + 1 >= text.length) {
				// No character after {, treat as literal
				if (currentSpan) {
					currentSpan.text += text[i];
				} else {
					result += text[i];
				}
				i++;
				continue;
			}

			const code = text[i + 1];
			const className = colorMap[code];

			// Close current span if it exists
			if (currentSpan) {
				result += `<span class="${currentSpan.className}">${currentSpan.text}</span>`;
				currentSpan = null;
			}

			if (className === "") {
				// Reset code - don't start a new span, just close the previous one
				// (already closed above)
			} else if (className) {
				// Valid color/style code - start new span
				currentSpan = { className, text: "" };
			}
			// Unknown codes are ignored

			i += 2; // Skip both { and the letter
		} else {
			// Regular character
			if (currentSpan) {
				currentSpan.text += text[i];
			} else {
				result += text[i];
			}
			i++;
		}
	}

	// Close any remaining span
	if (currentSpan) {
		result += `<span class="${currentSpan.className}">${currentSpan.text}</span>`;
	}

	return result;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * WebSocket adapter that provides MudClient-compatible interface
 */
class WebSocketMudClient extends EventEmitter implements MudClient {
	private ws: WebSocket;
	private address: string;
	private pendingAskCallback?: (line: string) => void;

	constructor(ws: WebSocket, address: string) {
		super();
		this.ws = ws;
		this.address = address;

		ws.on("message", (data: Buffer) => {
			const text = data.toString("utf8");
			// Handle input
			if (this.pendingAskCallback) {
				const cb = this.pendingAskCallback;
				this.pendingAskCallback = undefined;
				try {
					cb(text.trim());
				} catch (err) {
					logger.error(`ask() callback error for ${this.address}: ${err}`);
				}
			} else {
				this.emit("input", text.trim());
			}
		});

		ws.on("close", () => {
			this.emit("close");
		});

		ws.on("error", (err: Error) => {
			logger.error(`WebSocket error (${this.address}): ${err.message}`);
			this.emit("error", err);
		});
	}

	public on(event: "input", listener: (line: string) => void): this;
	public on(event: "close", listener: () => void): this;
	public on(event: "error", listener: (err: Error) => void): this;
	public on(event: string, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}

	public once(event: "input", listener: (line: string) => void): this;
	public once(event: "close", listener: () => void): this;
	public once(event: "error", listener: (err: Error) => void): this;
	public once(event: string, listener: (...args: any[]) => void): this {
		return super.once(event, listener);
	}

	public emit(event: "input", line: string): boolean;
	public emit(event: "close"): boolean;
	public emit(event: "error", err: Error): boolean;
	public emit(event: string, ...args: any[]): boolean {
		return super.emit(event, ...args);
	}

	public off(event: "input", listener: (line: string) => void): this;
	public off(event: "close", listener: () => void): this;
	public off(event: "error", listener: (err: Error) => void): this;
	public off(event: string, listener: (...args: any[]) => void): this {
		return super.off(event, listener);
	}

	public send(
		text: string,
		colorize: boolean = false,
		className: string = "prompt"
	): void {
		if (this.ws.readyState === WebSocket.OPEN) {
			// First escape HTML in the text content (especially < and >)
			const escaped = escapeHtml(text);
			// Then convert {letter color codes to HTML spans for web clients
			const formatted = colorize
				? colorizeForWeb(escaped)
				: stripColors(escaped);

			// Wrap in div with the specified class
			const wrapped = `<div class="${className}">${formatted}</div>`;

			this.ws.send(wrapped);
		}
	}

	public sendLine(text: string, colorize: boolean = false): void {
		const lines = text.split(LINEBREAK);
		for (let line of lines) this.send(line, colorize, "line");
	}

	public close(): void {
		if (this.ws.readyState !== WebSocket.CLOSED) {
			this.ws.close();
		}
	}

	public ask(
		question: string,
		callback: (line: string) => void,
		colorize: boolean = false
	): void {
		this.send(`${question} `, colorize);
		this.pendingAskCallback = callback;
	}

	public yesno(
		question: string,
		callback: (yesorno: boolean | undefined) => void,
		_default?: boolean | undefined
	): void {
		const stem = _default === true ? "Y/n" : _default === false ? "y/N" : "y/n";
		this.ask(`${question} [${stem}]`, (line: string) => {
			const lower = line.toLowerCase().trim();
			if (lower === "yes" || lower === "y") {
				return callback(true);
			}
			if (lower === "no" || lower === "n") {
				return callback(false);
			}
			callback(_default);
		});
	}

	public getAddress(): string {
		return this.address;
	}

	public isConnected(): boolean {
		return this.ws.readyState === WebSocket.OPEN;
	}

	public isLocalhost(): boolean {
		return this.address.includes("127.0.0.1") || this.address.includes("::1");
	}

	public toString(): string {
		return `{client@${this.address}}`;
	}
}

/**
 * Web client server that serves HTML and handles WebSocket connections
 */
export class WebClientServer extends EventEmitter {
	private httpServer: HttpServer;
	private wsServer: WebSocketServer;
	private port: number;
	private isRunning: boolean = false;

	constructor(port: number = 8080) {
		super();
		this.port = port;
		this.httpServer = createServer((req, res) => {
			this.handleHttpRequest(req, res);
		});
		this.wsServer = new WebSocketServer({ server: this.httpServer });
		this.wsServer.on("connection", (ws: WebSocket, req) => {
			this.handleWebSocketConnection(ws, req);
		});
	}

	/**
	 * Start the web client server
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			throw new Error("Web client server is already running");
		}

		return new Promise((resolve, reject) => {
			this.httpServer.listen(this.port, () => {
				this.isRunning = true;
				logger.info(
					`Web client server listening on http://localhost:${this.port}`
				);
				resolve();
			});
			this.httpServer.once("error", reject);
		});
	}

	/**
	 * Stop the web client server
	 */
	async stop(): Promise<void> {
		if (!this.isRunning) return;

		return new Promise((resolve) => {
			this.wsServer.close(() => {
				this.httpServer.close(() => {
					this.isRunning = false;
					logger.info("Web client server stopped");
					resolve();
				});
			});
		});
	}

	/**
	 * Handle HTTP requests - serve the HTML client and static assets on demand
	 */
	private async handleHttpRequest(req: any, res: any): Promise<void> {
		const url = req.url || "/";
		const rootDir = getSafeRootDirectory();

		if (url === "/" || url === "/index.html") {
			try {
				const htmlPath = join(rootDir, "web-client", "index.html");
				const html = await readFile(htmlPath, "utf-8");
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(html);
			} catch (error) {
				logger.error(`Failed to load web client HTML: ${error}`);
				res.writeHead(500, { "Content-Type": "text/plain" });
				res.end("Failed to load web client HTML");
			}
		} else if (url === "/style.css") {
			try {
				const cssPath = join(rootDir, "web-client", "style.css");
				const css = await readFile(cssPath, "utf-8");
				res.writeHead(200, { "Content-Type": "text/css" });
				res.end(css);
			} catch (error) {
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("CSS file not found");
			}
		} else if (url === "/client.js") {
			try {
				const jsPath = join(rootDir, "web-client", "client.js");
				const js = await readFile(jsPath, "utf-8");
				res.writeHead(200, { "Content-Type": "application/javascript" });
				res.end(js);
			} catch (error) {
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("JavaScript file not found");
			}
		} else {
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not found");
		}
	}

	/**
	 * Handle new WebSocket connection
	 */
	private handleWebSocketConnection(ws: WebSocket, req: any): void {
		const address = req.socket.remoteAddress || "unknown";
		logger.info(`Web client connected: ${address}`);

		const client = new WebSocketMudClient(ws, `websocket:${address}`);
		this.emit("connection", client);

		client.on("close", () => {
			logger.info(`Web client disconnected: ${address}`);
			this.emit("disconnection", client);
		});
	}
}
