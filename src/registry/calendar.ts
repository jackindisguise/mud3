/**
 * Registry: calendar - centralized calendar access
 *
 * Provides a centralized location for accessing calendar data and time calculations.
 * The calendar is loaded and updated by the calendar package.
 *
 * @module registry/calendar
 */

import { EventEmitter } from "events";
import { DeepReadonly } from "../utils/types.js";
import { getElapsedTime } from "./gamestate.js";
import { setRelativeInterval, clearCustomInterval } from "accurate-intervals";

// Calendar event emitter
export const calendarEvents = new EventEmitter();

// Calendar data
let CALENDAR: Calendar | null = null;
let DERIVED: CalendarDerived | null = null;

// Interval IDs for calendar events (from setRelativeInterval)
let minuteInterval: number | undefined;
let hourInterval: number | undefined;
let dayInterval: number | undefined;
let weekInterval: number | undefined;
let monthInterval: number | undefined;
let yearInterval: number | undefined;
let morningInterval: number | undefined;
let nightInterval: number | undefined;

// Timeout IDs for initial delays (from setSafeTimeout)
// Arrays track all timeout IDs in case of chained timeouts
let minuteTimeouts: NodeJS.Timeout[] = [];
let hourTimeouts: NodeJS.Timeout[] = [];
let dayTimeouts: NodeJS.Timeout[] = [];
let weekTimeouts: NodeJS.Timeout[] = [];
let monthTimeouts: NodeJS.Timeout[] = [];
let yearTimeouts: NodeJS.Timeout[] = [];
let morningTimeouts: NodeJS.Timeout[] = [];
let nightTimeouts: NodeJS.Timeout[] = [];

/**
 * Maximum safe timeout value for setTimeout (32-bit signed integer max).
 * setTimeout will overflow if given a value larger than this.
 */
const MAX_TIMEOUT_MS = 2147483647;

export interface CalendarDay {
	name: string;
}

export interface CalendarMonth {
	name: string;
	days: number;
}

export interface Calendar {
	name: string;
	days: CalendarDay[];
	months: CalendarMonth[];
	millisecondsPerSecond: number;
	secondsPerMinute: number;
	minutesPerHour: number;
	hoursPerDay: number;
}

export interface CalendarDerived {
	millisecondsPerMinute: number;
	millisecondsPerHour: number;
	millisecondsPerDay: number;
	millisecondsPerWeek: number;
	millisecondsPerYear: number;
	daysPerYear: number;
	daysPerWeek: number;
}

export interface CalendarTime {
	year: number;
	month: number;
	day: number;
	dayOfWeek: number;
	hour: number;
	minute: number;
	second: number;
}

/**
 * Calculate derived calendar properties.
 */
function calculateDerived(calendar: Calendar): CalendarDerived {
	const millisecondsPerMinute =
		calendar.secondsPerMinute * calendar.millisecondsPerSecond;
	const millisecondsPerHour = calendar.minutesPerHour * millisecondsPerMinute;
	const millisecondsPerDay = calendar.hoursPerDay * millisecondsPerHour;
	const daysPerWeek = calendar.days.length;
	const millisecondsPerWeek = millisecondsPerDay * daysPerWeek;
	const daysPerYear = calendar.months.reduce(
		(sum, month) => sum + month.days,
		0
	);
	const millisecondsPerYear = daysPerYear * millisecondsPerDay;

	return {
		millisecondsPerMinute,
		millisecondsPerHour,
		millisecondsPerDay,
		millisecondsPerWeek,
		millisecondsPerYear,
		daysPerYear,
		daysPerWeek,
	};
}

/**
 * Set the calendar object.
 * @param calendar - The calendar object to set.
 */
export function setCalendar(calendar: Calendar): void {
	CALENDAR = calendar;
	DERIVED = calculateDerived(calendar);
	setupCalendarEvents();
}

/**
 * Get the calendar object.
 * @returns The calendar object, or null if not loaded
 */
export function getCalendar(): DeepReadonly<Calendar> | null {
	return CALENDAR;
}

/**
 * Get the derived calendar properties.
 * @returns The derived properties, or null if calendar not loaded
 */
export function getDerived(): DeepReadonly<CalendarDerived> | null {
	return DERIVED;
}

/**
 * Get the current elapsed time within a minute period.
 */
function getCurrentMinuteElapsed(): number {
	if (!DERIVED) return 0;
	return getElapsedTime() % DERIVED.millisecondsPerMinute;
}

/**
 * Get the current elapsed time within an hour period.
 */
function getCurrentHourElapsed(): number {
	if (!DERIVED) return 0;
	return getElapsedTime() % DERIVED.millisecondsPerHour;
}

