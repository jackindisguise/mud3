/**
 * Currency utility functions.
 *
 * Helper functions for creating and managing currency items.
 *
 * @module utils/currency
 */

import { Currency } from "../core/dungeon.js";

/**
 * Creates a Currency item with appropriate display strings based on the amount.
 * The display strings vary based on the amount to provide descriptive text.
 *
 * @param amount - The amount of gold to create
 * @param options - Optional configuration
 * @param options.includeRoomDescription - Whether to include roomDescription (default: false)
 * @returns A new Currency item with appropriate display strings
 *
 * @example
 * ```typescript
 * // For giving (no roomDescription)
 * const currency = createGold(10);
 *
 * // For dropping (with roomDescription)
 * const currency = createGold(10, { includeRoomDescription: true });
 * ```
 */
export function createGold(
	amount: number,
	options?: {
		includeRoomDescription?: boolean;
	}
): Currency {
	const currencyName = "gold";
	let keywords: string = currencyName;
	let display: string;
	let roomDescription: string | undefined;

	if (amount === 1) {
		display = `a single ${currencyName} coin`;
		if (options?.includeRoomDescription) {
			roomDescription = `A single ${currencyName} coin is here.`;
		}
	} else if (amount < 10) {
		display = `a few ${currencyName} coins`;
		if (options?.includeRoomDescription) {
			roomDescription = `A few ${currencyName} coins are here.`;
		}
	} else if (amount <= 100) {
		keywords += " pile";
		display = `a pile of ${currencyName} coins`;
		if (options?.includeRoomDescription) {
			roomDescription = `A pile of ${currencyName} coins are here.`;
		}
	} else {
		keywords += " huge pile";
		display = `a huge pile of ${currencyName} coins`;
		if (options?.includeRoomDescription) {
			roomDescription = `A huge pile of ${currencyName} coins are here.`;
		}
	}

	const currencyOptions: {
		value: number;
		keywords: string;
		display: string;
		roomDescription?: string;
	} = {
		value: amount,
		keywords: keywords,
		display: display,
	};

	if (roomDescription) {
		currencyOptions.roomDescription = roomDescription;
	}

	return new Currency(currencyOptions);
}
