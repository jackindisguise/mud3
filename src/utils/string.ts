/**
 * String manipulation utilities for combining and formatting text boxes.
 */

import { string } from "mud-ext";
import { COLOR_ESCAPE } from "../core/color.js";

export function combineHorizontalBoxes(options: {
	sizer: string.Sizer;
	boxes: string[][];
}): string[] {
	const sizer = options.sizer;
	const boxes = options.boxes;
	const lines: string[] = [];
	const width: number[] = []; // width of each box (assuming first line is as long as the others)
	let height = 0;
	for (let i = 0; i < boxes.length; i++) {
		width[i] = sizer.size(boxes[i][0]);
		if (boxes[i].length > height) height = boxes[i].length;
	}
	for (let i = 0; i < height; i++) {
		const row = [];
		for (let j = 0; j < boxes.length; j++) {
			const line = boxes[j][i];
			if (line) row.push(line);
			else row.push(" ".repeat(width[j]));
		}
		if (row.length > 0) lines.push(row.join(""));
		else break;
	}
	return lines;
}

/**
 * Capitalizes the first letter of a string while preserving color codes.
 *
 * This function finds the first actual character (not a color code) and capitalizes it,
 * leaving all color codes intact. Useful for starting sentences with display names that
 * may contain color codes.
 *
 * @param text - The text to capitalize (may contain color codes)
 * @returns The text with the first letter capitalized, color codes preserved
 *
 * @example
 * ```typescript
 * capitalizeFirst("a sword") // "A sword"
 * capitalizeFirst("{Ra red sword{x") // "{RA red sword{x"
 * capitalizeFirst("{{not a code}") // "{{not a code}" (literal { preserved)
 * capitalizeFirst("") // ""
 * ```
 */
export function capitalizeFirst(text: string): string {
	if (!text) return text;

	const escapedEscape = COLOR_ESCAPE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	let i = 0;
	while (i < text.length) {
		if (text[i] === COLOR_ESCAPE) {
			// Check for escaped {{ (literal {)
			if (i + 1 < text.length && text[i + 1] === COLOR_ESCAPE) {
				i += 2; // Skip {{ and continue
				continue;
			}
			// Skip color code {letter
			i += 2; // Skip { and the letter
			continue;
		}

		// Found first actual character
		return text.slice(0, i) + text[i].toUpperCase() + text.slice(i + 1);
	}

	// String only contains color codes, return as-is
	return text;
}
