/**
 * Time formatting utilities for displaying durations and timestamps.
 *
 * @module time
 */

/**
 * Formats a duration in milliseconds as a human-readable string.
 * Best for longer durations (days, hours, minutes) without seconds.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2 days", "3 hours", "45 minutes")
 *
 * @example
 * ```typescript
 * formatDuration(86400000); // "1 day"
 * formatDuration(7200000);  // "2 hours"
 * formatDuration(90000);     // "1 minute"
 * ```
 */
export function formatDuration(ms: number): string {
	const days = Math.floor(ms / (24 * 60 * 60 * 1000));
	const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

	if (days > 0) {
		return `${days} day${days !== 1 ? "s" : ""}`;
	} else if (hours > 0) {
		return `${hours} hour${hours !== 1 ? "s" : ""}`;
	} else {
		const minutes = Math.floor(ms / (60 * 1000));
		return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
	}
}

/**
 * Formats playtime in milliseconds as a human-readable string with hours, minutes, and seconds.
 * Best for displaying player playtime with full precision.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted playtime string (e.g., "2 hours, 34 minutes, 5 seconds")
 *
 * @example
 * ```typescript
 * formatPlaytime(9245000); // "2 hours, 34 minutes, 5 seconds"
 * formatPlaytime(125000);  // "2 minutes, 5 seconds"
 * formatPlaytime(5000);    // "5 seconds"
 * ```
 */
export function formatPlaytime(ms: number): string {
	const hours = Math.floor(ms / (1000 * 60 * 60));
	const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
	const seconds = Math.floor((ms % (1000 * 60)) / 1000);

	if (hours > 0) {
		return `${hours} hours, ${minutes} minutes, ${seconds} seconds`;
	} else if (minutes > 0) {
		return `${minutes} minutes, ${seconds} seconds`;
	} else {
		return `${seconds} seconds`;
	}
}
