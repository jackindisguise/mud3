/**
 * Server TUI - Terminal User Interface for monitoring the MUD server
 *
 * Displays:
 * - Real-time server logs in a scrollable box
 * - World state information (connections, players online)
 * - Scrollable list of logged-in characters with their information
 * - Shutdown button
 */

import blessed from "neo-blessed";
import winston from "winston";
import logger from "../utils/logger.js";
import {
	getGameStats,
	forEachCharacter,
	getStopGameFunction,
} from "../game.js";
import type { Character } from "../core/character.js";
import { Room } from "../core/dungeon.js";
import { getCurrentTime, getCalendar } from "../registry/calendar.js";

interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
}

const MAX_LOG_ENTRIES = 1000;
const REFRESH_INTERVAL_MS = 500;

class ServerTUI {
	private screen: any;
	private logBox: any;
	private calendarBox: any;
	private uptimeBox: any;
	private statsBox: any;
	private characterList: any;
	private shutdownButton: any;
	private logEntries: LogEntry[] = [];
	private selectedIndex: number = 0;
	private characters: Character[] = [];
	private isShuttingDown: boolean = false;

	constructor() {
		this.screen = blessed.screen({
			smartCSR: true,
			title: "MUD Server Monitor",
			cursor: {
				artificial: false,
				shape: "line",
				blink: false,
			},
			fastCSR: true,
		});

		this.setupLayout();
		this.setupKeyHandlers();
		this.setupLoggerHook();
		this.startRefreshLoop();
	}

	private setupLayout(): void {
		// Log box (left side, takes most of the screen)
		this.logBox = blessed.log({
			top: 1,
			left: 0,
			width: "60%",
			bottom: 1, // Leave 1 line at bottom for border
			label: " Server Logs ",
			border: {
				type: "line",
			},
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: " ",
				inverse: true,
			},
			wrap: true,
			tags: true,
			style: {
				border: {
					fg: "blue",
				},
				fg: "white",
				focus: {
					border: {
						fg: "blue",
						bold: true,
					},
				},
			},
			mouse: true,
			keys: true,
			vi: true,
		});

		// Calendar box (top right) - fixed height
		this.calendarBox = blessed.box({
			top: 1,
			left: "60%",
			width: "40%",
			height: 10, // Fixed 10 lines for calendar info
			label: " Calendar ",
			border: {
				type: "line",
			},
			content: "",
			tags: true,
			wrap: true,
			valign: "top",
			padding: {
				top: 0,
				bottom: 0,
			},
			style: {
				border: {
					fg: "cyan",
				},
				fg: "white",
			},
		});

		// Uptime box (below calendar) - fixed height
		this.uptimeBox = blessed.box({
			top: 11, // After calendar box (1 + 10)
			left: "60%",
			width: "40%",
			height: 4, // Fixed 4 lines for uptime
			label: " Session Uptime ",
			border: {
				type: "line",
			},
			content: "",
			tags: true,
			wrap: true,
			valign: "top",
			padding: {
				top: 0,
				bottom: 0,
			},
			style: {
				border: {
					fg: "magenta",
				},
				fg: "white",
			},
		});

		// Stats box (below uptime) - fixed height
		this.statsBox = blessed.box({
			top: 15, // After calendar + uptime boxes (1 + 10 + 4)
			left: "60%",
			width: "40%",
			height: 6, // Fixed 6 lines for stats
			label: " World State ",
			border: {
				type: "line",
			},
			content: "",
			tags: true,
			wrap: true,
			style: {
				border: {
					fg: "green",
				},
				fg: "white",
			},
		});

