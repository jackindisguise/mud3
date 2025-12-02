import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { MudServer, MudClient } from "./io.js";
import { Socket } from "net";
import { LINEBREAK, TELNET_OPTION, IAC, buildIACCommand } from "./telnet.js";

/**
 * Filter out all telnet negotiation commands from a message string
 * This handles IAC commands, subnegotiations, and escaped IAC bytes
 */
function filterTelnetNegotiations(message: string): string {
	// Remove IAC SB ... IAC SE subnegotiations
	let result = message.replace(/\xff\xfa[\s\S]*?\xff\xf0/g, "");

	// Remove IAC WILL/WONT/DO/DONT <option> commands
	result = result.replace(/\xff[\xfb-\xfe]./g, "");

	// Remove IAC GA (Go Ahead)
	result = result.replace(/\xff\xf9/g, "");

	// Collapse escaped IAC bytes (IAC IAC -> literal 0xFF)
	result = result.replace(/\xff\xff/g, "\xff");

	// Remove any remaining single IAC bytes (shouldn't happen but be safe)
	result = result.replace(/\xff(?!\xff)/g, "");

	return result;
}

/**
 * Filter telnet negotiations from a buffer, returning the cleaned buffer
 */
function filterTelnetNegotiationsFromBuffer(data: Buffer): Buffer {
	const binary = data.toString("binary");
	let result = binary;

	// Remove IAC SB ... IAC SE subnegotiations
	result = result.replace(/\xff\xfa[\s\S]*?\xff\xf0/g, "");

	// Remove IAC WILL/WONT/DO/DONT <option> commands
	result = result.replace(/\xff[\xfb-\xfe]./g, "");

	// Remove IAC GA (Go Ahead)
	result = result.replace(/\xff\xf9/g, "");

	// Collapse escaped IAC bytes (IAC IAC -> literal 0xFF)
	result = result.replace(/\xff\xff/g, "\xff");

	// Remove any remaining single IAC bytes (shouldn't happen but be safe)
	result = result.replace(/\xff(?!\xff)/g, "");

	if (result.length === 0) {
		return Buffer.alloc(0);
	}

	return Buffer.from(result, "binary");
}

/**
 * Create a data consumer that filters telnet negotiations before storing messages
 * This should be attached to sockets before any negotiations are sent
 */
function createFilteredDataConsumer(
	messages: string[]
): (data: Buffer) => void {
	return (data: Buffer) => {
		const filtered = filterTelnetNegotiationsFromBuffer(data);
		if (filtered.length > 0) {
			// Convert to string using the same encoding as the original test expectations
			messages.push(filtered.toString());
		}
	};
}

/**
 * Set up a test socket to respond to telnet negotiations
 * Responds to WILL with DONT and DO with WONT to quickly complete negotiations
 */
function setupTelnetNegotiationResponder(socket: Socket): void {
	let buffer = Buffer.alloc(0);

	socket.on("data", (data: Buffer) => {
		// Append new data to buffer
		buffer = Buffer.concat([buffer, data]);

		// Process IAC commands in the buffer
		let processed = 0;
		let i = 0;
		while (i < buffer.length) {
			// Look for IAC byte (255 / 0xFF)
			if (buffer[i] === IAC.IAC) {
				// Check if we have enough bytes for a command
				if (i + 2 >= buffer.length) {
					// Not enough data yet, keep waiting
					break;
				}

				const command = buffer[i + 1];
				const option = buffer[i + 2];

				// Handle IAC WILL - respond with IAC DONT
				if (command === IAC.WILL) {
					socket.write(buildIACCommand(IAC.DONT, option));
					i += 3; // Skip IAC, WILL, option
					processed = i;
				}
				// Handle IAC DO - respond with IAC WONT
				else if (command === IAC.DO) {
					socket.write(buildIACCommand(IAC.WONT, option));
					i += 3; // Skip IAC, DO, option
					processed = i;
				}
				// Handle IAC WONT or IAC DONT - just skip (no response needed)
				else if (command === IAC.WONT || command === IAC.DONT) {
					i += 3; // Skip IAC, WONT/DONT, option
					processed = i;
				}
				// Handle IAC IAC (escaped IAC) - skip both
				else if (command === IAC.IAC) {
					i += 2; // Skip both IAC bytes
					processed = i;
				}
				// Handle subnegotiation (IAC SB ... IAC SE)
				else if (command === IAC.SB) {
					// Find the matching IAC SE
					let j = i + 2;
					while (j < buffer.length - 1) {
						if (buffer[j] === IAC.IAC && buffer[j + 1] === IAC.SE) {
							i = j + 2; // Skip entire subnegotiation
							processed = i;
							break;
						}
						j++;
					}
					if (j >= buffer.length - 1) {
						// Subnegotiation not complete yet
						break;
					}
				}
				// Unknown IAC command - skip it
				else {
					i += 2; // Skip IAC and command byte
					processed = i;
				}
			} else {
				i++;
			}
		}

		// Remove processed bytes from buffer
		if (processed > 0) {
			buffer = buffer.slice(processed);
		}
	});
}

