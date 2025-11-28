/**
 * IO module - networking primitives for the MUD
 *
 * This module provides a small, well-documented wrapper around Node's TCP
 * sockets tailored to the MUD server. It exposes two main primitives:
 *
 * - `MudClient`: a thin EventEmitter wrapper around a client socket that
 *   buffers incoming data into complete lines, normalizes line endings, and
 *   emits `input` events for whole-line input. It also exposes convenience
 *   send methods and lifecycle helpers.
 * - `MudServer`: a TCP server that accepts connections and emits higher-level
 *   events (`connection`, `disconnection`, `listening`, `error`, `close`). It
 *   tracks connected `MudClient` instances and provides start/stop helpers.
 *
 * Typical usage
 * ```ts
 * import { MudServer } from './io.js';
 *
 * const server = new MudServer();
 * server.on('connection', (client) => {
 *   client.on('input', (line) => {
 *     client.sendLine(`You said: ${line}`);
 *   });
 * });
 * await server.start(4000);
 * ```
 *
 * Notes
 * - `MudClient` emits `input` for each newline-terminated line. CR/LF are
 *   normalized and trimmed. Partial lines are buffered until a newline arrives.
 * - All methods are synchronous except `MudServer.start()` and `MudServer.stop()`
 *   which return promises that resolve when the server has started/stopped.
 * - The module intentionally does not perform telnet option negotiation; keep
 *   the socket-level behavior minimal and predictable for tests.
 *
 * @module io
 */

import { EventEmitter } from "events";
import { createServer, Server, Socket } from "net";
import logger from "../logger.js";
import { string } from "mud-ext";
import { colorize as _colorize, stripColors } from "./color.js";
import { LINEBREAK } from "./telnet.js";

export interface MudClient {
	send(text: string, colorize?: boolean): void;
	sendLine(text: string, colorize?: boolean): void;
	close(): void;
	ask(
		question: string,
		callback: (line: string) => void,
		colorize: boolean
	): void;
	yesno(
		question: string,
		callback: (yesorno: boolean | undefined) => void,
		_default?: boolean | undefined
	): void;
	getAddress(): string;
	isConnected(): boolean;
	isLocalhost(): boolean;
	on(event: "input", listener: (line: string) => void): this;
	on(event: "close", listener: () => void): this;
	on(event: "error", listener: (err: Error) => void): this;
	on(event: string, listener: (...args: any[]) => void): this;
	once(event: "input", listener: (line: string) => void): this;
	once(event: "close", listener: () => void): this;
	once(event: "error", listener: (err: Error) => void): this;
	once(event: string, listener: (...args: any[]) => void): this;
	emit(event: "input", line: string): boolean;
	emit(event: "close"): boolean;
	emit(event: "error", err: Error): boolean;
	emit(event: string, ...args: any[]): boolean;
	off(event: "input", listener: (line: string) => void): this;
	off(event: "close", listener: () => void): this;
	off(event: "error", listener: (err: Error) => void): this;
	off(event: string, listener: (...args: any[]) => void): this;
}

/**
 * Represents a connected MUD client.
 *
 * Behavior and events
 * - Buffers incoming data and emits `input` events for complete lines (trimmed).
 * - Emits `close` when the socket closes and `error` on socket errors.
 *
 * Example
 * ```ts
 * client.on('input', (line) => {
 *   console.log(`Received: ${line}`);
 *   client.sendLine(`Echo: ${line}`);
 * });
 * ```
 */
export class StandardMudClient extends EventEmitter implements MudClient {
	private socket: Socket;
	private buffer: string = "";
	// Optional single-shot callback used by Game.nanny() style prompts
	private pendingAskCallback?: (line: string) => void;
	// Track if SGA (Suppress Go Ahead) is negotiated
	private suppressGoAhead: boolean = false;

	toString(): string {
		return `{client@${this.getAddress()}}`;
	}

