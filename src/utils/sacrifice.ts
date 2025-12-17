/**
 * Utility functions for sacrificing items and containers.
 *
 * These functions centralize the logic for sacrificing items, calculating gold rewards,
 * and destroying items/containers. Used by the sacrifice command and autosacrifice functionality.
 *
 * @module utils/sacrifice
 */

import { MESSAGE_GROUP } from "../core/character.js";
import { Item, Currency, Mob, Room, DungeonObject } from "../core/dungeon.js";
import { act } from "./act.js";
import { color, COLOR } from "../core/color.js";
import { capitalizeFirst } from "./string.js";

/**
 * Sacrifices a single item, destroying it and giving the actor 25% of its value as gold.
 *
 * @param item - The item to sacrifice
 * @param actor - The mob sacrificing the item
 * @param room - The room the actor is in
 * @param options - Optional configuration
 * @param options.messagePrefix - Prefix to add to messages (e.g., "automatically "). Default: ""
 * @returns true if the item was successfully sacrificed, false otherwise
 */
export function sacrificeItem(
	item: Item | undefined,
	actor: Mob,
	room: Room | undefined,
	options?: { messagePrefix?: string }
): boolean {
	const messagePrefix = options?.messagePrefix || "";

	// Check if actor is in a room
	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return false;
	}

	// Check if item is specified
	if (!item) {
		actor.sendMessage(
			"You don't see that here.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Ensure it's actually an Item (not a Prop or other DungeonObject)
	if (!(item instanceof Item)) {
		const displayName = (item as any)?.display || "that";
		actor.sendMessage(
			`You cannot sacrifice ${displayName}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if item is actually in the room
	if (item.location !== room) {
		actor.sendMessage(
			`${capitalizeFirst(item.display)} is not here.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Cannot sacrifice Currency items
	if (item instanceof Currency) {
		actor.sendMessage(
			"You cannot sacrifice currency.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Calculate total value (including container contents if it's a container)
	let totalValue = item.value;

	// If this is a container, add the value of all items inside
	if (item.isContainer && item.contents.length > 0) {
		const itemsInContainer = item.contents.filter(
			(obj) => obj instanceof Item
		) as Item[];
		totalValue += itemsInContainer.reduce((acc, item) => acc + item.value, 0);
	}

	// Calculate gold reward (25% of total value)
	const goldReward = Math.floor(totalValue * 0.25);

	// Save display name before destroying
	const itemDisplay = item.display;

	// Destroy the item
	item.destroy();

	// Give gold to actor
	if (goldReward > 0) {
		actor.value += goldReward;
		act(
			{
				user: `You ${messagePrefix}sacrifice ${itemDisplay} and gain ${color(
					String(goldReward),
					COLOR.YELLOW
				)} gold.`,
				room: `{User} ${messagePrefix}sacrifices ${itemDisplay}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
	} else {
		act(
			{
				user: `You ${messagePrefix}sacrifice ${itemDisplay}.`,
				room: `{User} ${messagePrefix}sacrifices ${itemDisplay}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
	}

	return true;
}

/**
 * Sacrifices a container (and all its contents), destroying it and giving the actor 25% of the total value as gold.
 *
 * The total value includes the value of all items inside the container, including currency items.
 *
 * @param container - The container to sacrifice (must be an Item with contents)
 * @param actor - The mob sacrificing the container
 * @param room - The room the actor is in
 * @param options - Optional configuration
 * @param options.messagePrefix - Prefix to add to messages (e.g., "automatically "). Default: ""
 * @returns true if the container was successfully sacrificed, false otherwise
 */
export function sacrificeContainer(
	container: DungeonObject,
	actor: Mob,
	room: Room | undefined,
	options?: { messagePrefix?: string }
): boolean {
	const messagePrefix = options?.messagePrefix || "";

	if (!container) {
		actor.sendMessage(
			"You don't see that here.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return false;
	}

	// Check if container is actually in the room
	if (container.location !== room) {
		actor.sendMessage(
			`${capitalizeFirst(container.display)} is not here.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Ensure it's actually an Item (not a Prop or other DungeonObject)
	if (!(container instanceof Item)) {
		const displayName = (container as any)?.display || "that";
		actor.sendMessage(
			`You cannot sacrifice ${displayName}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Calculate total value of all items in the container (including currency)
	let totalValue = 0;
	const itemsInContainer = container.contents.filter(
		(obj) => obj instanceof Item
	) as Item[];
	for (const item of itemsInContainer) {
		totalValue += item.value;
	}

	// Calculate gold reward (25% of total value)
	const goldReward = Math.floor(totalValue * 0.25);

	// Save display name before destroying
	const containerDisplay = container.display;

	// Destroy the container (which destroys all its contents)
	container.destroy();

	// Give gold to actor
	if (goldReward > 0) {
		actor.value = (actor.value || 0) + goldReward;
		act(
			{
				user: `You ${messagePrefix}sacrifice ${containerDisplay} and gain ${color(
					String(goldReward),
					COLOR.YELLOW
				)} gold.`,
				room: `{User} ${messagePrefix}sacrifices ${containerDisplay}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
	} else {
		act(
			{
				user: `You ${messagePrefix}sacrifice ${containerDisplay}.`,
				room: `{User} ${messagePrefix}sacrifices ${containerDisplay}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
	}

	return true;
}
