/**
 * Telnet Protocol Handlers
 *
 * This module provides protocol-specific handlers for various telnet options:
 * - SGA (Suppress Go Ahead)
 * - TTYPE (Terminal Type)
 * - MCCP1/MCCP2 (Mud Client Compression Protocol)
 * - NAWS (Negotiate About Window Size)
 *
 * @module telnet-protocol-handlers
 */

import { Socket } from "net";
import {
	TelnetNegotiationManager,
	ProtocolHandler,
	ProtocolData,
} from "./telnet-negotiation.js";
import { IAC, TELNET_OPTION, buildIACCommand } from "./telnet.js";
import logger from "../logger.js";
import { createDeflate, createInflate, Deflate, Inflate } from "zlib";

/**
 * SGA (Suppress Go Ahead) Protocol Handler
 * Server offers: sends WILL SGA
 */
export class SGAHandler implements ProtocolHandler {
	public option = TELNET_OPTION.SGA;
	public serverWillsOption = true;

	public handleCommand(
		command: IAC.DO | IAC.DONT | IAC.WILL | IAC.WONT,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		const state = manager.getState(this.option);
		const address = manager.getAddress();

		if (command === IAC.DO) {
			// Client wants us to enable SGA
			if (state === "negotiated") {
				// Already negotiated, ignore duplicate
				logger.debug(
					`SGA negotiation (${address}): received duplicate IAC DO SGA, ignoring`
				);
			} else if (state === "none") {
				// Client initiated before we sent WILL SGA - respond with WILL SGA
				manager.setState(this.option, "negotiated");
				manager.write(buildIACCommand(IAC.WILL, this.option));
				logger.debug(
					`SGA negotiation (${address}): received IAC DO SGA (client-initiated), responding with IAC WILL SGA (negotiation complete)`
				);
				if (this.onNegotiated) {
					this.onNegotiated(manager, socket);
				}
			} else if (state === "pending_send") {
				// Client responding to our WILL SGA - negotiation complete
				manager.setState(this.option, "negotiated");
				logger.debug(
					`SGA negotiation (${address}): received IAC DO SGA (response to our WILL SGA), enabling full-duplex mode (negotiation complete)`
				);
				if (this.onNegotiated) {
					this.onNegotiated(manager, socket);
				}
			} else if (state === "rejected" || state === "disabled") {
				logger.debug(
					`SGA negotiation (${address}): received IAC DO SGA but negotiation was rejected/disabled, ignoring`
				);
			}
		} else if (command === IAC.DONT) {
			// Client doesn't want SGA
			if (state === "pending_send" || state === "negotiated") {
				manager.setState(this.option, "rejected");
				manager.write(buildIACCommand(IAC.WONT, this.option));
				logger.debug(
					`SGA negotiation (${address}): received IAC DON'T SGA, sent IAC WON'T SGA (negotiation rejected)`
				);
				this.onRejected?.(manager, socket);
			}
		}
	}

	public onNegotiated?(
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		logger.debug(`SGA enabled for ${manager.getAddress()}`);
	}

	public onRejected?(manager: TelnetNegotiationManager, socket: Socket): void {
		logger.debug(`SGA disabled for ${manager.getAddress()}`);
	}
}

/**
 * TTYPE (Terminal Type) Protocol Handler
 * Server requests: sends DO TTYPE
 */
export class TTYPEHandler implements ProtocolHandler {
	public option = TELNET_OPTION.TTYPE;
	public serverWillsOption = false; // Server requests, client provides

	private sentRequest = false;

	public handleCommand(
		command: IAC.DO | IAC.DONT | IAC.WILL | IAC.WONT,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		const state = manager.getState(this.option);
		const address = manager.getAddress();

		if (command === IAC.WILL) {
			// Client will send terminal type
			if (state === "none" || state === "pending_send") {
				manager.setState(this.option, "negotiated");
				logger.debug(
					`TTYPE negotiation (${address}): received IAC WILL TTYPE, negotiation complete`
				);
				// Request terminal type
				this.requestTerminalType(manager, socket);
				if (this.onNegotiated) {
					this.onNegotiated(manager, socket);
				}
			}
		} else if (command === IAC.WONT) {
			// Client won't send terminal type
			manager.setState(this.option, "rejected");
			logger.debug(
				`TTYPE negotiation (${address}): received IAC WON'T TTYPE, negotiation rejected`
			);
			this.onRejected?.(manager, socket);
		}
	}

	public handleSubnegotiation(
		data: Buffer,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		const address = manager.getAddress();
		if (data.length === 0) return;

		// TTYPE subnegotiation format: IS <0x00> <terminal-type>
		// or SEND <IAC.SEND> (request to send)
		const command = data[0];

		if (command === 0x00) {
			// IS - client is sending terminal type
			const terminalType = data.slice(1).toString("utf8").trim();
			const protocolData = manager.getData();
			if (!protocolData.ttype) {
				protocolData.ttype = {};
			}
			protocolData.ttype.terminalType = terminalType;
			logger.info(`TTYPE (${address}): client terminal type: ${terminalType}`);
		} else if (command === IAC.SEND) {
			// SEND - client wants us to send our terminal type (we don't have one as server)
			logger.debug(`TTYPE (${address}): received SEND, ignoring`);
		}
	}

