/**
 * Dynamic Telnet Protocol Negotiation Infrastructure
 *
 * This module provides a flexible system for managing telnet protocol negotiations.
 * It supports configurable protocol enable/disable states, handles negotiation cycles,
 * and stores protocol-specific data (like TTYPE client info, MCCP compression streams).
 *
 * @module telnet-negotiation
 */

import { Socket } from "net";
import {
	buildIACCommand,
	IAC,
	TELNET_OPTION,
	getProtocolName,
} from "./telnet.js";
import logger from "../logger.js";
import {
	createDeflate,
	createInflate,
	type Deflate,
	type Inflate,
	constants,
} from "zlib";

/**
 * Negotiation state for a protocol option
 */
export type NegotiationState =
	| "none" // No negotiation started
	| "pending_send" // We sent a request, waiting for response
	| "pending_receive" // Client sent a request, we need to respond
	| "negotiated" // Successfully negotiated
	| "rejected" // Negotiation rejected/failed
	| "disabled"; // Protocol is disabled (explicitly not enabled)

/**
 * Protocol configuration - defines whether we want to enable a protocol
 */
export interface ProtocolConfig {
	/** Whether we want to enable this protocol */
	enabled: boolean;
	/** Whether to actively initiate negotiation on connection */
	initiateOnConnect?: boolean;
}

/**
 * Protocol-specific data storage
 */
export interface ProtocolData {
	/** TTYPE terminal type information */
	ttype?: {
		terminalType?: string;
		sentRequest?: boolean;
	};
	/** MCCP1 compression stream (deprecated, use MCCP2) */
	mccp1?: {
		compressor?: Deflate;
		decompressor?: Inflate;
	};
	/** MCCP2 compression stream (only compresses server->client, not client->server) */
	mccp2?: {
		compressor?: Deflate;
	};
	/** NAWS window size information */
	naws?: {
		width?: number;
		height?: number;
	};
}

/**
 * Handler interface for protocol-specific negotiation logic
 */
export interface ProtocolHandler {
	/** The telnet option code for this protocol */
	option: TELNET_OPTION;
	/** Whether this protocol requires the server to send WILL/WON'T */
	serverWillsOption: boolean;
	/** Handle incoming IAC command (DO/DONT/WILL/WONT) */
	handleCommand(
		command: IAC.DO | IAC.DONT | IAC.WILL | IAC.WONT,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void;
	/** Handle subnegotiation (IAC SB ... IAC SE) */
	handleSubnegotiation?(
		data: Buffer,
		manager: TelnetNegotiationManager,
		socket: Socket
	): void;
	/** Called when negotiation completes successfully */
	onNegotiated?(manager: TelnetNegotiationManager, socket: Socket): void;
	/** Called when negotiation is rejected */
	onRejected?(manager: TelnetNegotiationManager, socket: Socket): void;
}

/**
 * Manages telnet protocol negotiations for a single client connection
 */
export class TelnetNegotiationManager {
	private states: Map<TELNET_OPTION, NegotiationState> = new Map();
	private configs: Map<TELNET_OPTION, ProtocolConfig> = new Map();
	private handlers: Map<TELNET_OPTION, ProtocolHandler> = new Map();
	private data: ProtocolData = {};
	private socket: Socket;
	private address: string;
	private allNegotiationsCompleteCallback?: () => void;
	private pendingProtocols: Set<TELNET_OPTION> = new Set();

	constructor(socket: Socket, address: string) {
		this.socket = socket;
		this.address = address;
	}

	/**
	 * Register a callback to be called when all telnet protocol negotiations complete
	 */
	public onAllNegotiationsComplete(callback: () => void): void {
		logger.debug(
			`Telnet negotiation (${this.address}): registering callback for all negotiations complete`
		);
		this.allNegotiationsCompleteCallback = callback;
		// Check if already complete
		//this.checkIfAllComplete();
	}

	/**
	 * Check if all pending protocol negotiations are complete
	 */
	private checkIfAllComplete(): void {
		const pendingCount = this.pendingProtocols.size;
		logger.debug(
			`Telnet negotiation (${this.address}): checking if complete - ${pendingCount} protocol(s) still pending`
		);
		if (
			this.pendingProtocols.size === 0 &&
			this.allNegotiationsCompleteCallback
		) {
			logger.debug(
				`Telnet negotiation (${this.address}): all negotiations complete, calling callback`
			);
			this.allNegotiationsCompleteCallback();
			this.allNegotiationsCompleteCallback = undefined; // Only call once
		}
	}

	/**
	 * Mark a protocol negotiation as complete (negotiated, rejected, or disabled)
	 */
	private markProtocolComplete(option: TELNET_OPTION): void {
		if (this.pendingProtocols.has(option)) {
			const state = this.getState(option);
			logger.debug(
				`Telnet negotiation (${this.address}): protocol ${getProtocolName(
					option
				)} completed with state "${state}", removing from pending`
			);
			this.pendingProtocols.delete(option);
			this.checkIfAllComplete();
		}
	}

