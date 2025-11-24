/**
 * Instance Manager - Proxy server and game instance management
 *
 * The instance manager acts as a proxy between clients and the game server.
 * It manages game server instances, handles crashes with keep-alive, and
 * coordinates copyover operations.
 *
 * @module instance-manager
 */

import { createServer, Server, Socket, connect } from "net";
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import logger from "./logger.js";
import { CONFIG } from "./package/config.js";
import { MudClient } from "./io.js";

export interface ClientCharacterPair {
	clientId: string;
	username: string;
}

export interface CopyoverData {
	pairs: ClientCharacterPair[];
}

/**
 * Instance Manager that proxies connections to game server instances
 * and manages copyover operations.
 */
export class InstanceManager extends EventEmitter {
	private proxyServer: Server;
	private controlServer: Server;
	private gameProcess?: ChildProcess;
	private gamePort: number;
	private proxyPort: number;
	private controlPort: number;
	private isRunning: boolean = false;
	private connectedClients: Map<Socket, Socket> = new Map(); // proxy socket -> game socket
	private crashCount: number = 0;
	private readonly MAX_CONSECUTIVE_CRASHES = 5;
	private copyoverData?: CopyoverData;
	private isCopyoverInProgress: boolean = false;
	private copyoverDataByClient: Map<string, ClientCharacterPair> = new Map();

	constructor() {
		super();
		this.proxyServer = createServer((socket) => {
			this.handleProxyConnection(socket);
		});
		this.controlServer = createServer((socket) => {
			this.handleControlConnection(socket);
		});
		this.gamePort = CONFIG.server.port;
		// Use a different port for the proxy, or use the same port if game runs on different port
		// For now, we'll use the same port and the game will run on a different internal port
		this.proxyPort = CONFIG.server.port;
		this.controlPort = this.proxyPort + 100; // Control port for game-instance manager communication
	}

	/**
	 * Start the instance manager: start proxy server and spawn game instance
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			throw new Error("Instance manager is already running");
		}

		logger.info("Starting instance manager...");
		this.isRunning = true;

		// Start proxy server (bind to all interfaces so it's publicly accessible)
		await new Promise<void>((resolve, reject) => {
			this.proxyServer.listen(this.proxyPort, "0.0.0.0", () => {
				logger.info(
					`Instance manager proxy listening on port ${this.proxyPort} (all interfaces)`
				);
				resolve();
			});
			this.proxyServer.on("error", reject);
		});

		// Start control server (bind to localhost only for security)
		await new Promise<void>((resolve, reject) => {
			this.controlServer.listen(this.controlPort, "127.0.0.1", () => {
				logger.info(
					`Instance manager control server listening on port ${this.controlPort} (localhost only)`
				);
				resolve();
			});
			this.controlServer.on("error", reject);
		});

		// Spawn initial game instance
		await this.spawnGameInstance();
	}

	/**
	 * Stop the instance manager and game instance
	 */
	async stop(): Promise<void> {
		if (!this.isRunning) return;

		logger.info("Stopping instance manager...");
		this.isRunning = false;

		// Close all proxy connections
		for (const [proxySocket] of this.connectedClients) {
			proxySocket.destroy();
		}
		this.connectedClients.clear();

		// Stop game instance
		if (this.gameProcess) {
			await this.stopGameInstance();
		}

		// Close control server
		await new Promise<void>((resolve) => {
			this.controlServer.close(() => {
				logger.info("Instance manager control server closed");
				resolve();
			});
		});

		// Close proxy server
		await new Promise<void>((resolve) => {
			this.proxyServer.close(() => {
				logger.info("Instance manager proxy server closed");
				resolve();
			});
		});
	}

