/**
 * Calendar command for displaying the current date and time.
 *
 * Shows the current calendar date, day of week, and time according to the game's calendar system.
 *
 * @example
 * ```
 * calendar
 * ```
 *
 * **Patterns:**
 * - `calendar~` - Display current date and time
 * @module commands/calendar
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR } from "../core/color.js";
import {
	getCalendar,
	getCurrentTime,
	getCurrentDay,
	getDayOfWeek,
	getCurrentMonth,
	getCurrentYear,
	getCurrentHour,
	getCurrentMinute,
	getCurrentSecond,
	toOrdinal,
} from "../registry/calendar.js";

export default {
	pattern: "calendar~",
	execute(context: CommandContext): void {
		const { actor } = context;

		const calendar = getCalendar();
		if (!calendar) {
			actor.sendMessage(
				"The calendar system is not available.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const time = getCurrentTime();
		if (!time) {
			actor.sendMessage(
				"Unable to retrieve current time.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Get day and month names
		const dayName = calendar.days[time.dayOfWeek]?.name ?? "Unknown";
		const monthName = calendar.months[time.month]?.name ?? "Unknown";

		// Format time with leading zeros
		const hourStr = time.hour.toString().padStart(2, "0");
		const minuteStr = time.minute.toString().padStart(2, "0");
		const secondStr = time.second.toString().padStart(2, "0");

		// Build the calendar display
		const lines: string[] = [];
		lines.push("");
		lines.push(color(`Calendar: ${calendar.name}`, COLOR.CYAN));
		lines.push("");
		lines.push(`${color("Day of Week: ", COLOR.YELLOW)}${dayName}`);
		lines.push(`${color("Month: ", COLOR.YELLOW)}${monthName}`);
		lines.push(`${color("Day of Month: ", COLOR.YELLOW)}${time.day}`);
		lines.push(
			`${color("Date: ", COLOR.YELLOW)}${dayName}, ${monthName} ${toOrdinal(
				time.day
			)}, Year ${time.year + 1}`
		);
		lines.push(
			`${color("Time: ", COLOR.YELLOW)}${hourStr}:${minuteStr}:${secondStr}`
		);
		lines.push("");

		actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