	/**
	 * Register a protocol handler
	 */
	public registerHandler(handler: ProtocolHandler): void {
		this.handlers.set(handler.option, handler);
	}

	/**
	 * Configure a protocol (whether to enable it)
	 */
	public configureProtocol(
		option: TELNET_OPTION,
		config: ProtocolConfig
	): void {
		this.configs.set(option, config);
		if (!this.states.has(option)) {
			this.states.set(option, "none");
		}
	}

	/**
	 * Get the current negotiation state for a protocol
	 */
	public getState(option: TELNET_OPTION): NegotiationState {
		return this.states.get(option) ?? "none";
	}

	/**
	 * Set the negotiation state for a protocol
	 */
	public setState(option: TELNET_OPTION, state: NegotiationState): void {
		this.states.set(option, state);
		// If state is negotiated, rejected, or disabled, mark protocol as complete
		if (
			state === "negotiated" ||
			state === "rejected" ||
			state === "disabled"
		) {
			this.markProtocolComplete(option);
		}
	}

	/**
	 * Get protocol-specific data
	 */
	public getData(): ProtocolData {
		return this.data;
	}

	/**
	 * Get the socket address for logging
	 */
	public getAddress(): string {
		return this.address;
	}

	/**
	 * Get the socket
	 */
	public getSocket(): Socket {
		return this.socket;
	}

	/**
	 * Check if there are any pending protocol negotiations
	 * @returns true if there are pending negotiations, false otherwise
	 */
	public hasPendingNegotiations(): boolean {
		return this.pendingProtocols.size > 0;
	}

	/**
	 * Get the MCCP2 compressor if compression is active
	 * @returns The Deflate compressor if MCCP2 is negotiated, undefined otherwise
	 */
	public getCompressor(): Deflate | undefined {
		const mccp2State = this.getState(TELNET_OPTION.MCCP2);
		if (mccp2State === "negotiated") {
			return this.data.mccp2?.compressor;
		}
		return undefined;
	}

	/**
	 * Write data to the socket, using compression if MCCP2 is active
	 * @param data The data to write
	 * @returns true if the data was written successfully, false otherwise
	 */
	public write(data: Buffer): boolean {
		const compressor = this.getCompressor();
		if (compressor) {
			// Write to compressor if MCCP2 is active
			logger.debug(
				`Telnet negotiation (${this.address}): writing ${data.length} bytes to compressor`
			);
			compressor.write(data);
			compressor.flush(constants.Z_SYNC_FLUSH);
			return true;
		} else {
			// Write directly to socket if compression is not active
			if (!this.socket.destroyed && this.socket.writable) {
				return this.socket.write(data);
			}
			return false;
		}
	}

	/**
	 * Initiate negotiations for all configured protocols on connection
	 */
	public initiateNegotiations(): void {
		logger.debug(
			`Telnet negotiation (${this.address}): initiating negotiations for all enabled protocols`
		);
		// Track which protocols we're initiating
		const initiatedProtocols: TELNET_OPTION[] = [];
		for (const [option, config] of this.configs.entries()) {
			if (config.enabled && config.initiateOnConnect !== false) {
				const handler = this.handlers.get(option);
				if (handler && this.states.get(option) === "none") {
					// Mark as pending - will be removed when negotiation completes
					this.pendingProtocols.add(option);
					initiatedProtocols.push(option);
					this.initiateNegotiation(option);
				}
			} else if (!config.enabled) {
				// Explicitly disable if we don't want this protocol
				const handler = this.handlers.get(option);
				if (handler && handler.serverWillsOption) {
					this.setState(option, "disabled");
					// Send WON'T to reject if client asks
					// (we'll handle this in handleCommand)
				}
			}
		}
		logger.debug(
			`Telnet negotiation (${this.address}): initiated ${
				initiatedProtocols.length
			} protocol(s): ${initiatedProtocols.map(getProtocolName).join(", ")}`
		);
		// If no protocols were initiated, check if we're already complete
		this.checkIfAllComplete();
	}