	/**
	 * Spawn a new game server instance
	 */
	private async spawnGameInstance(): Promise<void> {
		if (this.gameProcess && !this.gameProcess.killed) {
			logger.warn("Game process already running, not spawning new one");
			return;
		}

		logger.info("Spawning game server instance...");

		// Spawn game process
		// The game will run on a different internal port (gamePort + 1)
		// We'll need to modify the game to accept a port override
		const gameInternalPort = this.gamePort + 1;
		const env = {
			...process.env,
			GAME_INTERNAL_PORT: gameInternalPort.toString(),
			INSTANCE_MANAGER_MODE: "true",
			INSTANCE_MANAGER_CONTROL_PORT: this.controlPort.toString(),
		};

		this.gameProcess = spawn(process.execPath, ["dist/index.js"], {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		// Handle game process output
		this.gameProcess.stdout?.on("data", (data) => {
			process.stdout.write(`[GAME] ${data}`);
		});

		this.gameProcess.stderr?.on("data", (data) => {
			process.stderr.write(`[GAME] ${data}`);
		});

		// Handle game process exit
		this.gameProcess.on("exit", (code, signal) => {
			logger.warn(`Game process exited with code ${code}, signal ${signal}`);
			this.gameProcess = undefined;

			// If not intentionally stopped and not during copyover, restart
			if (this.isRunning && !this.isCopyoverInProgress) {
				this.crashCount++;
				if (this.crashCount >= this.MAX_CONSECUTIVE_CRASHES) {
					logger.error(
						`Game crashed ${this.crashCount} times consecutively. Shutting down instance manager.`
					);
					this.stop();
					process.exit(1);
				} else {
					logger.info(
						`Game crashed. Restarting... (${this.crashCount}/${this.MAX_CONSECUTIVE_CRASHES})`
					);
					// Wait a bit before restarting
					setTimeout(() => {
						if (this.isRunning) {
							this.spawnGameInstance();
						}
					}, 1000);
				}
			} else {
				// Reset crash count on successful shutdown
				this.crashCount = 0;
			}
		});

		// Wait a moment for game to start
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Reset crash count on successful spawn
		this.crashCount = 0;
	}

	/**
	 * Stop the current game instance
	 */
	private async stopGameInstance(): Promise<void> {
		if (!this.gameProcess) return;

		logger.info("Stopping game instance...");

		// Close all connections to game
		for (const [, gameSocket] of this.connectedClients) {
			gameSocket.destroy();
		}

		// Kill game process
		return new Promise<void>((resolve) => {
			if (this.gameProcess) {
				this.gameProcess.once("exit", () => {
					logger.info("Game instance stopped");
					resolve();
				});
				this.gameProcess.kill("SIGTERM");
				// Force kill after timeout
				setTimeout(() => {
					if (this.gameProcess && !this.gameProcess.killed) {
						this.gameProcess.kill("SIGKILL");
					}
					resolve();
				}, 5000);
			} else {
				resolve();
			}
		});
	}

	/**
	 * Handle a new connection to the proxy server
	 */
	private handleProxyConnection(proxySocket: Socket): void {
		const clientAddress = `${proxySocket.remoteAddress}:${proxySocket.remotePort}`;
		logger.info(`Proxy connection from ${clientAddress}`);

		// Check if this client has copyover data
		const copyoverPair = this.copyoverDataByClient.get(clientAddress);
		const hasCopyoverData = !!copyoverPair;

		// Connect to game server
		const gameSocket = new Socket();
		const gameInternalPort = this.gamePort + 1;

		gameSocket.connect(gameInternalPort, "127.0.0.1", () => {
			logger.debug(`Connected proxy client ${clientAddress} to game server`);
			this.connectedClients.set(proxySocket, gameSocket);

			// If this client has copyover data, send it to the game via control connection
			if (hasCopyoverData) {
				logger.debug(
					`Notifying game about copyover data for client ${clientAddress} (${copyoverPair.username})`
				);
				// Send copyover data via control connection
				this.sendCopyoverDataToGame(clientAddress, copyoverPair);
			}

			// Forward data from proxy to game
			proxySocket.on("data", (data) => {
				if (gameSocket.writable) {
					gameSocket.write(data);
				}
			});

			// Forward data from game to proxy
			gameSocket.on("data", (data) => {
				if (proxySocket.writable) {
					proxySocket.write(data);
				}
			});

			// Handle disconnections
			const cleanup = () => {
				this.connectedClients.delete(proxySocket);
				if (!proxySocket.destroyed) proxySocket.destroy();
				if (!gameSocket.destroyed) gameSocket.destroy();
			};

			proxySocket.on("close", cleanup);
			proxySocket.on("error", (err) => {
				logger.debug(`Proxy socket error for ${clientAddress}: ${err.message}`);
				cleanup();
			});

			gameSocket.on("close", cleanup);
			gameSocket.on("error", (err) => {
				logger.debug(`Game socket error for ${clientAddress}: ${err.message}`);
				cleanup();
			});
		});

		gameSocket.on("error", (err) => {
			logger.error(
				`Failed to connect proxy client ${clientAddress} to game server: ${err.message}`
			);
			proxySocket.destroy();
		});
	}

	/**
	 * Handle control connection from game server
	 */
	private handleControlConnection(socket: Socket): void {
		logger.debug("Control connection from game server");

		let buffer = "";
		socket.on("data", (data) => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				try {
					const command = JSON.parse(trimmed);
					this.handleControlCommand(socket, command);
				} catch (err) {
					logger.error(`Invalid control command: ${trimmed}`);
				}
			}
		});

		socket.on("error", (err) => {
			logger.debug(`Control connection error: ${err.message}`);
		});

		socket.on("close", () => {
			logger.debug("Control connection closed");
		});
	}