/**
 * Get the current elapsed time within a day period.
 */
function getCurrentDayElapsed(): number {
	if (!DERIVED) return 0;
	return getElapsedTime() % DERIVED.millisecondsPerDay;
}

/**
 * Get the current elapsed time within a week period.
 */
function getCurrentWeekElapsed(): number {
	if (!DERIVED) return 0;
	return getElapsedTime() % DERIVED.millisecondsPerWeek;
}

/**
 * Get the current elapsed time within a year period.
 */
function getCurrentYearElapsed(): number {
	if (!DERIVED) return 0;
	return getElapsedTime() % DERIVED.millisecondsPerYear;
}

/**
 * Get the current month and elapsed time within that month.
 * This is more complex because months have variable lengths.
 */
function getCurrentMonthInfo(): { month: number; elapsed: number } {
	if (!CALENDAR || !DERIVED) return { month: 0, elapsed: 0 };

	const yearElapsed = getCurrentYearElapsed();
	const millisecondsPerDay = DERIVED.millisecondsPerDay;

	// Step through each month to find which one we're in
	let remaining = yearElapsed;
	for (let i = 0; i < CALENDAR.months.length; i++) {
		const monthDays = CALENDAR.months[i].days;
		const monthDuration = monthDays * millisecondsPerDay;

		if (remaining < monthDuration) {
			return { month: i, elapsed: remaining };
		}

		remaining -= monthDuration;
	}

	// Should never reach here, but fallback to first month
	return { month: 0, elapsed: 0 };
}

/**
 * Get the current second (0 to secondsPerMinute - 1).
 */
export function getCurrentSecond(): number {
	if (!CALENDAR || !DERIVED) return 0;
	const minuteElapsed = getCurrentMinuteElapsed();
	return Math.floor(minuteElapsed / CALENDAR.millisecondsPerSecond);
}

/**
 * Get the current minute (0 to minutesPerHour - 1).
 */
export function getCurrentMinute(): number {
	if (!CALENDAR || !DERIVED) return 0;
	const hourElapsed = getCurrentHourElapsed();
	return Math.floor(hourElapsed / DERIVED.millisecondsPerMinute);
}

/**
 * Get the current hour (0 to hoursPerDay - 1).
 */
export function getCurrentHour(): number {
	if (!CALENDAR || !DERIVED) return 0;
	const dayElapsed = getCurrentDayElapsed();
	return Math.floor(dayElapsed / DERIVED.millisecondsPerHour);
}

/**
 * Get the current day of the month (1 to month.days).
 */
export function getCurrentDay(): number {
	if (!CALENDAR || !DERIVED) return 1;
	const monthInfo = getCurrentMonthInfo();
	const dayElapsed = monthInfo.elapsed;
	const dayNumber = Math.floor(dayElapsed / DERIVED.millisecondsPerDay);
	return dayNumber + 1; // Days are 1-indexed
}

/**
 * Get the current day of the week (0 to daysPerWeek - 1).
 */
export function getDayOfWeek(): number {
	if (!CALENDAR || !DERIVED) return 0;
	const weekElapsed = getCurrentWeekElapsed();
	const dayOfWeek = Math.floor(weekElapsed / DERIVED.millisecondsPerDay);
	return dayOfWeek;
}

/**
 * Get the current month index (0 to months.length - 1).
 */
export function getCurrentMonth(): number {
	if (!CALENDAR) return 0;
	return getCurrentMonthInfo().month;
}

/**
 * Get the current year (0-based, starting from game start).
 */
export function getCurrentYear(): number {
	if (!DERIVED) return 0;
	const yearElapsed = getCurrentYearElapsed();
	const totalElapsed = getElapsedTime();
	return Math.floor((totalElapsed - yearElapsed) / DERIVED.millisecondsPerYear);
}

/**
 * Get all current time information.
 */
export function getCurrentTime(): CalendarTime | null {
	if (!CALENDAR) return null;

	return {
		year: getCurrentYear(),
		month: getCurrentMonth(),
		day: getCurrentDay(),
		dayOfWeek: getDayOfWeek(),
		hour: getCurrentHour(),
		minute: getCurrentMinute(),
		second: getCurrentSecond(),
	};
}

/**
 * Convert a date number to its ordinal form (1st, 2nd, 3rd, etc.).
 * @param date - The date number to convert
 * @returns The ordinal form of the date
 */
export function toOrdinal(date: number): string {
	if (date === 11) return "11th";
	if (date === 12) return "12th";
	if (date === 13) return "13th";
	const suffix = date % 10;
	if (suffix === 1) {
		return `${date}st`;
	} else if (suffix === 2) {
		return `${date}nd`;
	} else if (suffix === 3) {
		return `${date}rd`;
	} else {
		return `${date}th`;
	}
}

