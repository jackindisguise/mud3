/**
 * Logger module — structured application logging
 *
 * Provides a preconfigured Winston logger used across the project.
 * It writes JSON-formatted logs to files and colorized human-readable logs
 * to the console (console output is disabled during tests).
 *
 * Transports
 * - File (errors): `logs/error-YYYY-MM-DD-HHMMSS[.test].log` at level `error`
 * - File (app):    `logs/app-YYYY-MM-DD-HHMMSS[.test].log` at level `debug`
 * - Console: colorized output at `LOG_LEVEL` (default `info`), disabled when
 *   `process.env.NODE_TEST_CONTEXT` is set
 *
 * Formatting
 * - Files: timestamp + uppercase level + message + JSON meta (no colors)
 * - Console: timestamp + colorized level + message (+ meta when provided)
 *
 * Usage
 * ```ts
 * import logger from './logger.js';
 *
 * logger.info('Server started on port %d', 4000);
 * logger.warn('Low memory warning');
 * logger.error('Failure', { err });
 * logger.debug('Details', { payload });
 * ```
 *
 * Notes
 * - Set `LOG_LEVEL` to control console verbosity (files always log at `debug`).
 * - Console output is disabled in test runs via `NODE_TEST_CONTEXT` to keep
 *   test output clean; file transports remain active.
 * - All logged metadata is serialized to JSON in files for easy parsing.
 *
 * @module logger
 */
import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if we're running tests
// Check for node:test runner or jest/mocha
const isTestMode = process.env.NODE_TEST_CONTEXT;

// Generate timestamp for log filenames (YYYY-MM-DD)
const timestamp = new Date().toISOString().split("T");
const date = timestamp[0];
const hmsTimestamp = timestamp[1];
const zTimestamp = hmsTimestamp.split(".")[0];
const HMS = zTimestamp.split(":").join("");
const testSuffix = isTestMode ? ".test" : "";

/**
 * Application logger using Winston.
 *
 * Provides dual output:
 * - Console: Colorized output with timestamp for development
 * - File: Plain text output in logs/app.log for production/debugging
 *
 * Log levels (from highest to lowest priority):
 * - error: Error messages that need immediate attention
 * - warn: Warning messages for potentially problematic situations
 * - info: General informational messages about application flow
 * - http: HTTP request logging (if needed)
 * - verbose: Detailed information for debugging
 * - debug: Very detailed debugging information
 * - silly: Extremely detailed trace information
 *
 * @example
 * ```typescript
 * import logger from './logger.js';
 *
 * logger.info('Server started on port 3000');
 * logger.warn('Low memory warning');
 * logger.error('Failed to connect to database', { error: err });
 * logger.debug('Processing user input', { input: userCommand });
 * ```
 */

const logger = winston.createLogger({
	level: "debug", // Set to debug to capture all levels
	format: winston.format.combine(
		winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.json()
	),
	defaultMeta: { service: "mud3" },
	transports: [
		// File transport - plain text without colors
		new winston.transports.File({
			filename: path.join(
				__dirname,
				"..",
				"..",
				"logs",
				`error-${date}-${HMS}${testSuffix}.log`
			),
			level: "error",
			format: winston.format.combine(
				winston.format.uncolorize(),
				winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
				winston.format.printf(
					({ timestamp, level, message, ...meta }) =>
						`[${timestamp}] ${level.toUpperCase()}: ${message}${
							Object.keys(meta).length ? " " + JSON.stringify(meta) : ""
						}`
				)
			),
		}),
		new winston.transports.File({
			filename: path.join(
				__dirname,
				"..",
				"..",
				"logs",
				`app-${date}-${HMS}${testSuffix}.log`
			),
			level: "debug", // File gets all logs including debug
			format: winston.format.combine(
				winston.format.uncolorize(),
				winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
				winston.format.printf(
					({ timestamp, level, message, ...meta }) =>
						`[${timestamp}] ${level.toUpperCase()}: ${message}${
							Object.keys(meta).length ? " " + JSON.stringify(meta) : ""
						}`
				)
			),
		}),
		// Console transport - colorized output, info level by default
		// Disabled during test mode
		...(!isTestMode
			? [
					new winston.transports.Console({
						level: process.env.LOG_LEVEL || "debug", // Console respects LOG_LEVEL or defaults to info
						format: winston.format.combine(
							winston.format.colorize(),
							winston.format.timestamp({ format: "HH:mm:ss" }),
							winston.format.printf(
								({ timestamp, level, message, ...meta }) =>
									`[${timestamp}] ${level}: ${message}${
										Object.keys(meta).length && meta.service === undefined
											? " " + JSON.stringify(meta)
											: ""
									}`
							)
						),
					}),
			  ]
			: []),
	],
});

export default logger;