	/**
	 * Initiate negotiation for a specific protocol
	 */
	private initiateNegotiation(option: TELNET_OPTION): void {
		const handler = this.handlers.get(option);
		if (!handler) {
			logger.warn(
				`No handler registered for protocol ${getProtocolName(option)} (${
					this.address
				})`
			);
			return;
		}

		const currentState = this.states.get(option) ?? "none";
		if (currentState !== "none" && currentState !== "disabled") {
			return; // Already negotiating or negotiated
		}

		if (handler.serverWillsOption) {
			// Server offers: send WILL
			this.setState(option, "pending_send");
			// Note: Initial negotiation commands must be sent uncompressed
			// (before MCCP2 is negotiated), so we write directly to socket
			if (!this.socket.destroyed && this.socket.writable) {
				this.socket.write(buildIACCommand(IAC.WILL, option));
				logger.debug(
					`Telnet negotiation (${
						this.address
					}): sent IAC WILL ${getProtocolName(option)}`
				);
			}
		} else {
			// Server requests: send DO
			this.setState(option, "pending_send");
			// Note: Initial negotiation commands must be sent uncompressed
			// (before MCCP2 is negotiated), so we write directly to socket
			if (!this.socket.destroyed && this.socket.writable) {
				this.socket.write(buildIACCommand(IAC.DO, option));
				logger.debug(
					`Telnet negotiation (${this.address}): sent IAC DO ${getProtocolName(
						option
					)}`
				);
			}
		}
	}

	/**
	 * Handle an incoming IAC command
	 */
	public handleCommand(
		command: IAC.DO | IAC.DONT | IAC.WILL | IAC.WONT,
		option: number
	): Buffer | null {
		const telnetOption = option as TELNET_OPTION;
		const handler = this.handlers.get(telnetOption);

		if (!handler) {
			// No handler for this option - default behavior
			// For unknown options, respond with WON'T or DON'T and mark as rejected
			// Always handle unhandled protocols to ensure IAC commands are removed from input stream
			// Use write() method to support compression if active
			const currentState = this.getState(telnetOption);

			// Only respond if we haven't already rejected it (to avoid duplicate responses)
			if (currentState !== "rejected") {
				if (command === IAC.DO) {
					// Client asking us to enable a protocol we don't support
					this.write(buildIACCommand(IAC.WONT, option));
					logger.debug(
						`Telnet negotiation (${
							this.address
						}): unhandled protocol ${getProtocolName(
							option
						)}, received IAC DO, sent IAC WON'T, marking as rejected`
					);
					this.setState(telnetOption, "rejected");
				} else if (command === IAC.WILL) {
					// Client offering a protocol we don't support
					this.write(buildIACCommand(IAC.DONT, option));
					logger.debug(
						`Telnet negotiation (${
							this.address
						}): unhandled protocol ${getProtocolName(
							option
						)}, received IAC WILL, sent IAC DON'T, marking as rejected`
					);
					this.setState(telnetOption, "rejected");
				} else if (command === IAC.DONT || command === IAC.WONT) {
					// For DONT/WONT on unknown protocols, just mark as rejected without responding
					// (client is already saying they don't want it)
					this.setState(telnetOption, "rejected");
					logger.debug(
						`Telnet negotiation (${
							this.address
						}): unhandled protocol ${getProtocolName(option)}, received ${
							command === IAC.DONT ? "IAC DON'T" : "IAC WON'T"
						}, marking as rejected`
					);
				}
			} else {
				// Already rejected, but still acknowledge to ensure command is processed and removed
				logger.debug(
					`Telnet negotiation (${
						this.address
					}): unhandled protocol ${getProtocolName(
						option
					)} already rejected, ignoring duplicate command`
				);
			}
			// Always return null to indicate we handled it (command will be removed from stream by processData)
			return null;
		}

		// Check if protocol is disabled
		const config = this.configs.get(telnetOption);
		if (config && !config.enabled) {
			// Protocol is disabled - reject
			// Use write() method to support compression if active
			if (command === IAC.DO && handler.serverWillsOption) {
				this.write(buildIACCommand(IAC.WONT, option));
				logger.debug(
					`Telnet negotiation (${this.address}): protocol ${getProtocolName(
						option
					)} is disabled, sent IAC WON'T`
				);
				this.setState(telnetOption, "disabled");
				if (handler.onRejected) {
					handler.onRejected(this, this.socket);
				}
			} else if (command === IAC.WILL && !handler.serverWillsOption) {
				this.write(buildIACCommand(IAC.DONT, option));
				logger.debug(
					`Telnet negotiation (${this.address}): protocol ${getProtocolName(
						option
					)} is disabled, sent IAC DON'T`
				);
				this.setState(telnetOption, "disabled");
				if (handler.onRejected) {
					handler.onRejected(this, this.socket);
				}
			}
			return null;
		}

		// Delegate to protocol handler
		handler.handleCommand(command, this, this.socket);
		return null; // Return null to indicate we handled it
	}

	/**
	 * Handle an incoming subnegotiation (IAC SB ... IAC SE)
	 */
	public handleSubnegotiation(option: number, data: Buffer): void {
		const telnetOption = option as TELNET_OPTION;
		const handler = this.handlers.get(telnetOption);

		if (handler && handler.handleSubnegotiation) {
			handler.handleSubnegotiation(data, this, this.socket);
		} else {
			logger.debug(
				`Telnet subnegotiation (${
					this.address
				}): unhandled subnegotiation for option ${getProtocolName(option)}`
			);
		}
	}