	constructor(socket: Socket) {
		super();
		this.socket = socket;
		this.setupSocketHandlers();
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

	private setupSocketHandlers(): void {
		this.socket.setEncoding("binary");
		this.socket.on("data", (data: Buffer) => {
			this.handleData(data);
		});

		this.socket.on("close", () => {
			logger.debug(`Client disconnected: ${this.getAddress()}`);
			this.emit("close");
		});

		this.socket.on("error", (error: Error) => {
			logger.error(`Client error (${this.getAddress()}): ${error.message}`);
			this.emit("error", error);
		});

		// Send IAC WILL SGA by default to offer Suppress Go Ahead
		if (!this.socket.destroyed && this.socket.writable) {
			this.socket.write(Buffer.from([0xff, 0xfb, 0x03])); // IAC WILL SGA
			logger.debug(
				`SGA negotiation (${this.getAddress()}): sent IAC WILL SGA (default offer)`
			);
		}
	}

	/**
	 * Handle telnet option negotiations before processing data
	 * @param data Raw binary data from the socket
	 * @returns Buffer with negotiations removed
	 */
	private handleTelnetNegotiations(data: Buffer): Buffer {
		const binary = data.toString("binary");
		let result = binary;

		// Handle IAC DO SGA (0xFF 0xFD 0x03) - client agrees to suppress GA (response to our IAC WILL SGA)
		if (binary.includes("\xff\xfd\x03")) {
			logger.debug(
				`SGA negotiation (${this.getAddress()}): received IAC DO SGA, enabling full-duplex mode`
			);
			this.suppressGoAhead = true;
			// Remove the negotiation from the stream
			result = result.replace(/\xff\xfd\x03/g, "");
		}

		// Handle IAC DON'T SGA (0xFF 0xFE 0x03) - client rejects SGA
		if (binary.includes("\xff\xfe\x03")) {
			logger.debug(
				`SGA negotiation (${this.getAddress()}): received IAC DON'T SGA, SGA not enabled`
			);
			this.suppressGoAhead = false;
			// Respond with IAC WON'T SGA (0xFF 0xFC 0x03)
			if (!this.socket.destroyed && this.socket.writable) {
				this.socket.write(Buffer.from([0xff, 0xfc, 0x03]));
				logger.debug(
					`SGA negotiation (${this.getAddress()}): sent IAC WON'T SGA`
				);
			}
			// Remove the negotiation from the stream
			result = result.replace(/\xff\xfe\x03/g, "");
		}

		return Buffer.from(result, "binary");
	}

	private sanitizeTelnetCommands(input: Buffer): string {
		// Work in binary (latin1) space so every byte is preserved verbatim.
		const binary = input.toString("binary");

		// Remove IAC SB ... IAC SE subnegotiations.
		const noSubNegotiation = binary.replace(/\xff\xfa[\s\S]*?\xff\xf0/g, "");

		// Remove IAC WILL/WONT/DO/DONT <option> negotiations.
		// Note: DO/DON'T SGA are handled separately in handleTelnetNegotiations
		const noNegotiations = noSubNegotiation.replace(/\xff[\xfb-\xfe]./g, "");

		// Remove IAC GA (Go Ahead) - 0xFF 0xF9 (should be suppressed if SGA is enabled)
		const noGoAhead = noNegotiations.replace(/\xff\xf9/g, "");

		// Collapse escaped IAC bytes (IAC IAC -> literal 0xFF).
		const unescaped = noGoAhead.replace(/\xff\xff/g, "\xff");

		return Buffer.from(unescaped, "binary").toString("utf8");
	}

	private handleData(data: Buffer): void {
		// Handle telnet negotiations first (before sanitizing)
		const negotiated = this.handleTelnetNegotiations(data);

		// Then sanitize and process the remaining data
		this.buffer += this.sanitizeTelnetCommands(negotiated);

		// Process complete lines
		let newlineIndex: number;
		while ((newlineIndex = this.buffer.indexOf(LINEBREAK)) !== -1) {
			const line = this.buffer.substring(0, newlineIndex).trim();
			this.buffer = this.buffer.substring(newlineIndex + 1);

			if (true) {
				// If an ask() callback is registered, pipe the input to it and clear
				if (this.pendingAskCallback) {
					const cb = this.pendingAskCallback;
					this.pendingAskCallback = undefined;
					try {
						cb(line);
					} catch (err) {
						logger.error(
							`ask() callback error for ${this.getAddress()}: ${err}`
						);
					}
				} else {
					logger.debug(`Client input (${this.getAddress()}): ${line}`);
					this.emit("input", line);
				}
			}
		}
	}

	/**
	 * Send text to the client
	 * @param text The text to send
	 */
	public send(text: string, colorize: boolean = false): void {
		const escaped = colorize ? _colorize(text) : stripColors(text);
		if (!this.socket.destroyed && this.socket.writable) {
			this.socket.write(escaped);
			// With SGA enabled, we don't need to send GA messages
		}
	}

	/**
	 * Send a line of text to the client (adds newline)
	 * @param text The text to send
	 */
	public sendLine(text: string, colorize: boolean = false): void {
		this.send(text + LINEBREAK, colorize);
	}

	/**
	 * Close the client connection
	 */
	public close(): void {
		if (!this.socket.destroyed) {
			this.socket.destroy();
		}
	}

	/**
	 * Ask for a single line of input and route the next received line
	 * to the provided callback. This supersedes the standard "input"
	 * event for one line only. Subsequent lines will resume normal
	 * event emission unless ask() is called again.
	 */
	public ask(
		question: string,
		callback: (line: string) => void,
		colorize: boolean = false
	) {
		this.send(`${question} `, colorize);
		this.pendingAskCallback = callback;
	}

	public yesno(
		question: string,
		callback: (yesorno: boolean | undefined) => void,
		_default?: boolean | undefined
	) {
		const stem = _default === true ? "Y/n" : _default === false ? "y/N" : "y/n";
		this.ask(`${question} [${stem}]`, (line: string) => {
			// check for "yes"
			if (string.autocomplete(line, "yes")) {
				return callback(true);
			}

			// check for "no"
			if (string.autocomplete(line, "no")) {
				return callback(false);
			}

			// no valid response -- use default
			callback(_default);
		});
	}

	/**
	 * Get the remote address of the client
	 */
	public getAddress(): string {
		return `${this.socket.remoteAddress}:${this.socket.remotePort}`;
	}

	/**
	 * Check if the connection is still open
	 */
	public isConnected(): boolean {
		return !this.socket.destroyed;
	}

	/**
	 * Check if this client is connecting from localhost.
	 * Convenience wrapper around the isLocalhost utility function.
	 *
	 * @returns true if the client is from localhost
	 *
	 * @example
	 * ```typescript
	 * if (client.isLocalhost()) {
	 *   console.log("Local connection detected");
	 * }
	 * ```
	 */
	public isLocalhost(): boolean {
		return isLocalhost(this.getAddress());
	}
}

/**
 * Checks if an address string represents a localhost connection.
 * Handles both IPv4 (127.0.0.1) and IPv6 (::1, ::ffff:127.0.0.1) localhost addresses.
 *
 * @param address The client address string (format: "ip:port")
 * @returns true if the address is from localhost
 *
 * @example
 * ```typescript
 * isLocalhost("127.0.0.1:12345"); // true
 * isLocalhost("::1:12345"); // true
 * isLocalhost("192.168.1.100:12345"); // false
 * ```
 */
export function isLocalhost(address: string): boolean {
	// Extract IP portion (remove port)
	const ip = address.split(":").slice(0, -1).join(":");

	// Check for IPv4 localhost
	if (ip === "127.0.0.1") return true;

	// Check for IPv6 localhost
	if (ip === "::1") return true;

	// Check for IPv6-mapped IPv4 localhost
	if (ip === "::ffff:127.0.0.1") return true;

	return false;
}

/**
 * A lightweight TCP server tailored for the MUD. It exposes the following
 * events: `listening`, `connection` (MudClient), `disconnection` (MudClient),
 * `error`, and `close`.
 *
 * Use `start()` and `stop()` to control the server lifecycle. The server
 * maintains a registry of connected `MudClient` instances and provides simple
 * broadcast helpers.
 *
 * Example
 * ```ts
 * const server = new MudServer();
 * server.on('connection', (client) => {
 *   client.on('input', (line) => client.sendLine(`Echo: ${line}`));
 * });
 * await server.start(4000);
 * ```
 */
export class MudServer extends EventEmitter {
	private server: Server;
	private clients: Set<MudClient> = new Set();
	private port?: number;
	private isListening: boolean = false;