	private requestTerminalType(
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		if (this.sentRequest) return;
		if (socket.destroyed || !socket.writable) return;

		// Send IAC SB TTYPE SEND IAC SE
		const sendRequest = Buffer.from([
			IAC.IAC,
			IAC.SB,
			this.option,
			IAC.SEND,
			IAC.IAC,
			IAC.SE,
		]);
		manager.write(sendRequest);
		this.sentRequest = true;
		logger.debug(`TTYPE (${manager.getAddress()}): sent SEND request`);
	}

	public onNegotiated?(
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		logger.debug(`TTYPE enabled for ${manager.getAddress()}`);
	}

	public onRejected?(manager: TelnetNegotiationManager, socket: Socket): void {
		logger.debug(`TTYPE disabled for ${manager.getAddress()}`);
	}
}

/**
 * MCCP1 (Mud Client Compression Protocol v1) Handler
 * Server requests: sends DO MCCP1
 */
export class MCCP1Handler implements ProtocolHandler {
	public option = TELNET_OPTION.MCCP1;
	public serverWillsOption = false; // Server requests, client provides

	public handleCommand(
		command: IAC.DO | IAC.DONT | IAC.WILL | IAC.WONT,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		const state = manager.getState(this.option);
		const address = manager.getAddress();

		if (command === IAC.WILL) {
			// Client will enable MCCP1 compression
			if (state === "none" || state === "pending_send") {
				manager.setState(this.option, "negotiated");
				logger.info(
					`MCCP1 negotiation (${address}): received IAC WILL MCCP1, enabling compression`
				);
				this.enableCompression(manager, socket);
				if (this.onNegotiated) {
					this.onNegotiated(manager, socket);
				}
			}
		} else if (command === IAC.WONT) {
			// Client won't enable compression
			manager.setState(this.option, "rejected");
			logger.debug(
				`MCCP1 negotiation (${address}): received IAC WON'T MCCP1, negotiation rejected`
			);
			this.onRejected?.(manager, socket);
		}
	}

	private enableCompression(
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		const protocolData = manager.getData();
		if (!protocolData.mccp1) {
			protocolData.mccp1 = {};
		}

		// Create compression streams
		// For MCCP1, we compress outgoing data
		const compressor = createDeflate({ level: 9 });
		const decompressor = createInflate();

		protocolData.mccp1.compressor = compressor;
		protocolData.mccp1.decompressor = decompressor;

		// Pipe socket through decompressor for incoming data
		// Note: In practice, you'd need to intercept socket writes for compression
		// This is a simplified version - full implementation would require wrapping the socket
		logger.debug(
			`MCCP1 (${manager.getAddress()}): compression streams created`
		);
	}

	public onNegotiated?(
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		logger.info(`MCCP1 enabled for ${manager.getAddress()}`);
	}

	public onRejected?(manager: TelnetNegotiationManager, socket: Socket): void {
		logger.debug(`MCCP1 disabled for ${manager.getAddress()}`);
	}
}

/**
 * MCCP2 (Mud Client Compression Protocol v2) Handler
 * Server offers: sends WILL MCCP2
 * After client responds with DO, server sends subnegotiation to start compression
 */
export class MCCP2Handler implements ProtocolHandler {
	public option = TELNET_OPTION.MCCP2;
	public serverWillsOption = true; // Server offers compression

	public handleCommand(
		command: IAC.DO | IAC.DONT | IAC.WILL | IAC.WONT,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		const state = manager.getState(this.option);
		const address = manager.getAddress();

		if (command === IAC.DO) {
			// Client accepts MCCP2 compression
			if (state === "pending_send") {
				manager.setState(this.option, "negotiated");
				logger.info(
					`MCCP2 negotiation (${address}): received IAC DO MCCP2, starting compression`
				);
				// Send subnegotiation to start compression: IAC SB MCCP2 IAC SE
				this.startCompression(manager, socket);
				if (this.onNegotiated) {
					this.onNegotiated(manager, socket);
				}
			} else if (state === "negotiated") {
				// Already negotiated, ignore duplicate
				logger.debug(
					`MCCP2 negotiation (${address}): received duplicate IAC DO MCCP2, ignoring`
				);
			}
		} else if (command === IAC.DONT) {
			// Client rejects MCCP2 compression
			if (state === "pending_send" || state === "negotiated") {
				manager.setState(this.option, "rejected");
				logger.debug(
					`MCCP2 negotiation (${address}): received IAC DON'T MCCP2, negotiation rejected`
				);
				this.onRejected?.(manager, socket);
			}
		}
	}

