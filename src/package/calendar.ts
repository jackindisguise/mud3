/**
 * Package: calendar - Calendar configuration loader
 *
 * Loads `data/calendar.yaml` and updates the calendar registry.
 *
 * Behavior
 * - Reads YAML from `data/calendar.yaml`
 * - Validates calendar structure
 * - Sets up calendar in registry with derived properties
 *
 * @example
 * import calendarPkg from './package/calendar.js';
 * import { getCurrentTime, getCurrentDay } from '../registry/calendar.js';
 * await calendarPkg.loader();
 * const time = getCurrentTime();
 *
 * @module package/calendar
 */
import { Package } from "package-loader";
import { join, relative } from "path";
import { readFile } from "fs/promises";
import YAML from "js-yaml";
import logger from "../logger.js";
import { getSafeRootDirectory } from "../utils/path.js";
import { Calendar, setCalendar } from "../registry/calendar.js";
import gamestatePkg from "./gamestate.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const CALENDAR_PATH = join(DATA_DIRECTORY, "calendar.yaml");

export async function loadCalendar(): Promise<void> {
	logger.debug(
		`Loading calendar from ${relative(ROOT_DIRECTORY, CALENDAR_PATH)}`
	);
	try {
		const content = await readFile(CALENDAR_PATH, "utf-8");
		const parsed = YAML.load(content) as Partial<Calendar> | undefined;

		if (!parsed) {
			throw new Error("Calendar file is empty or invalid");
		}

		// Validate required fields
		if (!parsed.name) {
			throw new Error("Calendar must have a 'name' field");
		}
		if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
			throw new Error("Calendar must have a non-empty 'days' array");
		}
		if (!Array.isArray(parsed.months) || parsed.months.length === 0) {
			throw new Error("Calendar must have a non-empty 'months' array");
		}
		if (
			typeof parsed.millisecondsPerSecond !== "number" ||
			parsed.millisecondsPerSecond < 1
		) {
			throw new Error(
				"Calendar must have a valid 'millisecondsPerSecond' >= 1"
			);
		}
		if (
			typeof parsed.secondsPerMinute !== "number" ||
			parsed.secondsPerMinute < 1
		) {
			throw new Error("Calendar must have a valid 'secondsPerMinute' >= 1");
		}
		if (
			typeof parsed.minutesPerHour !== "number" ||
			parsed.minutesPerHour < 1
		) {
			throw new Error("Calendar must have a valid 'minutesPerHour' >= 1");
		}
		if (typeof parsed.hoursPerDay !== "number" || parsed.hoursPerDay < 1) {
			throw new Error("Calendar must have a valid 'hoursPerDay' >= 1");
		}

		// Validate days structure
		for (let i = 0; i < parsed.days.length; i++) {
			const day = parsed.days[i];
			if (!day || typeof day.name !== "string") {
				throw new Error(`Day at index ${i} must have a 'name' string field`);
			}
		}

		// Validate months structure
		for (let i = 0; i < parsed.months.length; i++) {
			const month = parsed.months[i];
			if (!month || typeof month.name !== "string") {
				throw new Error(`Month at index ${i} must have a 'name' string field`);
			}
			if (typeof month.days !== "number" || month.days < 1) {
				throw new Error(
					`Month at index ${i} must have a 'days' number field >= 1`
				);
			}
		}

		const calendar: Calendar = {
			name: parsed.name,
			days: parsed.days,
			months: parsed.months,
			millisecondsPerSecond: parsed.millisecondsPerSecond,
			secondsPerMinute: parsed.secondsPerMinute,
			minutesPerHour: parsed.minutesPerHour,
			hoursPerDay: parsed.hoursPerDay,
		};

		setCalendar(calendar);
		logger.info("Calendar loaded successfully");
	} catch (error) {
		if (error instanceof Error) {
			logger.error(`Failed to load calendar: ${error.message}`);
		} else {
			logger.error(`Failed to load calendar: ${error}`);
		}
		throw error;
	}
}

export default {
	name: "calendar",
	dependencies: [gamestatePkg],
	loader: async () => {
		await loadCalendar();
	},
} as Package;