/**
 * Set a timeout that handles values larger than MAX_TIMEOUT_MS by breaking
 * them into chunks. For values <= MAX_TIMEOUT_MS, behaves like setTimeout.
 * Tracks all timeout IDs in the provided array so they can be cleared.
 * @param callback - Function to call when timeout completes
 * @param delay - Delay in milliseconds (can exceed MAX_TIMEOUT_MS)
 * @param timeoutIds - Array to store all timeout IDs for clearing
 * @returns First timeout ID
 */
function setSafeTimeout(
	callback: () => void,
	delay: number,
	timeoutIds: NodeJS.Timeout[]
): NodeJS.Timeout {
	if (delay <= MAX_TIMEOUT_MS) {
		const id = setTimeout(callback, delay);
		timeoutIds.push(id);
		return id;
	}

	// For delays larger than MAX_TIMEOUT_MS, break into chunks
	const remaining = delay - MAX_TIMEOUT_MS;
	const id = setTimeout(() => {
		setSafeTimeout(callback, remaining, timeoutIds);
	}, MAX_TIMEOUT_MS);
	timeoutIds.push(id);
	return id;
}

/**
 * Setup calendar event intervals.
 */
function setupCalendarEvents(): void {
	if (!CALENDAR || !DERIVED) return;

	// Clear existing intervals
	clearCalendarEvents();

	const elapsed = getElapsedTime();

	// Calculate next event times
	const millisecondsPerMinute = DERIVED.millisecondsPerMinute;
	const millisecondsPerHour = DERIVED.millisecondsPerHour;
	const millisecondsPerDay = DERIVED.millisecondsPerDay;
	const millisecondsPerWeek = DERIVED.millisecondsPerWeek;
	const millisecondsPerYear = DERIVED.millisecondsPerYear;

	// Calculate when the next period boundary occurs
	const nextMinute = millisecondsPerMinute - (elapsed % millisecondsPerMinute);
	const nextHour = millisecondsPerHour - (elapsed % millisecondsPerHour);
	const nextDay = millisecondsPerDay - (elapsed % millisecondsPerDay);
	const nextWeek = millisecondsPerWeek - (elapsed % millisecondsPerWeek);
	const nextYear = millisecondsPerYear - (elapsed % millisecondsPerYear);

	// Calculate next month (more complex due to variable month lengths)
	const yearElapsed = elapsed % millisecondsPerYear;
	let monthRemaining = yearElapsed;
	let nextMonth = 0;
	for (let i = 0; i < CALENDAR.months.length; i++) {
		const monthDays = CALENDAR.months[i].days;
		const monthDuration = monthDays * millisecondsPerDay;
		if (monthRemaining < monthDuration) {
			nextMonth = monthDuration - monthRemaining;
			break;
		}
		monthRemaining -= monthDuration;
	}

	// Calculate morning (hour 0) and night (hoursPerDay/2)
	const nextMorning = millisecondsPerDay - (elapsed % millisecondsPerDay);
	const nightHour = (CALENDAR.hoursPerDay / 2) * millisecondsPerHour;
	const dayElapsed = elapsed % millisecondsPerDay;
	// Night fires at hoursPerDay/2 and hoursPerDay (which is hour 0 of next day)
	// So it fires every hoursPerDay/2 hours
	const timeSinceLastNight = dayElapsed % nightHour;
	const nextNight = nightHour - timeSinceLastNight;

	// Set up intervals with initial delay using setSafeTimeout, then recurring with setRelativeInterval
	// Clear previous timeouts
	minuteTimeouts.forEach((id) => clearTimeout(id));
	minuteTimeouts = [];
	setSafeTimeout(
		() => {
			calendarEvents.emit("minute");
			minuteInterval = setRelativeInterval(() => {
				calendarEvents.emit("minute");
			}, millisecondsPerMinute);
		},
		nextMinute,
		minuteTimeouts
	);

	hourTimeouts.forEach((id) => clearTimeout(id));
	hourTimeouts = [];
	setSafeTimeout(
		() => {
			calendarEvents.emit("hour");
			hourInterval = setRelativeInterval(() => {
				calendarEvents.emit("hour");
			}, millisecondsPerHour);
		},
		nextHour,
		hourTimeouts
	);

	dayTimeouts.forEach((id) => clearTimeout(id));
	dayTimeouts = [];
	setSafeTimeout(
		() => {
			calendarEvents.emit("day");
			dayInterval = setRelativeInterval(() => {
				calendarEvents.emit("day");
			}, millisecondsPerDay);
		},
		nextDay,
		dayTimeouts
	);

	weekTimeouts.forEach((id) => clearTimeout(id));
	weekTimeouts = [];
	setSafeTimeout(
		() => {
			calendarEvents.emit("week");
			weekInterval = setRelativeInterval(() => {
				calendarEvents.emit("week");
			}, millisecondsPerWeek);
		},
		nextWeek,
		weekTimeouts
	);

	// Month interval - needs to be recreated each time due to variable month lengths
	monthTimeouts.forEach((id) => clearTimeout(id));
	monthTimeouts = [];
	const setupMonthInterval = () => {
		if (!CALENDAR || !DERIVED) return;
		const elapsed = getElapsedTime();
		const yearElapsed = elapsed % millisecondsPerYear;
		let monthRemaining = yearElapsed;
		let nextMonth = 0;
		for (let i = 0; i < CALENDAR.months.length; i++) {
			const monthDays = CALENDAR.months[i].days;
			const monthDuration = monthDays * millisecondsPerDay;
			if (monthRemaining < monthDuration) {
				nextMonth = monthDuration - monthRemaining;
				break;
			}
			monthRemaining -= monthDuration;
		}
		if (monthInterval !== undefined) {
			clearCustomInterval(monthInterval);
		}
		// Clear previous month timeouts
		monthTimeouts.forEach((id) => clearTimeout(id));
		monthTimeouts = [];
		setSafeTimeout(
			() => {
				calendarEvents.emit("month");
				setupMonthInterval(); // Recreate for next month
			},
			nextMonth,
			monthTimeouts
		);
	};
	setupMonthInterval();

	yearTimeouts.forEach((id) => clearTimeout(id));
	yearTimeouts = [];
	setSafeTimeout(
		() => {
			calendarEvents.emit("year");
			yearInterval = setRelativeInterval(() => {
				calendarEvents.emit("year");
			}, millisecondsPerYear);
		},
		nextYear,
		yearTimeouts
	);

	// Morning event (hour 0)
	morningTimeouts.forEach((id) => clearTimeout(id));
	morningTimeouts = [];
	setSafeTimeout(
		() => {
			calendarEvents.emit("morning");
			morningInterval = setRelativeInterval(() => {
				calendarEvents.emit("morning");
			}, millisecondsPerDay);
		},
		nextMorning,
		morningTimeouts
	);

	// Night event (hoursPerDay/2) - fires every hoursPerDay/2 hours
	// This means it fires at hoursPerDay/2 and hoursPerDay (hour 0 of next day)
	nightTimeouts.forEach((id) => clearTimeout(id));
	nightTimeouts = [];
	setSafeTimeout(
		() => {
			calendarEvents.emit("night");
			nightInterval = setRelativeInterval(() => {
				calendarEvents.emit("night");
			}, nightHour);
		},
		nextNight,
		nightTimeouts
	);
}

