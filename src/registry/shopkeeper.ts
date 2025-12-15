/**
 * @module registry/shopkeeper-inventory
 */

import { ShopkeeperInventory } from "../core/shopkeeper.js";
import {
	addStock,
	countStockByTemplate,
	isInfiniteStock,
} from "../core/shopkeeper.js";
import { resolveTemplateById } from "./dungeon.js";
import { createFromTemplateWithOid } from "../package/dungeon.js";
import logger from "../utils/logger.js";

/**
 * Internal cache of shopkeeper inventories by their globalized IDs.
 * All inventories are stored with globalized IDs in the format @dungeon-id<inventory-id>.
 */
const SHOPKEEPER_INVENTORY_CACHE: Map<string, ShopkeeperInventory> = new Map();

/**
 * Read-only view of the shopkeeper inventory cache.
 * Use this to access inventories without being able to modify the cache directly.
 */
export const SAFE_SHOPKEEPER_INVENTORY_CACHE: ReadonlyMap<
	string,
	ShopkeeperInventory
> = SHOPKEEPER_INVENTORY_CACHE;

/**
 * Globalize a shopkeeper inventory ID by prefixing it with the dungeon ID.
 * If the ID is already globalized, returns it as-is.
 *
 * @param globalOrLocalId - Local ID or already-globalized ID
 * @param dungeonId - The dungeon ID to prefix with
 * @returns Globalized ID in format @dungeon-id<inventory-id>
 *
 * @example
 * ```typescript
 * globalizeShopkeeperInventoryId("general-store", "midgar");
 * // Returns: "@midgar<general-store>"
 *
 * globalizeShopkeeperInventoryId("@midgar<general-store>", "midgar");
 * // Returns: "@midgar<general-store>" (already globalized)
 * ```
 */
export function globalizeShopkeeperInventoryId(
	globalOrLocalId: string,
	dungeonId: string
): string {
	// Check if already globalized (contains @ and <)
	if (globalOrLocalId.includes("@") && globalOrLocalId.includes("<")) {
		return globalOrLocalId;
	}
	return `@${dungeonId}<${globalOrLocalId}>`;
}

/**
 * Localize a shopkeeper inventory ID by removing the dungeon prefix if it matches.
 * If the ID doesn't match the dungeon, returns it as-is (for cross-dungeon references).
 *
 * @param globalOrLocalId - Globalized or local ID
 * @param dungeonId - The dungeon ID to check against
 * @returns Local ID if it matches the dungeon, otherwise the original ID
 *
 * @example
 * ```typescript
 * localizeShopkeeperInventoryId("@midgar<general-store>", "midgar");
 * // Returns: "general-store"
 *
 * localizeShopkeeperInventoryId("@midgar<general-store>", "neo-tokyo");
 * // Returns: "@midgar<general-store>" (cross-dungeon reference)
 * ```
 */
export function localizeShopkeeperInventoryId(
	globalOrLocalId: string,
	dungeonId: string
): string {
	// Match pattern: @dungeon-id<inventory-id>
	const match = globalOrLocalId.match(/^@([^<]+)<(.+)>$/);
	if (match) {
		const [, did, local] = match;
		return did === dungeonId ? local : globalOrLocalId;
	}
	return globalOrLocalId;
}

/**
 * Get a shopkeeper inventory by ID, supporting both local and globalized IDs.
 * If a local ID is provided, searches all dungeons for a matching inventory.
 *
 * @param id - Local ID or globalized ID (@dungeon-id<inventory-id>)
 * @returns The shopkeeper inventory if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // Using globalized ID
 * const inv = getShopkeeperInventoryById("@midgar<general-store>");
 *
 * // Using local ID (searches all dungeons)
 * const inv2 = getShopkeeperInventoryById("general-store");
 * ```
 */
export function getShopkeeperInventoryById(
	id: string
): ShopkeeperInventory | undefined {
	// Check if it's a globalized ID
	const match = id.match(/^@([^<]+)<(.+)>$/);
	if (match) {
		// Direct lookup with globalized ID
		return SHOPKEEPER_INVENTORY_CACHE.get(id);
	}

	// Local ID - search all dungeons
	// First try to find the current dungeon context (if any)
	// For now, search all registered inventories
	for (const [globalId, inventory] of SHOPKEEPER_INVENTORY_CACHE.entries()) {
		const match = globalId.match(/^@([^<]+)<(.+)>$/);
		if (match && match[2] === id) {
			return inventory;
		}
	}

	return undefined;
}

/**
 * Register a shopkeeper inventory in the cache.
 * The inventory ID should already be globalized before calling this.
 *
 * @param inventory - The shopkeeper inventory to register
 * @throws Error if an inventory with the same ID is already registered
 *
 * @example
 * ```typescript
 * const inventory: ShopkeeperInventory = {
 *   id: "@midgar<general-store>",
 *   buyPriceMultiplier: 1.25,
 *   sellPriceMultiplier: 0.75,
 *   stock: [],
 *   rules: []
 * };
 * registerShopkeeperInventory(inventory);
 * ```
 */
