import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { MudServer, MudClient } from "./io.js";
import { Socket } from "net";

describe("io.ts", () => {
	describe("MudServer", () => {
		let server: MudServer;
		const TEST_PORT = 14000; // Use a high port to avoid conflicts

		beforeEach(async () => {
			server = new MudServer();
		});

		afterEach(async () => {
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

			server.on("connection", (client: MudClient) => {
				connectionEmitted = true;
				clientInstance = client;
			});

			// Create a test client connection
			const testClient = new Socket();
			await new Promise<void>((resolve) => {
				testClient.connect(TEST_PORT, "localhost", () => {
					resolve();
				});
			});

			// Wait a bit for the event to fire
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(connectionEmitted, true);
			assert.notStrictEqual(clientInstance, null);
			assert.strictEqual(server.getClientCount(), 1);

			testClient.destroy();
		});

		it("should track connected clients", async () => {
			await server.start(TEST_PORT);

			const client1 = new Socket();
			const client2 = new Socket();

			await Promise.all([
				new Promise<void>((resolve) => {
					client1.connect(TEST_PORT, "localhost", () => resolve());
				}),
				new Promise<void>((resolve) => {
					client2.connect(TEST_PORT, "localhost", () => resolve());
				}),
			]);

			await new Promise((resolve) => setTimeout(resolve, 50));

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

			const testClient = new Socket();
			await new Promise<void>((resolve) => {
				testClient.connect(TEST_PORT, "localhost", () => resolve());
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
			assert.strictEqual(server.getClientCount(), 1);

			testClient.destroy();
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(disconnectionEmitted, true);
			assert.strictEqual(server.getClientCount(), 0);
		});

		it("should broadcast messages to all clients", async () => {
			await server.start(TEST_PORT);

			const client1 = new Socket();
			const client2 = new Socket();

			await Promise.all([
				new Promise<void>((resolve) => {
					client1.connect(TEST_PORT, "localhost", () => resolve());
				}),
				new Promise<void>((resolve) => {
					client2.connect(TEST_PORT, "localhost", () => resolve());
				}),
			]);

			await new Promise((resolve) => setTimeout(resolve, 50));

			const messages1: string[] = [];
			const messages2: string[] = [];

			client1.on("data", (data) => messages1.push(data.toString()));
			client2.on("data", (data) => messages2.push(data.toString()));

			server.broadcast("Hello");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(messages1.join(""), "Hello");
			assert.strictEqual(messages2.join(""), "Hello");

			client1.destroy();
			client2.destroy();
		});

		it("should broadcast lines to all clients", async () => {
			await server.start(TEST_PORT);

			const client1 = new Socket();
			await new Promise<void>((resolve) => {
				client1.connect(TEST_PORT, "localhost", () => resolve());
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			const messages: string[] = [];
			client1.on("data", (data) => messages.push(data.toString()));

			server.broadcastLine("Test message");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(messages.join(""), "Test message\r\n");

			client1.destroy();
		});
	});

	describe("MudClient", () => {
		let server: MudServer;
		let mudClient: MudClient | null = null;
		let testSocket: Socket;
		const TEST_PORT = 14001;

		beforeEach(async () => {
			server = new MudServer();
			await server.start(TEST_PORT);

			// Set up connection handler
			server.on("connection", (client: MudClient) => {
				mudClient = client;
			});

			testSocket = new Socket();
			await new Promise<void>((resolve) => {
				testSocket.connect(TEST_PORT, "localhost", () => resolve());
			});

			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		afterEach(async () => {
			if (testSocket && !testSocket.destroyed) {
				testSocket.destroy();
			}
			if (server && server.isRunning()) {
				await server.stop();
			}
			// Give the OS time to release the port
			await new Promise((resolve) => setTimeout(resolve, 100));
			mudClient = null;
		});

		it("should emit input event when receiving data", async () => {
			assert.notStrictEqual(mudClient, null);

			let inputReceived: string | null = null;
			mudClient!.on("input", (line: string) => {
				inputReceived = line;
			});

			testSocket.write("test command\n");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(inputReceived, "test command");
		});

		it("should handle multiple lines in one data event", async () => {
			assert.notStrictEqual(mudClient, null);

			const inputs: string[] = [];
			mudClient!.on("input", (line: string) => {
				inputs.push(line);
			});

			testSocket.write("line1\nline2\nline3\n");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.deepStrictEqual(inputs, ["line1", "line2", "line3"]);
		});

		it("should buffer incomplete lines", async () => {
			assert.notStrictEqual(mudClient, null);

			const inputs: string[] = [];
			mudClient!.on("input", (line: string) => {
				inputs.push(line);
			});

			testSocket.write("partial");
			await new Promise((resolve) => setTimeout(resolve, 50));
			assert.strictEqual(inputs.length, 0);

			testSocket.write(" line\n");
			await new Promise((resolve) => setTimeout(resolve, 50));
			assert.deepStrictEqual(inputs, ["partial line"]);
		});

		it("should send text to the client", async () => {
			assert.notStrictEqual(mudClient, null);

			const messages: string[] = [];
			testSocket.on("data", (data) => {
				messages.push(data.toString());
			});

			mudClient!.send("Hello, client!");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(messages.join(""), "Hello, client!");
		});

		it("should send lines to the client", async () => {
			assert.notStrictEqual(mudClient, null);

			const messages: string[] = [];
			testSocket.on("data", (data) => {
				messages.push(data.toString());
			});

			mudClient!.sendLine("Welcome!");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(messages.join(""), "Welcome!\r\n");
		});

		it("should emit close event when connection is closed", async () => {
			assert.notStrictEqual(mudClient, null);

			let closeEmitted = false;
			mudClient!.on("close", () => {
				closeEmitted = true;
			});

			testSocket.destroy();
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(closeEmitted, true);
		});

		it("should close the connection", async () => {
			assert.notStrictEqual(mudClient, null);

			let socketClosed = false;
			testSocket.on("close", () => {
				socketClosed = true;
			});

			mudClient!.close();
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(socketClosed, true);
			assert.strictEqual(mudClient!.isConnected(), false);
		});

		it("should report connection status", async () => {
			assert.notStrictEqual(mudClient, null);
			assert.strictEqual(mudClient!.isConnected(), true);

			testSocket.destroy();
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(mudClient!.isConnected(), false);
		});

		it("should accept empty lines", async () => {
			assert.notStrictEqual(mudClient, null);

			const inputs: string[] = [];
			mudClient!.on("input", (line: string) => {
				inputs.push(line);
			});

			testSocket.write("\n\n  \n");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(inputs.length, 3);
		});

		it("should trim whitespace from input lines", async () => {
			assert.notStrictEqual(mudClient, null);

			const inputs: string[] = [];
			mudClient!.on("input", (line: string) => {
				inputs.push(line);
			});

			testSocket.write("  command with spaces  \n");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.deepStrictEqual(inputs, ["command with spaces"]);
		});
	});
});