/**
 * Clear all calendar event intervals and timeouts.
 */
export function clearCalendarEvents(): void {
	// Clear intervals
	if (minuteInterval !== undefined) {
		clearCustomInterval(minuteInterval);
		minuteInterval = undefined;
	}
	if (hourInterval !== undefined) {
		clearCustomInterval(hourInterval);
		hourInterval = undefined;
	}
	if (dayInterval !== undefined) {
		clearCustomInterval(dayInterval);
		dayInterval = undefined;
	}
	if (weekInterval !== undefined) {
		clearCustomInterval(weekInterval);
		weekInterval = undefined;
	}
	if (monthInterval !== undefined) {
		clearCustomInterval(monthInterval);
		monthInterval = undefined;
	}
	if (yearInterval !== undefined) {
		clearCustomInterval(yearInterval);
		yearInterval = undefined;
	}
	if (morningInterval !== undefined) {
		clearCustomInterval(morningInterval);
		morningInterval = undefined;
	}
	if (nightInterval !== undefined) {
		clearCustomInterval(nightInterval);
		nightInterval = undefined;
	}

	// Clear all timeouts (including chained ones)
	minuteTimeouts.forEach((id) => clearTimeout(id));
	minuteTimeouts = [];
	hourTimeouts.forEach((id) => clearTimeout(id));
	hourTimeouts = [];
	dayTimeouts.forEach((id) => clearTimeout(id));
	dayTimeouts = [];
	weekTimeouts.forEach((id) => clearTimeout(id));
	weekTimeouts = [];
	monthTimeouts.forEach((id) => clearTimeout(id));
	monthTimeouts = [];
	yearTimeouts.forEach((id) => clearTimeout(id));
	yearTimeouts = [];
	morningTimeouts.forEach((id) => clearTimeout(id));
	morningTimeouts = [];
	nightTimeouts.forEach((id) => clearTimeout(id));
	nightTimeouts = [];
}
