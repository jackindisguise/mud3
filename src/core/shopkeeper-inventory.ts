/**
 * @module core/shopkeeper-inventory
 */

import type {
	DungeonObject,
	ItemTemplate,
	RestockRule,
	ShopkeeperInventory,
} from "./dungeon.js";
import { createFromTemplateWithOid } from "../package/dungeon.js";
import { resolveTemplateById } from "../registry/dungeon.js";

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

/**
 * Cycle/restock a shopkeeper inventory based on its restock rules.
 * This processes each rule and restocks items according to minimum/maximum values.
 * Infinite stock items are skipped.
 *
 * @param inventory - The shopkeeper inventory to cycle
 */
export function cycleInventory(inventory: ShopkeeperInventory): void {
	for (const rule of inventory.rules) {
		// Get template ID from the rule's template
		const templateId = rule.template.id;
		if (!templateId) {
			continue;
		}

		// Handle infinite stock items: ensure at least one item exists
		if (isInfiniteStock(rule)) {
			const currentCount = countStockByTemplate(inventory, templateId);
			if (currentCount === 0) {
				// Create one item for infinite stock if none exists
				const template = resolveTemplateById(templateId);
				if (
					template &&
					(template.type === "Item" ||
						template.type === "Equipment" ||
						template.type === "Armor" ||
						template.type === "Weapon")
				) {
					const item = createFromTemplateWithOid(template);
					addStock(inventory, item);
				}
			}
			continue;
		}

		// Skip if cycleDelay is active
		if (
			rule.cycleDelayRemaining !== undefined &&
			rule.cycleDelayRemaining > 0
		) {
			rule.cycleDelayRemaining--;
			continue;
		}

		// Count current stock for this template
		const currentCount = countStockByTemplate(inventory, templateId);

		// Determine how many to restock
		let toRestock = 0;
		if (rule.minimum !== undefined && currentCount < rule.minimum) {
			// Fill to minimum
			toRestock = rule.minimum - currentCount;
		} else if (
			rule.maximum !== undefined &&
			currentCount < rule.maximum &&
			currentCount >= (rule.minimum ?? 0)
		) {
			// Add 1 if between minimum and maximum
			toRestock = 1;
		}

		// Restock items
		if (toRestock > 0) {
			const template = resolveTemplateById(templateId);
			if (!template || template.type !== "Item") {
				continue;
			}

			for (let i = 0; i < toRestock; i++) {
				const item = createFromTemplateWithOid(template);
				addStock(inventory, item);
			}

			// Activate cycleDelay if we restocked and delay is set
			if (rule.cycleDelay !== undefined && rule.cycleDelay > 0) {
				rule.cycleDelayRemaining = rule.cycleDelay;
			}
		}
	}
}

/**
 * Cycle all shopkeeper inventories in the registry.
 * This is called periodically (e.g., on game ticks) to restock all shopkeepers.
 */
export function cycleShopkeeperInventories(): void {
	// Use dynamic import to avoid circular dependency
	import("../registry/shopkeeper-inventory.js").then((module) => {
		const inventories = module.getAllShopkeeperInventories();
		for (const inventory of inventories) {
			cycleInventory(inventory);
		}
	});
}