describe("io.ts", () => {
	describe("MudServer", () => {
		let server: MudServer;
		const TEST_PORT = 14000; // Use a high port to avoid conflicts
		const timeouts: NodeJS.Timeout[] = [];

		// Wrapper for setTimeout that tracks timeout IDs
		const trackedSetTimeout = (
			callback: (...args: any[]) => void,
			ms?: number
		): NodeJS.Timeout => {
			const timeoutId = setTimeout(callback, ms);
			timeouts.push(timeoutId);
			return timeoutId;
		};

		beforeEach(async () => {
			server = new MudServer();
			timeouts.length = 0; // Clear any leftover timeouts
		});

		afterEach(async () => {
			// Clear all tracked timeouts
			for (const timeoutId of timeouts) {
				clearTimeout(timeoutId);
			}
			timeouts.length = 0;

			if (server && server.isRunning()) {
				await server.stop();
			}
			// Give the OS time to release the port
			//await new Promise((resolve) => setTimeout(resolve, 50));
		});

		it("should start and listen on the specified port", async () => {
			await server.start(TEST_PORT);
			assert.strictEqual(server.isRunning(), true);
			assert.strictEqual(server.getPort(), TEST_PORT);
		});

		it("should emit listening event when started", async () => {
			let listeningEmitted = false;
			server.on("listening", () => {
				listeningEmitted = true;
			});

			await server.start(TEST_PORT);
			assert.strictEqual(listeningEmitted, true);
		});

		it("should stop the server", async () => {
			await server.start(TEST_PORT);
			assert.strictEqual(server.isRunning(), true);

			await server.stop();
			assert.strictEqual(server.isRunning(), false);
		});

		it("should emit close event when stopped", async () => {
			await server.start(TEST_PORT);

			let closeEmitted = false;
			server.on("close", () => {
				closeEmitted = true;
			});

			await server.stop();
			assert.strictEqual(closeEmitted, true);
		});

		it("should reject starting when already listening", async () => {
			await server.start(TEST_PORT);

			await assert.rejects(
				async () => {
					await server.start(TEST_PORT);
				},
				{ message: "Server is already listening" }
			);
		});

		it("should accept client connections", async () => {
			await server.start(TEST_PORT);

			let connectionEmitted = false;
			let clientInstance: MudClient | null = null;

			// Wait for connection event
			const connectionPromise = new Promise<void>((resolve) => {
				server.once("connection", (client: MudClient) => {
					connectionEmitted = true;
					clientInstance = client;
					resolve();
				});
			});

			// Create a test client connection with telnet negotiation responder
			const testClient = new Socket();
			setupTelnetNegotiationResponder(testClient);
			await new Promise<void>((resolve) => {
				testClient.connect(TEST_PORT, "localhost", () => {
					resolve();
				});
			});

			// Wait for connection event (negotiations should complete quickly)
			await Promise.race([
				connectionPromise,
				new Promise((resolve) => trackedSetTimeout(resolve, 1000)),
			]);

			assert.strictEqual(connectionEmitted, true);
			assert.notStrictEqual(clientInstance, null);
			assert.strictEqual(server.getClientCount(), 1);

			testClient.destroy();
		});

		it("should track connected clients", async () => {
			await server.start(TEST_PORT);

			const client1 = new Socket();
			const client2 = new Socket();
			setupTelnetNegotiationResponder(client1);
			setupTelnetNegotiationResponder(client2);

			let connectionCount = 0;
			const connectionPromise = new Promise<void>((resolve) => {
				server.on("connection", () => {
					connectionCount++;
					if (connectionCount === 2) {
						resolve();
					}
				});
			});

			await Promise.all([
				new Promise<void>((resolve) => {
					client1.connect(TEST_PORT, "localhost", () => resolve());
				}),
				new Promise<void>((resolve) => {
					client2.connect(TEST_PORT, "localhost", () => resolve());
				}),
			]);

			// Wait for both connection events (negotiations should complete quickly)
			await Promise.race([
				connectionPromise,
				new Promise((resolve) => trackedSetTimeout(resolve, 1000)),
			]);

			assert.strictEqual(server.getClientCount(), 2);
			assert.strictEqual(server.getClients().length, 2);

			client1.destroy();
			client2.destroy();
		});

		it("should emit disconnection event when client disconnects", async () => {
			await server.start(TEST_PORT);

			let disconnectionEmitted = false;
			server.on("disconnection", () => {
				disconnectionEmitted = true;
			});

			// Wait for connection event first
			const connectionPromise = new Promise<void>((resolve) => {
				server.once("connection", () => {
					resolve();
				});
			});

			const testClient = new Socket();
			setupTelnetNegotiationResponder(testClient);
			await new Promise<void>((resolve) => {
				testClient.connect(TEST_PORT, "localhost", () => resolve());
			});

			// Wait for connection event (negotiations should complete quickly)
			await Promise.race([
				connectionPromise,
				new Promise((resolve) => trackedSetTimeout(resolve, 1000)),
			]);
			assert.strictEqual(server.getClientCount(), 1);

			testClient.destroy();
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));

			assert.strictEqual(disconnectionEmitted, true);
			assert.strictEqual(server.getClientCount(), 0);
		});

		it("should broadcast messages to all clients", async () => {
			await server.start(TEST_PORT);

			const client1 = new Socket();
			const client2 = new Socket();
			setupTelnetNegotiationResponder(client1);
			setupTelnetNegotiationResponder(client2);

			let connectionCount = 0;
			const connectionPromise = new Promise<void>((resolve) => {
				server.on("connection", () => {
					connectionCount++;
					if (connectionCount === 2) {
						resolve();
					}
				});
			});

			await Promise.all([
				new Promise<void>((resolve) => {
					client1.connect(TEST_PORT, "localhost", () => resolve());
				}),
				new Promise<void>((resolve) => {
					client2.connect(TEST_PORT, "localhost", () => resolve());
				}),
			]);

			// Wait for both connection events (negotiations should complete quickly)
			await Promise.race([
				connectionPromise,
				new Promise((resolve) => trackedSetTimeout(resolve, 1000)),
			]);

			const messages1: string[] = [];
			const messages2: string[] = [];

			// Attach filtered data consumers to filter out telnet negotiations
			client1.on("data", createFilteredDataConsumer(messages1));
			client2.on("data", createFilteredDataConsumer(messages2));

			server.broadcast("Hello");
			await new Promise((resolve) => trackedSetTimeout(resolve, 100));

			// Messages are already filtered by the consumer
			assert.strictEqual(messages1.join(""), "Hello");
			assert.strictEqual(messages2.join(""), "Hello");

			client1.destroy();
			client2.destroy();
		});

		it("should broadcast lines to all clients", async () => {
			await server.start(TEST_PORT);

			// Wait for connection event first
			const connectionPromise = new Promise<void>((resolve) => {
				server.once("connection", () => {
					resolve();
				});
			});

			const client1 = new Socket();
			setupTelnetNegotiationResponder(client1);
			await new Promise<void>((resolve) => {
				client1.connect(TEST_PORT, "localhost", () => resolve());
			});

			// Wait for connection event (negotiations should complete quickly)
			await Promise.race([
				connectionPromise,
				new Promise((resolve) => trackedSetTimeout(resolve, 1000)),
			]);

			const messages: string[] = [];
			// Attach filtered data consumer to filter out telnet negotiations
			client1.on("data", createFilteredDataConsumer(messages));

			server.broadcastLine("Test message");
			await new Promise((resolve) => trackedSetTimeout(resolve, 100));

			// broadcastLine sends text + LINEBREAK
			// Messages are already filtered by the consumer
			assert.strictEqual(messages.join(""), "Test message" + LINEBREAK);

			client1.destroy();
		});
	});

	describe("MudClient", () => {
		let server: MudServer;
		let mudClient: MudClient | null = null;
		let testSocket: Socket;
		const TEST_PORT = 14001;
		const timeouts: NodeJS.Timeout[] = [];

		// Wrapper for setTimeout that tracks timeout IDs
		const trackedSetTimeout = (
			callback: (...args: any[]) => void,
			ms?: number
		): NodeJS.Timeout => {
			const timeoutId = setTimeout(callback, ms);
			timeouts.push(timeoutId);
			return timeoutId;
		};

		beforeEach(async () => {
			timeouts.length = 0; // Clear any leftover timeouts
			server = new MudServer();
			await server.start(TEST_PORT);

			// Wait for connection event
			const connectionPromise = new Promise<void>((resolve) => {
				server.once("connection", (client: MudClient) => {
					mudClient = client;
					resolve();
				});
			});

			testSocket = new Socket();
			setupTelnetNegotiationResponder(testSocket);
			await new Promise<void>((resolve) => {
				testSocket.connect(TEST_PORT, "localhost", () => resolve());
			});

			// Wait for connection event (negotiations should complete quickly)
			await Promise.race([
				connectionPromise,
				new Promise((resolve) => trackedSetTimeout(resolve, 1000)),
			]);
		});

		afterEach(async () => {
			// Clear all tracked timeouts
			for (const timeoutId of timeouts) {
				clearTimeout(timeoutId);
			}
			timeouts.length = 0;

			if (testSocket && !testSocket.destroyed) {
				testSocket.destroy();
			}
			if (server && server.isRunning()) {
				await server.stop();
			}
			// Give the OS time to release the port
			await new Promise((resolve) => trackedSetTimeout(resolve, 100));
			mudClient = null;
		});

		it("should emit input event when receiving data", async () => {
			assert.notStrictEqual(mudClient, null);

			let inputReceived: string | null = null;
			mudClient!.on("input", (line: string) => {
				inputReceived = line;
			});

			testSocket.write(`test command${LINEBREAK}`);
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));

			assert.strictEqual(inputReceived, "test command");
		});

		it("should handle multiple lines in one data event", async () => {
			assert.notStrictEqual(mudClient, null);

			const inputs: string[] = [];
			mudClient!.on("input", (line: string) => {
				inputs.push(line);
			});

			testSocket.write(`line1${LINEBREAK}line2${LINEBREAK}line3${LINEBREAK}`);
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));

			assert.deepStrictEqual(inputs, ["line1", "line2", "line3"]);
		});

		it("should buffer incomplete lines", async () => {
			assert.notStrictEqual(mudClient, null);

			const inputs: string[] = [];
			mudClient!.on("input", (line: string) => {
				inputs.push(line);
			});

			testSocket.write("partial");
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));
			assert.strictEqual(inputs.length, 0);

			testSocket.write(` line${LINEBREAK}`);
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));
			assert.deepStrictEqual(inputs, ["partial line"]);
		});

		it("should send text to the client", async () => {
			assert.notStrictEqual(mudClient, null);

			const messages: string[] = [];
			// Attach filtered data consumer to filter out telnet negotiations
			testSocket.on("data", createFilteredDataConsumer(messages));

			mudClient!.send("Hello, client!");
			await new Promise((resolve) => trackedSetTimeout(resolve, 100));

			// Messages are already filtered by the consumer
			assert.strictEqual(messages.join(""), "Hello, client!");
		});

		it("should send lines to the client", async () => {
			assert.notStrictEqual(mudClient, null);

			const messages: string[] = [];
			// Attach filtered data consumer to filter out telnet negotiations
			testSocket.on("data", createFilteredDataConsumer(messages));

			mudClient!.sendLine("Welcome!");
			await new Promise((resolve) => trackedSetTimeout(resolve, 100));

			// sendLine sends text + LINEBREAK
			// Messages are already filtered by the consumer
			assert.strictEqual(messages.join(""), "Welcome!" + LINEBREAK);
		});

		it("should emit close event when connection is closed", async () => {
			assert.notStrictEqual(mudClient, null);

			let closeEmitted = false;
			mudClient!.on("close", () => {
				closeEmitted = true;
			});

			testSocket.destroy();
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));

			assert.strictEqual(closeEmitted, true);
		});

		it("should report connection status", async () => {
			assert.notStrictEqual(mudClient, null);
			assert.strictEqual(mudClient!.isConnected(), true);

			testSocket.destroy();
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));

			assert.strictEqual(mudClient!.isConnected(), false);
		});

		it("should accept empty lines", async () => {
			assert.notStrictEqual(mudClient, null);

			const inputs: string[] = [];
			mudClient!.on("input", (line: string) => {
				inputs.push(line);
			});

			testSocket.write(`${LINEBREAK}${LINEBREAK}  ${LINEBREAK}`);
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));

			assert.strictEqual(inputs.length, 3);
		});

		it("should trim whitespace from input lines", async () => {
			assert.notStrictEqual(mudClient, null);

			const inputs: string[] = [];
			mudClient!.on("input", (line: string) => {
				inputs.push(line);
			});

			testSocket.write(`  command with spaces  ${LINEBREAK}`);
			await new Promise((resolve) => trackedSetTimeout(resolve, 50));

			assert.deepStrictEqual(inputs, ["command with spaces"]);
		});
	});
});