	constructor() {
		super();
		this.server = createServer((socket: Socket) => {
			this.handleConnection(socket);
		});

		this.setupServerHandlers();
	}

	public on(event: "listening", listener: () => void): this;
	public on(event: "connection", listener: (client: MudClient) => void): this;
	public on(
		event: "disconnection",
		listener: (client: MudClient) => void
	): this;
	public on(event: "error", listener: (err: Error) => void): this;
	public on(event: "close", listener: () => void): this;
	public on(event: string, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}

	public once(event: "listening", listener: () => void): this;
	public once(event: "connection", listener: (client: MudClient) => void): this;
	public once(
		event: "disconnection",
		listener: (client: MudClient) => void
	): this;
	public once(event: "error", listener: (err: Error) => void): this;
	public once(event: "close", listener: () => void): this;
	public once(event: string, listener: (...args: any[]) => void): this {
		return super.once(event, listener);
	}

	public emit(event: "listening"): boolean;
	public emit(event: "connection", client: MudClient): boolean;
	public emit(event: "disconnection", client: MudClient): boolean;
	public emit(event: "error", err: Error): boolean;
	public emit(event: "close"): boolean;
	public emit(event: string, ...args: any[]): boolean {
		return super.emit(event, ...args);
	}

	public off(event: "listening", listener: () => void): this;
	public off(event: "connection", listener: (client: MudClient) => void): this;
	public off(
		event: "disconnection",
		listener: (client: MudClient) => void
	): this;
	public off(event: "error", listener: (err: Error) => void): this;
	public off(event: "close", listener: () => void): this;
	public off(event: string, listener: (...args: any[]) => void): this {
		return super.off(event, listener);
	}

