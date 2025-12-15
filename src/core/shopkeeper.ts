/**
 * @module core/shopkeeper-inventory
 */

import type { ItemTemplate, DungeonObject } from "./dungeon.js";

/**
 * Restock rule for shopkeeper inventory.
 * Defines what items a shopkeeper should stock and how they should be restocked.
 *
 * @property template - The item template to restock
 * @property minimum - Minimum number of items to maintain (undefined = infinite stock)
 * @property maximum - Maximum number of items to stock (undefined = infinite stock)
 * @property cycleDelay - Number of cycles between restocks for rare items (undefined = infinite stock)
 * @property cycleDelayRemaining - Runtime-only: cycles remaining before next restock
 */
export interface RestockRule {
	template: ItemTemplate;
	minimum?: number;
	maximum?: number;
	cycleDelay?: number;
	cycleDelayRemaining?: number; // Runtime only, not serialized
}

/**
 * Shopkeeper inventory configuration and runtime state.
 * Manages what a shopkeeper is selling and the items currently in stock.
 *
 * @property id - Unique identifier for this inventory (local or globalized)
 * @property buyPriceMultiplier - Multiplier for item value when buying (default 1.25)
 * @property sellPriceMultiplier - Multiplier for item value when selling (default 0.75)
 * @property stock - Runtime array of items currently in stock (not serialized)
 * @property rules - Restock rules defining what should be stocked
 */
export interface ShopkeeperInventory {
	id: string;
	buyPriceMultiplier: number;
	sellPriceMultiplier: number;
	stock: DungeonObject[]; // Runtime only, not serialized
	rules: RestockRule[];
}

/**
 * Serialized form of a restock rule.
 * Excludes runtime-only fields like cycleDelayRemaining.
 */
export interface SerializedRestockRule {
	templateId: string; // Template ID instead of template object
	minimum?: number;
	maximum?: number;
	cycleDelay?: number;
}

/**
 * Serialized form of a shopkeeper inventory.
 * Excludes runtime-only fields like stock.
 */
export interface SerializedShopkeeperInventory {
	id: string;
	buyPriceMultiplier?: number; // Optional, defaults to 1.25
	sellPriceMultiplier?: number; // Optional, defaults to 0.75
	rules: SerializedRestockRule[];
}

/**
 * Check if a restock rule represents infinite stock.
 * Infinite stock means minimum, maximum, and cycleDelay are all undefined.
 *
 * @param rule - The restock rule to check
 * @returns true if the rule represents infinite stock
 */
export function isInfiniteStock(rule: RestockRule): boolean {
	return (
		rule.minimum === undefined &&
		rule.maximum === undefined &&
		rule.cycleDelay === undefined
	);
}

/**
 * Add items to shopkeeper inventory stock.
 *
 * @param inventory - The shopkeeper inventory
 * @param items - Items to add to stock
 */
export function addStock(
	inventory: ShopkeeperInventory,
	...items: DungeonObject[]
): void {
	inventory.stock.push(...items);
}

/**
 * Remove an item from shopkeeper inventory stock.
 *
 * @param inventory - The shopkeeper inventory
 * @param item - The item to remove
 * @returns true if the item was removed, false if it wasn't found
 */
export function removeStock(
	inventory: ShopkeeperInventory,
	item: DungeonObject
): boolean {
	const index = inventory.stock.indexOf(item);
	if (index === -1) {
		return false;
	}
	inventory.stock.splice(index, 1);
	return true;
}

/**
 * Get the sell price for an item (what the shopkeeper will pay).
 *
 * @param inventory - The shopkeeper inventory
 * @param item - The item to price
 * @returns The sell price (item value * sellPriceMultiplier)
 */
export function getSellPrice(
	inventory: ShopkeeperInventory,
	item: DungeonObject
): number {
	const baseValue = item.value ?? 0;
	return Math.floor(baseValue * inventory.sellPriceMultiplier);
}

/**
 * Get the buy price for an item (what the player will pay).
 *
 * @param inventory - The shopkeeper inventory
 * @param item - The item to price
 * @returns The buy price (item value * buyPriceMultiplier)
 */
export function getBuyPrice(
	inventory: ShopkeeperInventory,
	item: DungeonObject
): number {
	const baseValue = item.value ?? 0;
	return Math.floor(baseValue * inventory.buyPriceMultiplier);
}

/**
 * Count items in stock that match a given template.
 *
 * @param inventory - The shopkeeper inventory
 * @param templateId - The template ID to count
 * @returns Number of items matching the template
 */
export function countStockByTemplate(
	inventory: ShopkeeperInventory,
	templateId: string
): number {
	return inventory.stock.filter((item) => item.templateId === templateId)
		.length;
}
