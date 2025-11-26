/**
 * Act system for expressing action messages with different perspectives.
 *
 * The act system simplifies the process of expressing action messages where
 * different observers see different versions of the same action.
 *
 * For example, if player A uses the `dance b` command:
 * - A sees: "You start dancing with B."
 * - Room observers see: "A starts dancing with B."
 * - B sees: "A starts dancing with you."
 *
 * The system uses message templates with placeholders that are automatically
 * replaced based on the observer's perspective.
 *
 * @example
 * ```typescript
 * import { act } from "./act.js";
 * import { MESSAGE_GROUP } from "./character.js";
 *
 * act({
 *   user: "You start dancing with {target}.",
 *   room: "{user} starts dancing with {target}.",
 *   target: "{user} starts dancing with you."
 * }, {
 *   user: actor,
 *   target: targetMob,
 *   room: currentRoom
 * }, MESSAGE_GROUP.INFO);
 * ```
 *
 * @module act
 */

import { Mob, Room } from "./core/dungeon.js";
import { MESSAGE_GROUP } from "./core/character.js";

/**
 * Message templates for an action from different perspectives.
 *
 * @property user - Message seen by the actor performing the action
 * @property room - Message seen by other observers in the room (excluding user and target)
 * @property target - Message seen by the target of the action (if applicable)
 */
export interface ActMessageTemplates {
	/** Message template for the user performing the action */
	user?: string;
	/** Message template for room observers (excluding user and target) */
	room: string;
	/** Optional message template for the target of the action */
	target?: string;
}

/**
 * Context for an act message, containing the participants and location.
 *
 * @property user - The mob performing the action
 * @property target - Optional target mob of the action
 * @property room - The room where the action takes place
 */
export interface ActContext {
	/** The mob performing the action */
	user: Mob;
	/** Optional target mob of the action */
	target?: Mob;
	/** The room where the action takes place */
	room: Room;
}

/**
 * Visibility/perception information for determining what observers can see.
 * This is a placeholder for future features like invisibility.
 *
 * @property canSeeUser - Whether the observer can see the user (default: true)
 * @property canSeeTarget - Whether the observer can see the target (default: true)
 */
export interface ActVisibility {
	/** Whether the observer can see the user performing the action */
	canSeeUser?: boolean;
	/** Whether the observer can see the target of the action */
	canSeeTarget?: boolean;
}

/**
 * Options for customizing act message behavior.
 *
 * @property visibility - Optional visibility/perception information
 * @property messageGroup - Message group for categorizing the message (default: INFO)
 * @property excludeUser - Whether to exclude the user from room messages (default: true)
 * @property excludeTarget - Whether to exclude the target from room messages (default: true)
 */
export interface ActOptions {
	/** Optional visibility/perception information */
	visibility?: ActVisibility;
	/** Message group for categorizing the message */
	messageGroup?: MESSAGE_GROUP;
	/** Whether to exclude the user from room messages */
	excludeUser?: boolean;
	/** Whether to exclude the target from room messages */
	excludeTarget?: boolean;
}

/**
 * Default visibility - all observers can see everything.
 */
const DEFAULT_VISIBILITY: ActVisibility = {
	canSeeUser: true,
	canSeeTarget: true,
};

/**
 * Default options for act messages.
 * Note: messageGroup is set lazily to avoid circular dependency issues.
 */
function getDefaultOptions(): Required<ActOptions> {
	return {
		visibility: DEFAULT_VISIBILITY,
		messageGroup: MESSAGE_GROUP.ACTION,
		excludeUser: true,
		excludeTarget: true,
	};
}

/**
 * Replaces placeholders in a message template with actual values.
 *
 * Supported placeholders:
 * - `{user}` - Name of the user performing the action
 * - `{target}` - Name of the target (if applicable)
 * - `{User}` - Capitalized name of the user
 * - `{Target}` - Capitalized name of the target
 *
 * @param template The message template with placeholders
 * @param context The act context containing user, target, and room
 * @param visibility Optional visibility information for determining what to show
 * @returns The formatted message with placeholders replaced
 */
function replacePlaceholders(
	template: string,
	context: ActContext,
	visibility?: ActVisibility
): string {
	const user = context.user.display;
	const target = context.target?.display ?? "";
	const userCap = user.charAt(0).toUpperCase() + user.slice(1);
	const targetCap = target
		? target.charAt(0).toUpperCase() + target.slice(1)
		: "";

	// Handle visibility - if user is invisible, show "Someone" instead
	const visibleUser = visibility?.canSeeUser === false ? "Someone" : user;
	const visibleUserCap = visibility?.canSeeUser === false ? "Someone" : userCap;
	const visibleTarget = visibility?.canSeeTarget === false ? "someone" : target;
	const visibleTargetCap =
		visibility?.canSeeTarget === false ? "Someone" : targetCap;

	return template
		.replace(/\{user\}/g, visibleUser)
		.replace(/\{target\}/g, visibleTarget)
		.replace(/\{User\}/g, visibleUserCap)
		.replace(/\{Target\}/g, visibleTargetCap);
}

