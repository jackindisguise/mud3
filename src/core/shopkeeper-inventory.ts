/**
 * @module core/shopkeeper-inventory
 */

import type {
	DungeonObject,
	RestockRule,
	ShopkeeperInventory,
} from "./dungeon.js";

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