	/**
	 * Start MCCP2 compression by sending subnegotiation and setting up compression stream
	 * MCCP2 only compresses server->client data, not client->server
	 */
	private startCompression(
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		if (socket.destroyed || !socket.writable) {
			return;
		}

		// Send IAC SB MCCP2 IAC SE to start compression
		// Note: This must be sent BEFORE compression starts (uncompressed)
		const startCompression = Buffer.from([
			IAC.IAC,
			IAC.SB,
			this.option,
			IAC.IAC,
			IAC.SE,
		]);
		socket.write(startCompression);
		logger.debug(
			`MCCP2 (${manager.getAddress()}): sent subnegotiation to start compression`
		);

		// Create compression streams
		const protocolData = manager.getData();
		if (!protocolData.mccp2) {
			protocolData.mccp2 = {};
		}

		// Create deflate compressor for outgoing data (server -> client only)
		// Client -> server remains uncompressed
		const compressor = createDeflate({ level: 9 });

		// Write compressed data directly to socket (not piped to avoid buffering)
		// Use setNoDelay to disable Nagle's algorithm for immediate transmission
		socket.setNoDelay(true);
		compressor.on("data", (chunk: Buffer) => {
			logger.debug(
				`MCCP2 compressor (${manager.getAddress()}): emitted ${
					chunk.length
				} bytes of compressed data`
			);
			if (!socket.destroyed && socket.writable) {
				const flushed = socket.write(chunk);
				logger.debug(
					`MCCP2 compressor (${manager.getAddress()}): wrote ${
						chunk.length
					} bytes to socket, flushed: ${flushed}`
				);
				// If socket buffer is full, pause the compressor
				if (!flushed) {
					logger.debug(
						`MCCP2 compressor (${manager.getAddress()}): socket buffer full, pausing compressor`
					);
					compressor.pause();
					socket.once("drain", () => {
						logger.debug(
							`MCCP2 compressor (${manager.getAddress()}): socket drained, resuming compressor`
						);
						compressor.resume();
					});
				}
			} else {
				logger.debug(
					`MCCP2 compressor (${manager.getAddress()}): socket not writable, ignoring ${
						chunk.length
					} bytes`
				);
			}
		});

		// Handle compressor errors
		compressor.on("error", (err) => {
			logger.error(
				`MCCP2 compressor error (${manager.getAddress()}): ${err.message}`
			);
		});

		protocolData.mccp2.compressor = compressor;

		// Write empty string to initialize/flush the compressor stream
		logger.debug(
			`MCCP2 compressor (${manager.getAddress()}): writing empty string to initialize stream`
		);

		logger.info(
			`MCCP2 (${manager.getAddress()}): compression active - outgoing data will be compressed`
		);
	}

	public handleSubnegotiation?(
		data: Buffer,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		// MCCP2 clients may send subnegotiations, but we don't need to respond
		// Just log it for debugging
		logger.debug(
			`MCCP2 (${manager.getAddress()}): received subnegotiation, ignoring`
		);
	}

	public onNegotiated?(
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		logger.info(`MCCP2 enabled for ${manager.getAddress()}`);
	}

	public onRejected?(manager: TelnetNegotiationManager, socket: Socket): void {
		logger.debug(`MCCP2 disabled for ${manager.getAddress()}`);
	}
}

/**
 * NAWS (Negotiate About Window Size) Handler
 * Server requests: sends DO NAWS
 */
export class NAWSHandler implements ProtocolHandler {
	public option = TELNET_OPTION.NAWS;
	public serverWillsOption = false; // Server requests, client provides

	public handleCommand(
		command: IAC.DO | IAC.DONT | IAC.WILL | IAC.WONT,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		const state = manager.getState(this.option);
		const address = manager.getAddress();

		if (command === IAC.WILL) {
			// Client will send window size
			if (state === "none" || state === "pending_send") {
				manager.setState(this.option, "negotiated");
				logger.debug(
					`NAWS negotiation (${address}): received IAC WILL NAWS, negotiation complete`
				);
				if (this.onNegotiated) {
					this.onNegotiated(manager, socket);
				}
			}
		} else if (command === IAC.WONT) {
			// Client won't send window size
			manager.setState(this.option, "rejected");
			logger.debug(
				`NAWS negotiation (${address}): received IAC WON'T NAWS, negotiation rejected`
			);
			this.onRejected?.(manager, socket);
		}
	}

	public handleSubnegotiation(
		data: Buffer,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		const address = manager.getAddress();
		if (data.length < 4) {
			logger.warn(`NAWS (${address}): invalid subnegotiation data length`);
			return;
		}

		// NAWS subnegotiation format: <width-high> <width-low> <height-high> <height-low>
		const width = (data[0] << 8) | data[1];
		const height = (data[2] << 8) | data[3];

		const protocolData = manager.getData();
		if (!protocolData.naws) {
			protocolData.naws = {};
		}
		protocolData.naws.width = width;
		protocolData.naws.height = height;

		logger.info(`NAWS (${address}): window size: ${width}x${height}`);
	}

	public onNegotiated?(
		manager: TelnetNegotiationManager,
		socket: Socket
	): void {
		logger.debug(`NAWS enabled for ${manager.getAddress()}`);
	}

	public onRejected?(manager: TelnetNegotiationManager, socket: Socket): void {
		logger.debug(`NAWS disabled for ${manager.getAddress()}`);
	}
}