	/**
	 * Send copyover data to game when a client with copyover data connects
	 */
	private sendCopyoverDataToGame(
		proxyClientAddress: string,
		pair: ClientCharacterPair
	): void {
		// Connect to control server and send copyover data
		const socket = new Socket();
		socket.connect(this.controlPort, "127.0.0.1", () => {
			const command = {
				type: "clientConnectedWithCopyover",
				proxyClientAddress,
				pair,
			};
			socket.write(JSON.stringify(command) + "\n");
			socket.end();
		});

		socket.on("error", (err: Error) => {
			logger.error(`Error sending copyover data to game: ${err.message}`);
		});
	}

	/**
	 * Handle control commands from game server
	 */
	private handleControlCommand(socket: Socket, command: any): void {
		if (command.type === "getCopyoverData") {
			// Game is requesting copyover data
			const response = {
				type: "copyoverData",
				data: this.copyoverData,
			};
			socket.write(JSON.stringify(response) + "\n");
		} else if (command.type === "getCopyoverDataForClient") {
			// Game is requesting copyover data for a specific client
			const clientAddress = command.clientAddress;
			const pair = this.copyoverDataByClient.get(clientAddress);
			const response = {
				type: "copyoverDataForClient",
				data: pair,
			};
			socket.write(JSON.stringify(response) + "\n");
		} else if (command.type === "clientConnectedWithCopyover") {
			// Game is notifying that a client with copyover data has connected
			// This is just an acknowledgment, no response needed
			logger.debug(
				`Game acknowledged copyover data for client ${command.proxyClientAddress}`
			);
		} else if (command.type === "initiateCopyover") {
			// Game wants to initiate a copyover
			const copyoverData: CopyoverData = command.data;
			this.initiateCopyover(copyoverData)
				.then(() => {
					const response = { type: "ack" };
					socket.write(JSON.stringify(response) + "\n");
				})
				.catch((err) => {
					logger.error(`Error initiating copyover: ${err}`);
					const response = { type: "error", message: err.message };
					socket.write(JSON.stringify(response) + "\n");
				});
		} else if (command.type === "copyoverComplete") {
			// Game has finished processing copyover
			this.clearCopyoverData();
			const response = { type: "ack" };
			socket.write(JSON.stringify(response) + "\n");
		}
	}

	/**
	 * Initiate a copyover operation
	 * This should be called by the game server when it wants to copyover
	 */
	async initiateCopyover(copyoverData: CopyoverData): Promise<void> {
		if (this.isCopyoverInProgress) {
			throw new Error("Copyover already in progress");
		}

		logger.info("Initiating copyover...");
		this.isCopyoverInProgress = true;
		this.copyoverData = copyoverData;

		// Store copyover data by client address for quick lookup
		this.copyoverDataByClient.clear();
		for (const pair of copyoverData.pairs) {
			this.copyoverDataByClient.set(pair.clientId, pair);
		}

		// Stop current game instance
		await this.stopGameInstance();

		// Wait a moment for cleanup
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Spawn new game instance
		await this.spawnGameInstance();

		// Wait for game to be ready
		await new Promise((resolve) => setTimeout(resolve, 3000));

		this.isCopyoverInProgress = false;
		logger.info("Copyover complete");
	}

	/**
	 * Get copyover data (called by game server after restart)
	 */
	getCopyoverData(): CopyoverData | undefined {
		return this.copyoverData;
	}

	/**
	 * Get copyover data for a specific client
	 */
	getCopyoverDataForClient(
		clientAddress: string
	): ClientCharacterPair | undefined {
		return this.copyoverDataByClient.get(clientAddress);
	}

	/**
	 * Clear copyover data after it's been processed
	 */
	clearCopyoverData(): void {
		this.copyoverData = undefined;
		this.copyoverDataByClient.clear();
	}
}