export function registerShopkeeperInventory(
	inventory: ShopkeeperInventory
): void {
	if (SHOPKEEPER_INVENTORY_CACHE.has(inventory.id)) {
		throw new Error(
			`Shopkeeper inventory with ID "${inventory.id}" is already registered`
		);
	}
	SHOPKEEPER_INVENTORY_CACHE.set(inventory.id, inventory);
}

/**
 * Unregister a shopkeeper inventory from the cache.
 *
 * @param id - The globalized inventory ID to unregister
 * @returns true if the inventory was removed, false if it wasn't found
 */
export function unregisterShopkeeperInventory(id: string): boolean {
	return SHOPKEEPER_INVENTORY_CACHE.delete(id);
}

/**
 * Get all registered shopkeeper inventory IDs.
 *
 * @returns Array of all globalized inventory IDs
 */
export function getAllShopkeeperInventoryIds(): string[] {
	return Array.from(SHOPKEEPER_INVENTORY_CACHE.keys());
}

/**
 * Get all registered shopkeeper inventories.
 *
 * @returns Array of all shopkeeper inventories
 */
export function getAllShopkeeperInventories(): ShopkeeperInventory[] {
	return Array.from(SHOPKEEPER_INVENTORY_CACHE.values());
}

/**
 * Cycle/restock a shopkeeper inventory based on its restock rules.
 * This processes each rule and restocks items according to minimum/maximum values.
 * Infinite stock items are skipped.
 *
 * @param inventory - The shopkeeper inventory to cycle
 */
export async function cycleInventory(inventory: ShopkeeperInventory) {
	await logger.block(`${inventory.id}`, async () => {
		logger.debug(`Starting cycle for inventory: ${inventory.id}`);

		for (const rule of inventory.rules) {
			// Get template ID from the rule's template
			const templateId = rule.template.id;
			if (!templateId) {
				logger.debug(
					`Skipping rule with no template ID for inventory: ${inventory.id}`
				);
				continue;
			}

			// Handle infinite stock items: ensure at least one item exists
			if (isInfiniteStock(rule)) {
				const currentCount = countStockByTemplate(inventory, templateId);
				logger.debug(
					`Infinite stock rule for ${templateId} in ${inventory.id}: current count = ${currentCount}`
				);
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
						logger.debug(
							`Created infinite stock item ${templateId} for inventory: ${inventory.id}`
						);
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
				logger.debug(
					`Cycle delay active for ${templateId} in ${inventory.id}: ${rule.cycleDelayRemaining} cycles remaining`
				);
				continue;
			}

			// Count current stock for this template
			const currentCount = countStockByTemplate(inventory, templateId);

			// Determine how many to restock
			let toRestock = 0;
			if (rule.minimum !== undefined && currentCount < rule.minimum) {
				// Fill to minimum
				toRestock = rule.minimum - currentCount;
				logger.debug(
					`${templateId} in ${inventory.id}: below minimum (${currentCount} < ${rule.minimum}), restocking ${toRestock}`
				);
			} else if (
				rule.maximum !== undefined &&
				currentCount < rule.maximum &&
				currentCount >= (rule.minimum ?? 0)
			) {
				// Add 1 if between minimum and maximum
				toRestock = 1;
				logger.debug(
					`${templateId} in ${inventory.id}: between min/max (${currentCount}), restocking 1`
				);
			} else {
				logger.debug(
					`${templateId} in ${
						inventory.id
					}: no restock needed (count: ${currentCount}, min: ${
						rule.minimum ?? "none"
					}, max: ${rule.maximum ?? "none"})`
				);
			}

			// Restock items
			if (toRestock > 0) {
				const template = resolveTemplateById(templateId);
				if (
					!template ||
					(template.type !== "Item" &&
						template.type !== "Equipment" &&
						template.type !== "Armor" &&
						template.type !== "Weapon")
				) {
					logger.debug(
						`Skipping ${templateId} in ${inventory.id}: template not found or not an Item`
					);
					continue;
				}

				for (let i = 0; i < toRestock; i++) {
					const item = createFromTemplateWithOid(template);
					addStock(inventory, item);
				}

				logger.debug(
					`Restocked ${toRestock} ${templateId} in ${
						inventory.id
					} (new count: ${countStockByTemplate(inventory, templateId)})`
				);

				// Activate cycleDelay if we restocked and delay is set
				if (rule.cycleDelay !== undefined && rule.cycleDelay > 0) {
					rule.cycleDelayRemaining = rule.cycleDelay;
					logger.debug(
						`Activated cycle delay for ${templateId} in ${inventory.id}: ${rule.cycleDelay} cycles`
					);
				}
			}
		}

		logger.debug(`Completed cycle for inventory: ${inventory.id}`);
	});
}

/**
 * Cycle all shopkeeper inventories in the registry.
 * This is called periodically (e.g., on game ticks) to restock all shopkeepers.
 */
export async function cycleShopkeeperInventories() {
	await logger.block("shopkeepers", async () => {
		logger.debug("Starting cycle for all shopkeeper inventories");
		const inventories = getAllShopkeeperInventories();
		logger.debug(`Found ${inventories.length} inventories`);
		for (const inventory of inventories) {
			await cycleInventory(inventory);
		}
		logger.debug("Completed cycle for all shopkeeper inventories");
	});
}