	/**
	 * Extract and remove telnet negotiations from data stream
	 * Returns the cleaned data buffer
	 */
	public processData(data: Buffer): Buffer {
		let binary = data.toString("binary");
		let result = binary;
		let i = 0;

		logger.debug(
			`Telnet negotiation (${this.address}): processData called with ${
				data.length
			} bytes: ${Array.from(data).join(",")}`
		);

		while (i < binary.length) {
			// Look for IAC byte (0xFF)
			const charCode = binary.charCodeAt(i);
			if (charCode === IAC.IAC && i + 1 < binary.length) {
				const nextByte = binary.charCodeAt(i + 1);
				logger.debug(
					`Telnet negotiation (${
						this.address
					}): found IAC byte at position ${i}, next byte: ${nextByte}, buffer length: ${
						binary.length
					}, remaining bytes: ${Array.from(
						Buffer.from(binary.substring(i), "binary")
					)
						.slice(0, 5)
						.join(",")}`
				);

				// Handle IAC IAC (escaped IAC byte)
				if (nextByte === IAC.IAC) {
					// Keep the single IAC, remove the escape
					result = result.substring(0, i) + "\xff" + result.substring(i + 2);
					binary = result;
					i += 1;
					continue;
				}

				// Handle IAC commands (DO, DONT, WILL, WONT)
				if (
					nextByte === IAC.DO ||
					nextByte === IAC.DONT ||
					nextByte === IAC.WILL ||
					nextByte === IAC.WONT
				) {
					if (i + 2 < binary.length) {
						const option = binary.charCodeAt(i + 2);
						logger.debug(
							`Telnet negotiation (${this.address}): processing IAC command ${nextByte} ${option} at position ${i}, removing from stream`
						);
						this.handleCommand(nextByte, option);

						// Remove the command from the stream
						result = result.substring(0, i) + result.substring(i + 3);
						binary = result;
						logger.debug(
							`Telnet negotiation (${this.address}): removed IAC command, result length: ${result.length}, original length: ${data.length}`
						);
						i = 0; // Reset to start to reprocess
						continue;
					} else {
						// Incomplete IAC command, wait for more data
						logger.debug(
							`Telnet negotiation (${this.address}): incomplete IAC command at position ${i}, waiting for more data`
						);
						break;
					}
				}

				// Handle IAC SB (subnegotiation start - 0xFF 0xFA)
				if (nextByte === IAC.SB) {
					// IAC SB
					let subEnd = i + 2;
					let foundSE = false;
					// Find IAC SE (0xFF 0xF0)
					while (subEnd < binary.length - 1) {
						if (
							binary.charCodeAt(subEnd) === IAC.IAC &&
							binary.charCodeAt(subEnd + 1) === IAC.SE
						) {
							// Found IAC SE
							foundSE = true;
							const option = binary.charCodeAt(i + 2);
							const subData = Buffer.from(
								binary.substring(i + 3, subEnd),
								"binary"
							);
							this.handleSubnegotiation(option, subData);

							// Remove subnegotiation from stream
							result = result.substring(0, i) + result.substring(subEnd + 2);
							binary = result;
							logger.debug(
								`Telnet negotiation (${
									this.address
								}): removed subnegotiation, remaining buffer length: ${
									result.length
								}, bytes: ${Array.from(Buffer.from(result, "binary")).join(
									","
								)}`
							);
							i = 0; // Reset to start to reprocess remaining data
							break;
						}
						subEnd++;
					}
					if (!foundSE) {
						// Incomplete subnegotiation, wait for more data
						logger.debug(
							`Telnet negotiation (${this.address}): incomplete subnegotiation, waiting for more data`
						);
						break;
					}
					// If we found and processed the subnegotiation, continue to check for more IAC commands
					continue;
				}

				// Handle IAC GA (Go Ahead - 0xFF 0xF9)
				if (nextByte === IAC.GA) {
					// Remove GA from stream
					result = result.substring(0, i) + result.substring(i + 2);
					binary = result;
					i = 0;
					continue;
				}

				// Unknown IAC command - remove it
				logger.debug(
					`Telnet negotiation (${this.address}): unknown IAC command ${nextByte} at position ${i}, removing single byte`
				);
				result = result.substring(0, i) + result.substring(i + 1);
				binary = result;
				i = 0; // Reset to start after removal
				continue;
			}

			// Not an IAC byte, move to next position
			i++;
		}

		const cleaned = Buffer.from(result, "binary");
		if (cleaned.length !== data.length) {
			logger.debug(
				`Telnet negotiation (${this.address}): processData removed ${
					data.length - cleaned.length
				} bytes, returning ${cleaned.length} bytes: ${Array.from(cleaned).join(
					","
				)}`
			);
		}
		return cleaned;
	}
}