	private setupServerHandlers(): void {
		this.server.on("listening", (port: number, host: string) => {
			this.isListening = true;
			logger.info(`MUD server listening on ${host}:${this.port}`);
			this.emit("listening");
		});

		this.server.on("error", (error: Error) => {
			logger.error(`Server error: ${error.message}`);
			this.emit("error", error);
		});

		this.server.on("close", () => {
			this.isListening = false;
			logger.info("MUD server closed");
			this.emit("close");
		});
	}

	private handleConnection(socket: Socket): void {
		const client = new StandardMudClient(socket);
		this.clients.add(client);

		logger.info(
			`Client connected: ${client.getAddress()} (${this.clients.size} total)`
		);
		this.emit("connection", client);

		client.on("close", () => {
			this.clients.delete(client);
			logger.info(
				`Client disconnected: ${client.getAddress()} (${
					this.clients.size
				} remaining)`
			);
			this.emit("disconnection", client);
		});

		client.on("error", (err) => {
			logger.info(`Client error: ${err}`);
		});
	}

	/**
	 * Start the server on the specified port
	 * @param port The port number to listen on
	 * @param host Optional host to bind to (defaults to all interfaces, use "127.0.0.1" for localhost only)
	 */
	public start(port: number, host?: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.isListening) {
				reject(new Error("Server is already listening"));
				return;
			}

			this.port = port;
			this.server.once("error", reject);
			this.server.listen(port, host, () => {
				this.server.removeListener("error", reject);
				const bindInfo = host ? `${host}:${port}` : `port ${port}`;
				resolve();
			});
		});
	}

	/**
	 * Stop the server and disconnect all clients
	 */
	public async stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			logger.debug("MudServer.stop() called");
			if (!this.isListening) {
				logger.debug("Server not listening, resolving immediately");
				resolve();
				return;
			}

			logger.debug(`Closing ${this.clients.size} client connections`);
			// Close all client connections
			for (const client of this.clients) {
				logger.debug(`Closing ${client}`);
				client.close();
			}
			logger.debug("All clients closed, calling server.close()");

			this.server.close((err) => {
				if (err) {
					logger.debug(`Server.close() error: ${err.message}`);
					reject(err);
				} else {
					logger.debug("Server.close() completed successfully");
					resolve();
				}
			});
		});
	}

	/**
	 * Get all connected clients
	 */
	public getClients(): MudClient[] {
		return Array.from(this.clients);
	}

	/**
	 * Get the number of connected clients
	 */
	public getClientCount(): number {
		return this.clients.size;
	}

	/**
	 * Get the port the server is listening on
	 * @returns The port number, or undefined if the server hasn't been started yet
	 */
	public getPort(): number | undefined {
		return this.port;
	}

	/**
	 * Check if the server is currently listening
	 */
	public isRunning(): boolean {
		return this.isListening;
	}

	/**
	 * Broadcast a message to all connected clients
	 * @param text The text to send to all clients
	 */
	public broadcast(text: string): void {
		for (const client of this.clients) {
			client.send(text, false);
		}
	}

	/**
	 * Broadcast a line to all connected clients
	 * @param text The text to send to all clients
	 */
	public broadcastLine(text: string): void {
		for (const client of this.clients) {
			client.sendLine(text, false);
		}
	}
}
