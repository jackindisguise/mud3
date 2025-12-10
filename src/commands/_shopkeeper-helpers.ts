/**
 * @module commands/shopkeeper-helpers
 */

import { Mob, Room, ShopkeeperInventory } from "../core/dungeon.js";
import { BEHAVIOR } from "../core/dungeon.js";

/**
 * Find the first shopkeeper in a room.
 *
 * @param room - The room to search
 * @returns The first shopkeeper mob found, or undefined if none exists
 */
export function findShopkeeperInRoom(room: Room | undefined): Mob | undefined {
	if (!room) {
		return undefined;
	}

	for (const obj of room.contents) {
		if (obj instanceof Mob && obj.hasBehavior(BEHAVIOR.SHOPKEEPER)) {
			return obj;
		}
	}

	return undefined;
}

/**
 * Get the shopkeeper inventory from a mob.
 * Returns undefined if the mob is not a shopkeeper or has no inventory.
 *
 * @param mob - The mob to check
 * @returns The shopkeeper inventory, or undefined
 */
export function getShopkeeperInventoryFromMob(
	mob: Mob | undefined
): ShopkeeperInventory | undefined {
	if (!mob) {
		return undefined;
	}
	return mob.getShopkeeperInventory();
}
