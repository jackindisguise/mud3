import { EventEmitter } from "events";
import { createServer, Server, Socket } from "net";
import logger from "./logger.js";

/**
 * Represents a connected MUD client
 */
export class MudClient extends EventEmitter {
	private socket: Socket;
	private buffer: string = "";

	constructor(socket: Socket) {
		super();
		this.socket = socket;
		this.setupSocketHandlers();
	}

	private setupSocketHandlers(): void {
		this.socket.setEncoding("utf8");

		this.socket.on("data", (data: string) => {
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
	}

	private handleData(data: string): void {
		this.buffer += data;

		// Process complete lines
		let newlineIndex: number;
		while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
			const line = this.buffer.substring(0, newlineIndex).trim();
			this.buffer = this.buffer.substring(newlineIndex + 1);

			if (line.length > 0) {
				logger.debug(`Client input (${this.getAddress()}): ${line}`);
				this.emit("input", line);
			}
		}
	}

	/**
	 * Send text to the client
	 * @param text The text to send
	 */
	public send(text: string): void {
		if (!this.socket.destroyed) {
			this.socket.write(text);
		}
	}

	/**
	 * Send a line of text to the client (adds newline)
	 * @param text The text to send
	 */
	public sendLine(text: string): void {
		this.send(text + "\r\n");
	}

	/**
	 * Close the client connection
	 */
	public close(): void {
		if (!this.socket.destroyed) {
			this.socket.end();
		}
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
}

/**
 * MUD server that accepts socket connections
 */
export class MudServer extends EventEmitter {
	private server: Server;
	private clients: Set<MudClient> = new Set();
	private port: number;
	private isListening: boolean = false;

	constructor(port: number = 4000) {
		super();
		this.port = port;
		this.server = createServer((socket: Socket) => {
			this.handleConnection(socket);
		});

		this.setupServerHandlers();
	}

	private setupServerHandlers(): void {
		this.server.on("listening", () => {
			this.isListening = true;
			logger.info(`MUD server listening on port ${this.port}`);
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
		const client = new MudClient(socket);
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
	 * Start the server
	 */
	public start(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.isListening) {
				reject(new Error("Server is already listening"));
				return;
			}

			this.server.once("error", reject);
			this.server.listen(this.port, () => {
				this.server.removeListener("error", reject);
				resolve();
			});
		});
	}

	/**
	 * Stop the server and disconnect all clients
	 */
	public stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.isListening) {
				resolve();
				return;
			}

			// Close all client connections
			for (const client of this.clients) {
				client.close();
			}

			this.server.close((err) => {
				if (err) {
					reject(err);
				} else {
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
	 */
	public getPort(): number {
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
			client.send(text);
		}
	}

	/**
	 * Broadcast a line to all connected clients
	 * @param text The text to send to all clients
	 */
	public broadcastLine(text: string): void {
		for (const client of this.clients) {
			client.sendLine(text);
		}
	}
}
