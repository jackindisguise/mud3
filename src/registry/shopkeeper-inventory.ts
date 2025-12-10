/**
 * @module registry/shopkeeper-inventory
 */

import type { ShopkeeperInventory } from "../core/dungeon.js";
import { getDungeonById } from "./dungeon.js";

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
