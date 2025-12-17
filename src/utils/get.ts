/**
 * Utility functions for getting items from rooms and containers.
 *
 * These functions centralize the logic for picking up items, handling currency conversion,
 * and moving items to actor inventories. Used by the get command and autoloot functionality.
 *
 * @module utils/get
 */

import { MESSAGE_GROUP } from "../core/character.js";
import { Item, DungeonObject, Currency, Mob, Room } from "../core/dungeon.js";
import { act } from "./act.js";
import { formatNumber } from "./number.js";
import { capitalizeFirst } from "./string.js";

/**
 * Gets a single item from a room and adds it to the actor's inventory.
 *
 * @param item - The item to get (undefined if not found)
 * @param actor - The mob getting the item
 * @param room - The room the actor is in
 * @returns true if the item was successfully retrieved, false otherwise
 */
export function getItemFromRoom(
	item: Item | undefined,
	actor: Mob,
	room: Room | undefined
): boolean {
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
			`You cannot pick up ${displayName}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if actor is in a room
	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
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

	// Handle Currency items specially - add value to mob and remove the item
	if (item instanceof Currency) {
		actor.value += item.value;
		item.location = undefined; // Remove from room
		act(
			{
				user: `You pick up ${item.display}.`,
				room: `{User} picks up ${item.display}.`,
			},
			{
				user: actor,
				room: room,
			}
		);
		actor.sendMessage(
			`You gain ${formatNumber(item.value)} gold.`,
			MESSAGE_GROUP.ACTION
		);
		return true;
	}

	// Move item to actor's inventory
	actor.add(item);

	act(
		{
			user: `You pick up ${item.display}.`,
			room: `{User} picks up ${item.display}.`,
		},
		{
			user: actor,
			room: room,
		},
		{ messageGroup: MESSAGE_GROUP.ACTION }
	);

	// Emit item-pickup event for NPC AI
	const actorEmitter = actor.aiEvents;
	if (actorEmitter) {
		actorEmitter.emit("item-pickup", item);
	}

	return true;
}

/**
 * Gets a single item from a container and adds it to the actor's inventory.
 *
 * @param item - The item to get (undefined if not found)
 * @param container - The container to get the item from
 * @param actor - The mob getting the item
 * @param room - The room the actor is in
 * @returns true if the item was successfully retrieved, false otherwise
 */
export function getItemFromContainer(
	item: Item | undefined,
	container: DungeonObject | undefined,
	actor: Mob,
	room: Room | undefined
): boolean {
	if (!container) {
		actor.sendMessage(
			"You don't see that container here.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	if (!item) {
		actor.sendMessage(
			`You don't see that in ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Ensure it's actually an Item
	if (!(item instanceof Item)) {
		const displayName = (item as any)?.display || "that";
		actor.sendMessage(
			`You cannot pick up ${displayName}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if actor is in a room
	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return false;
	}

	// Check if container is an Item and has isContainer flag
	if (container instanceof Item && !container.isContainer) {
		actor.sendMessage(
			`${capitalizeFirst(container.display)} is not a container.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if container is accessible (in room or in actor's inventory)
	const containerLocation = container.location;
	if (containerLocation !== room && containerLocation !== actor) {
		actor.sendMessage(
			`You don't have access to ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Check if item is actually in the container
	if (item.location !== container) {
		actor.sendMessage(
			`${capitalizeFirst(item.display)} is not in ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return false;
	}

	// Handle Currency items specially - add value to mob and remove the item
	if (item instanceof Currency) {
		actor.value += item.value;
		item.location = undefined; // Remove from container
		act(
			{
				user: `You get ${item.display} from ${container.display}.`,
				room: `{User} gets ${item.display} from ${container.display}.`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.ACTION }
		);
		actor.sendMessage(
			`You gain ${formatNumber(item.value)} gold.`,
			MESSAGE_GROUP.ACTION
		);
		return true;
	}

	// Move item to actor's inventory
	actor.add(item);

	act(
		{
			user: `You get ${item.display} from ${container.display}.`,
			room: `{User} gets ${item.display} from ${container.display}.`,
		},
		{
			user: actor,
			room: room,
		},
		{ messageGroup: MESSAGE_GROUP.ACTION }
	);
	return true;
}

/**
 * Gets all items from a room and adds them to the actor's inventory.
 *
 * @param actor - The mob getting the items
 * @param room - The room to get items from
 */
export function getAllFromRoom(actor: Mob, room: Room | undefined): void {
	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return;
	}

	// Get all items from room (exclude non-Item objects and mobs)
	// Create a copy of the array since we'll be modifying room.contents during iteration
	const items = [...room.contents].filter(
		(obj: any) => obj instanceof Item
	) as Item[];

	if (items.length === 0) {
		actor.sendMessage(
			"There are no items here to get.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Get all items (currency handled separately - they convert to gold value)
	let successCount = 0;
	const failedItems: string[] = [];

	for (const item of items) {
		if (getItemFromRoom(item, actor, room)) {
			successCount++;
		} else {
			failedItems.push(item.display);
		}
	}

	if (failedItems.length > 0) {
		actor.sendMessage(
			`Could not pick up: ${failedItems.join(", ")}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	}
}

/**
 * Gets all items from a container and adds them to the actor's inventory.
 *
 * @param container - The container to get items from
 * @param actor - The mob getting the items
 * @param room - The room the actor is in
 */
export function getAllFromContainer(
	container: DungeonObject,
	actor: Mob,
	room: Room | undefined
): void {
	if (!container) {
		actor.sendMessage(
			"You don't see that container here.",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return;
	}

	// Check if container is an Item and has isContainer flag
	if (container instanceof Item && !container.isContainer) {
		actor.sendMessage(
			`${capitalizeFirst(container.display)} is not a container.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Check if container is accessible (in room or in actor's inventory)
	const containerLocation = container.location;
	if (containerLocation !== room && containerLocation !== actor) {
		actor.sendMessage(
			`You don't have access to ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Get all items from container (exclude non-Item objects)
	// Create a copy of the array since we'll be modifying container.contents during iteration
	const items = [...container.contents].filter(
		(obj: any) => obj instanceof Item
	) as Item[];

	if (items.length === 0) {
		actor.sendMessage(
			`There are no items in ${container.display}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	// Get all items
	let successCount = 0;
	const failedItems: string[] = [];

	for (const item of items) {
		if (getItemFromContainer(item, container, actor, room)) {
			successCount++;
		} else {
			failedItems.push(item.display);
		}
	}

	// Individual messages are already sent by getItemFromContainer for each item
	// Optionally send a summary if multiple items were picked up
	if (successCount > 1) {
		actor.sendMessage(
			`You get ${successCount} items from ${container.display}.`,
			MESSAGE_GROUP.ACTION
		);
	}

	if (failedItems.length > 0) {
		actor.sendMessage(
			`Could not get: ${failedItems.join(", ")}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	}
}