/**
 * Sends an act message to all appropriate recipients in a room.
 *
 * This function handles the distribution of action messages based on perspective:
 * - The user sees the "user" template
 * - The target (if present) sees the "target" template
 * - Other room observers see the "room" template
 *
 * @param templates Message templates for different perspectives
 * @param context The act context containing user, target, and room
 * @param options Optional configuration for message behavior
 *
 * @example
 * ```typescript
 * import { act } from "./act.js";
 * import { MESSAGE_GROUP } from "./character.js";
 *
 * // Simple action with a target
 * act({
 *   user: "You start dancing with {target}.",
 *   room: "{User} starts dancing with {target}.",
 *   target: "{User} starts dancing with you."
 * }, {
 *   user: actor,
 *   target: targetMob,
 *   room: currentRoom
 * }, { messageGroup: MESSAGE_GROUP.INFO });
 *
 * // Action without a target
 * act({
 *   user: "You start dancing.",
 *   room: "{User} starts dancing."
 * }, {
 *   user: actor,
 *   room: currentRoom
 * });
 * ```
 */
export function act(
	templates: ActMessageTemplates,
	context: ActContext,
	options?: ActOptions
): void {
	const opts = { ...getDefaultOptions(), ...options };
	const { user, target, room } = context;

	// Send message to the user
	if (user.character && templates.user) {
		const userMessage = replacePlaceholders(
			templates.user,
			context,
			opts.visibility
		);
		user.character.sendMessage(userMessage, opts.messageGroup);
	}

	// Send message to the target (if present and has a character)
	if (target && templates.target) {
		if (target.character) {
			// Check if target is blocking the user
			if (
				user.character &&
				target.character.isBlocking(user.character.credentials.username)
			) {
				// Target is blocking user, skip sending message
			} else {
				const targetMessage = replacePlaceholders(
					templates.target,
					context,
					opts.visibility
				);
				target.character.sendMessage(targetMessage, opts.messageGroup);
			}
		}
	}

	// Send message to room observers
	const roomMessage = replacePlaceholders(
		templates.room,
		context,
		opts.visibility
	);

	for (const obj of room.contents) {
		if (!(obj instanceof Mob)) continue;
		if (!obj.character) continue;

		// Skip user if excludeUser is true
		if (opts.excludeUser && obj === user) continue;

		// Skip target if excludeTarget is true
		if (opts.excludeTarget && target && obj === target) continue;

		// Check if observer is blocking the user
		if (
			user.character &&
			obj.character.isBlocking(user.character.credentials.username)
		) {
			// Observer is blocking user, skip sending message
			continue;
		}

		// Send the room message to this observer
		obj.character.sendMessage(roomMessage, opts.messageGroup);
	}
}

/**
 * Wraps act() to automatically inject HP percentage into user and target messages.
 * This is used for combat damage messages to show the target's remaining health.
 *
 * The HP percentage is calculated after the damage is dealt and appended to the
 * user and target messages (but not the room message).
 *
 * @param templates Message templates for different perspectives
 * @param context The act context containing user, target, and room
 * @param target The target mob that received damage
 * @param damage The amount of damage dealt
 * @param options Optional configuration for message behavior
 *
 * @example
 * ```typescript
 * import { damageMessage } from "./act.js";
 * import { MESSAGE_GROUP } from "./character.js";
 *
 * damageMessage(
 *   {
 *     user: "You hit {target} for {damage} damage.",
 *     target: "{User} hits you for {damage} damage.",
 *     room: "{User} hits {target} for {damage} damage."
 *   },
 *   {
 *     user: attacker,
 *     target: defender,
 *     room: currentRoom
 *   },
 *   defender,
 *   25,
 *   { messageGroup: MESSAGE_GROUP.COMBAT }
 * );
 * ```
 */
export function damageMessage(
	templates: ActMessageTemplates,
	context: ActContext,
	target: Mob,
	damage: number,
	options?: ActOptions
): void {
	// Calculate HP percentage after damage
	const healthAfterDamage = Math.max(0, target.health - damage);
	const hpPercentage = Math.round((healthAfterDamage / target.maxHealth) * 100);
	const hpSuffix = ` [${hpPercentage}%]`;

	// Create modified templates with HP suffix added to user and target messages
	const modifiedTemplates: ActMessageTemplates = {
		user: templates.user ? `${templates.user}${hpSuffix}` : undefined,
		target: templates.target ? `${templates.target}${hpSuffix}` : undefined,
		room: templates.room, // Room message doesn't get HP suffix
	};

	// Call act() with modified templates
	act(modifiedTemplates, context, options);
}