		// Character list (middle right) - fills remaining space
		this.characterList = blessed.list({
			top: 21, // After calendar + uptime + stats boxes (1 + 10 + 4 + 6)
			bottom: 4, // Leave space for shutdown button (1 + 3)
			left: "60%",
			width: "40%",
			label: " Characters (↑↓ to scroll, Enter for details) ",
			border: {
				type: "line",
			},
			items: [],
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: " ",
				inverse: true,
			},
			style: {
				border: {
					fg: "yellow",
				},
				focus: {
					border: {
						fg: "yellow",
						bold: true,
					},
				},
				selected: {
					bg: "blue",
					fg: "white",
				},
				item: {
					fg: "white",
				},
			},
			keys: true,
			vi: true,
			mouse: true,
		});

		// Shutdown button (bottom right) - fixed height
		this.shutdownButton = blessed.button({
			bottom: 1,
			left: "60%",
			width: "40%",
			height: 3, // Fixed 3 lines
			content: " Shutdown Server ",
			align: "center",
			valign: "middle",
			border: {
				type: "line",
			},
			style: {
				border: {
					fg: "red",
				},
				fg: "white",
				hover: {
					bg: "darkred",
				},
				focus: {
					border: {
						fg: "red",
						bold: true,
					},
				},
			},
			keys: true,
			mouse: true,
		});

		// Add all widgets directly to screen
		this.screen.append(this.logBox);
		this.screen.append(this.calendarBox);
		this.screen.append(this.uptimeBox);
		this.screen.append(this.statsBox);
		this.screen.append(this.characterList);
		this.screen.append(this.shutdownButton);

		// Focus on character list initially
		this.characterList.focus();
	}

	private setupKeyHandlers(): void {
		// Quit on Escape, Q, or Ctrl+C
		this.screen.key(["escape", "q", "C-c"], () => {
			return this.quit();
		});

		// Shutdown button handlers
		this.shutdownButton.on("press", () => {
			this.shutdown();
		});

		this.shutdownButton.key("enter", () => {
			this.shutdown();
		});

		// Character list navigation
		this.characterList.key(["up", "k"], () => {
			this.characterList.up();
			this.screen.render();
		});

		this.characterList.key(["down", "j"], () => {
			this.characterList.down();
			this.screen.render();
		});

		// Tab to switch focus between log box, character list, and shutdown button
		this.screen.key("tab", () => {
			const focused = this.screen.focused;
			if (focused === this.characterList) {
				this.logBox.focus();
			} else if (focused === this.logBox) {
				this.shutdownButton.focus();
			} else {
				this.characterList.focus();
			}
			this.screen.render();
		});

		// Log box scrolling
		this.logBox.key(["up", "k"], () => {
			this.logBox.scroll(-1);
			this.screen.render();
		});

		this.logBox.key(["down", "j"], () => {
			this.logBox.scroll(1);
			this.screen.render();
		});

		this.logBox.key(["pageup", "ctrl-b"], () => {
			this.logBox.scroll(-this.logBox.height as number);
			this.screen.render();
		});

		this.logBox.key(["pagedown", "ctrl-f"], () => {
			this.logBox.scroll(this.logBox.height as number);
			this.screen.render();
		});
	}

	private consoleTransport: any = null;

	private setupLoggerHook(): void {
		// Remove console transport to prevent it from writing to stdout and interfering with blessed
		const transports = (logger as any).transports;
		for (let i = transports.length - 1; i >= 0; i--) {
			if (transports[i] instanceof winston.transports.Console) {
				this.consoleTransport = transports[i];
				(logger as any).remove(transports[i]);
			}
		}

		// Create a custom winston transport to capture logs
		class TUITransport extends winston.transports.Console {
			private tui: ServerTUI;

			constructor(tui: ServerTUI) {
				super({
					level: "debug",
				});
				this.tui = tui;
			}

			log(info: any, callback: () => void): void {
				setImmediate(() => {
					if (!this.tui.isShuttingDown && this.tui.logBox) {
						const timestamp = info.timestamp
							? new Date(info.timestamp).toLocaleTimeString()
							: new Date().toLocaleTimeString();

						// Ensure level is a string
						let level = info.level || "info";
						if (typeof level !== "string") {
							level = String(level);
						}

						let message = info.message || "";

						// Handle splat format (winston.format.splat())
						if (typeof message !== "string") {
							message = JSON.stringify(message);
						}

						// Remove ANSI color codes for TUI display
						const cleanMessage = message.replace(/\u001b\[[0-9;]*m/g, "");

						// Format log entry for display using blessed markup
						const levelColor = this.tui.getLevelColor(level);
						// Blessed markup: {color-fg}text{/} for colors, {bold}text{/bold} for bold
						const logLine = `{${levelColor}-fg}[${timestamp}]{/} {bold}${level.toUpperCase()}{/bold}: ${cleanMessage}`;

						// Add to log box
						try {
							this.tui.logBox.log(logLine);
						} catch (error) {
							// Ignore errors if logBox is not ready
						}
					}
				});
				callback();
			}
		}

		// Add transport to winston logger
		const transport = new TUITransport(this);
		logger.add(transport);
	}

	public getLevelColor(level: string | number | any): string {
		// Ensure level is a string
		const levelStr = typeof level === "string" ? level : String(level);

		switch (levelStr.toLowerCase()) {
			case "error":
				return "red";
			case "warn":
			case "warning":
				return "yellow";
			case "info":
				return "green";
			case "debug":
				return "cyan";
			default:
				return "white";
		}
	}

	private formatCharacterInfo(character: Character): string {
		const username = character.credentials.username;
		const mob = character.mob;
		let location = "Unknown";

		if (mob?.location instanceof Room) {
			const roomRef = mob.location.getRoomRef();
			location = roomRef || "Unknown";
		}

		const level = mob?.level || 0;
		const health = mob?.health || 0;
		const maxHealth = mob?.maxHealth || 0;
		const mana = mob?.mana || 0;
		const maxMana = mob?.maxMana || 0;
		const raceId = mob?.race?.id || "Unknown";
		const jobId = mob?.job?.id || "Unknown";

		// Truncate long usernames
		const displayName =
			username.length > 15 ? username.substring(0, 12) + "..." : username;

		return `${displayName.padEnd(18)} | Lv${level
			.toString()
			.padStart(3)} | ${raceId.substring(0, 8).padEnd(8)} | ${jobId
			.substring(0, 10)
			.padEnd(
				10
			)} | HP:${health}/${maxHealth} | MP:${mana}/${maxMana} | ${location}`;
	}

	private updateCalendar(): void {
		const time = getCurrentTime();
		const calendar = getCalendar();

		// Determine day/night icon based on calendar day percentage
		// Calendar defines: morning at 25%, night at 75%
		// So day is roughly 25% to 75% of the day
		let isDay = false;
		if (time && calendar) {
			const hoursPerDay = calendar.hoursPerDay;
			const dayPercent = time.hour / hoursPerDay;
			// Day is between morning (25%) and night (75%)
			isDay = dayPercent >= 0.25 && dayPercent < 0.75;
		}
		const timeIcon = isDay ? "☀" : "☾";

		const calendarLines: string[] = [];
		if (time && calendar) {
			const dayName = calendar.days[time.dayOfWeek]?.name ?? "Unknown";
			const monthName = calendar.months[time.month]?.name ?? "Unknown";
			// Calculate week number: total days elapsed / days per week + 1
			const daysPerWeek = calendar.days.length;
			const totalDays = time.year * 365 + time.month * 30 + time.day; // Approximate
			const weekNumber = Math.floor((totalDays - 1) / daysPerWeek) + 1;

			calendarLines.push(
				`${timeIcon} {bold}${calendar.name}{/bold}`,
				"",
				`Year:   ${time.year + 1}`,
				`Month:  ${monthName}`,
				`Week:   ${weekNumber}`,
				`Day:    ${dayName} (${time.day})`,
				`Time:   ${time.hour.toString().padStart(2, "0")}:${time.minute
					.toString()
					.padStart(2, "0")}:${time.second.toString().padStart(2, "0")}`
			);
		} else {
			calendarLines.push("{bold}Calendar:{/bold} Not available");
		}

		const calendarContent = calendarLines.join("\n").replace(/\n+$/, "");
		this.calendarBox.setContent(calendarContent);
	}

	private updateUptime(): void {
		const uptimeText = `{bold}Uptime:{/bold} ${this.formatUptime()}`.replace(
			/\n+$/,
			""
		);

		this.uptimeBox.setContent(uptimeText);
	}

	private updateStats(): void {
		const stats = getGameStats();
		const statsText = [
			`{bold}Connections:{/bold} ${stats.activeConnections}`,
			`{bold}Players:{/bold}     ${stats.playersOnline}`,
			"",
			"{bold}Controls:{/bold}",
			"  Tab/↑↓/Q",
		].join("\n");

		this.statsBox.setContent(statsText);
	}

	private formatUptime(): string {
		const uptime = process.uptime();
		const hours = Math.floor(uptime / 3600);
		const minutes = Math.floor((uptime % 3600) / 60);
		const seconds = Math.floor(uptime % 60);
		return `${hours.toString().padStart(2, "0")}:${minutes
			.toString()
			.padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}

	private updateCharacterList(): void {
		this.characters = [];
		forEachCharacter((character) => {
			this.characters.push(character);
		});

		// Sort characters by username
		this.characters.sort((a, b) =>
			a.credentials.username.localeCompare(b.credentials.username)
		);

		const items = this.characters.map((char) => this.formatCharacterInfo(char));

		this.characterList.setItems(items);

		// Update label with count
		const label = ` Characters (${this.characters.length}) - ↑↓ to scroll `;
		this.characterList.setLabel(label);
	}

	private startRefreshLoop(): void {
		setInterval(() => {
			if (!this.isShuttingDown) {
				this.updateCalendar();
				this.updateUptime();
				this.updateStats();
				this.updateCharacterList();
				this.screen.render();
			}
		}, REFRESH_INTERVAL_MS);
	}

	private async shutdown(): Promise<void> {
		if (this.isShuttingDown) return;

		this.isShuttingDown = true;
		const stopFunction = getStopGameFunction();

		if (stopFunction) {
			this.logBox.log("{red-fg}Initiating graceful shutdown...{/}");
			this.screen.render();

			try {
				await stopFunction();
				this.logBox.log("{green-fg}Server shut down successfully.{/}");
				this.screen.render();

				// Wait a moment then exit
				setTimeout(() => {
					this.quit();
				}, 1000);
			} catch (error) {
				this.logBox.log(`{red-fg}Error during shutdown: ${error}{/}`);
				this.screen.render();
			}
		} else {
			this.logBox.log("{yellow-fg}No stop function available.{/}");
			this.screen.render();
		}
	}

	private quit(): void {
		this.isShuttingDown = true;

		// Show cursor before cleanup
		try {
			process.stdout.write("\x1b[?25h"); // Show cursor
		} catch (e) {
			// Ignore errors
		}

		// Restore console transport if it was removed
		if (this.consoleTransport) {
			logger.add(this.consoleTransport);
			this.consoleTransport = null;
		}

		return blessed.cleanup();
	}

	public render(): void {
		this.screen.render();
	}

	public start(): void {
		// Hide cursor
		try {
			process.stdout.write("\x1b[?25l"); // Hide cursor
		} catch (e) {
			// Ignore errors
		}

		// Initial render
		this.updateCalendar();
		this.updateUptime();
		this.updateStats();
		this.updateCharacterList();
		this.logBox.log(
			"{green-fg}Server TUI started. Press Tab to switch focus, Q to quit.{/}"
		);
		this.screen.render();

		// Ensure cursor stays hidden
		try {
			process.stdout.write("\x1b[?25l"); // Hide cursor
		} catch (e) {
			// Ignore errors
		}

		// Handle resize
		this.screen.on("resize", () => {
			try {
				process.stdout.write("\x1b[?25l"); // Hide cursor
			} catch (e) {
				// Ignore errors
			}
			this.screen.render();
		});
	}
}

let tuiInstance: ServerTUI | null = null;

/**
 * Start the server TUI
 */
export function startServerTUI(): void {
	// Only start TUI if running in an interactive terminal
	if (!process.stdout.isTTY) {
		logger.debug("Not running in TTY, skipping TUI");
		return;
	}

	if (tuiInstance) {
		logger.warn("TUI already started");
		return;
	}

	try {
		tuiInstance = new ServerTUI();
		tuiInstance.start();
	} catch (error) {
		logger.error("Failed to start TUI:", error);
	}
}

/**
 * Stop the server TUI
 */
export function stopServerTUI(): void {
	if (tuiInstance) {
		try {
			(tuiInstance as any).quit();
			tuiInstance = null;
		} catch (error) {
			logger.error("Error stopping TUI:", error);
		}
	}
}
