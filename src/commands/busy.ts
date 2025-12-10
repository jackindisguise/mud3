/**
 * Busy command for managing busy mode and message queuing.
 *
 * Busy mode allows players to queue certain message groups (like channels)
 * to be read later, similar to an answering machine. Combat busy mode
 * automatically activates when in combat.
 *
 * @example
 * ```
 * busy                    // Toggle busy mode on/off
 * busy forward combat    // Forward combat messages to answering machine
 * busy immediate combat  // Stop forwarding combat messages
 * busy read              // Read all queued messages
 * busy combat forward info  // Forward info messages in combat busy mode
 * ```
 *
 * **Pattern:** `busy~ <action:word?> <mode:word?> <group:word?>`
 * @module commands/busy
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP, MESSAGE_GROUP_NAMES } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { color, COLOR } from "../core/color.js";

/**
 * List of message groups that can be forwarded in busy mode.
 * Excludes PROMPT, COMMAND_RESPONSE, and SYSTEM as these should always be shown immediately.
 */
const VALID_FORWARDABLE_GROUPS: MESSAGE_GROUP[] = [
	MESSAGE_GROUP.INFO,
	MESSAGE_GROUP.COMBAT,
	MESSAGE_GROUP.CHANNELS,
	MESSAGE_GROUP.ACTION,
];

/**
 * Get a message group by name (case-insensitive)
 */
function getMessageGroupByName(name: string): MESSAGE_GROUP | undefined {
	const normalized = name.toLowerCase();
	for (const [group, groupName] of Object.entries(MESSAGE_GROUP_NAMES)) {
		if (groupName === normalized) {
			return group as MESSAGE_GROUP;
		}
	}
	return undefined;
}

/**
 * Get all valid forwardable message group names
 */
function getValidForwardableGroupNames(): string[] {
	return VALID_FORWARDABLE_GROUPS.map((group) => MESSAGE_GROUP_NAMES[group]);
}

export const command = {
	pattern: "busy~ <action:word?> <mode:word?> <group:word?>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const action = args.get("action") as string | undefined;
		const mode = args.get("mode") as string | undefined;
		const groupName = args.get("group") as string | undefined;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can use busy mode.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Initialize forwarded groups if not set
		if (!character.settings.busyForwardedGroups) {
			character.settings.busyForwardedGroups = new Set([
				MESSAGE_GROUP.CHANNELS,
			]);
		}
		if (!character.settings.combatBusyForwardedGroups) {
			character.settings.combatBusyForwardedGroups = new Set([
				MESSAGE_GROUP.CHANNELS,
			]);
		}

		// No action: show busy mode state
		if (!action) {
			const busyModeState = character.settings.busyModeEnabled ?? false;
			const combatBusyModeState =
				character.settings.combatBusyModeEnabled ?? true;
			const busyForwarded = Array.from(
				character.settings.busyForwardedGroups ?? new Set()
			).map((g) => MESSAGE_GROUP_NAMES[g]);
			const combatBusyForwarded = Array.from(
				character.settings.combatBusyForwardedGroups ?? new Set()
			).map((g) => MESSAGE_GROUP_NAMES[g]);
			const session = character.session;
			const queuedCount = session?.queuedMessages?.length ?? 0;

			const lines: string[] = [];
			lines.push(color("Busy Mode Status:", COLOR.YELLOW));
			lines.push("");
			lines.push(
				`  Busy mode: ${
					busyModeState ? color("on", COLOR.LIME) : color("off", COLOR.CRIMSON)
				}`
			);
			lines.push(
				`  Combat busy mode: ${
					combatBusyModeState
						? color("on", COLOR.LIME)
						: color("off", COLOR.CRIMSON)
				}`
			);
			lines.push("");
			lines.push(
				`  Forwarded groups (busy): ${
					busyForwarded.length > 0 ? busyForwarded.join(", ") : "none"
				}`
			);
			lines.push(
				`  Forwarded groups (combat): ${
					combatBusyForwarded.length > 0
						? combatBusyForwarded.join(", ")
						: "none"
				}`
			);
			if (queuedCount > 0) {
				lines.push("");
				lines.push(
					`  Queued messages: ${color(queuedCount.toString(), COLOR.YELLOW)}`
				);
			}
			lines.push("");
			lines.push(color("Commands:", COLOR.YELLOW));
			lines.push(
				color("  busy on/off", COLOR.GREY) + " - Toggle busy mode on or off"
			);
			lines.push(
				color("  busy read", COLOR.GREY) + " - Read all queued messages"
			);
			lines.push(
				color("  busy forward <group>", COLOR.GREY) +
					" - Forward a message group to answering machine"
			);
			lines.push(
				color("  busy immediate <group>", COLOR.GREY) +
					" - Stop forwarding a message group (show immediately)"
			);
			lines.push(
				color("  busy combat", COLOR.GREY) +
					" - Toggle combat busy mode on or off"
			);
			lines.push(
				color("  busy combat forward <group>", COLOR.GREY) +
					" - Forward a message group in combat busy mode"
			);
			lines.push(
				color("  busy combat immediate <group>", COLOR.GREY) +
					" - Stop forwarding a message group in combat busy mode"
			);

			actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
			return;
		}

		const normalizedAction = action.toLowerCase();

		// Handle "on", "off", "enable", "disable" actions
		if (
			normalizedAction === "on" ||
			normalizedAction === "enable" ||
			normalizedAction === "off" ||
			normalizedAction === "disable"
		) {
			const isEnable =
				normalizedAction === "on" || normalizedAction === "enable";
			character.updateSettings({ busyModeEnabled: isEnable });
			actor.sendMessage(
				`Busy mode ${isEnable ? "enabled" : "disabled"}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle "read" action
		if (normalizedAction === "read") {
			const messages = character.readQueuedMessages();
			if (messages.length === 0) {
				actor.sendMessage(
					"No messages waiting.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			} else {
				actor.sendMessage(
					`Read ${messages.length} queued message${
						messages.length === 1 ? "" : "s"
					}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			}
			return;
		}

		// Handle "combat" action first (to catch "busy combat forward/immediate")
		if (normalizedAction === "combat") {
			if (
				mode?.toLowerCase() === "forward" ||
				mode?.toLowerCase() === "immediate"
			) {
				// This is "busy combat forward <group>" or "busy combat immediate <group>"
				const forwardedGroups = character.settings.combatBusyForwardedGroups!;
				const targetGroup = groupName;

				if (!targetGroup) {
					actor.sendMessage(
						`Usage: busy combat ${mode} <group>`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					actor.sendMessage(
						`Available groups: ${getValidForwardableGroupNames().join(", ")}`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					return;
				}

				const group = getMessageGroupByName(targetGroup);
				if (!group) {
					actor.sendMessage(
						`Unknown message group "${targetGroup}". Available groups: ${getValidForwardableGroupNames().join(
							", "
						)}`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					return;
				}

				if (!VALID_FORWARDABLE_GROUPS.includes(group)) {
					actor.sendMessage(
						`Message group "${targetGroup}" cannot be forwarded. Available groups: ${getValidForwardableGroupNames().join(
							", "
						)}`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					return;
				}

				if (mode.toLowerCase() === "forward") {
					forwardedGroups.add(group);
					character.updateSettings({
						combatBusyForwardedGroups: forwardedGroups,
					});
					actor.sendMessage(
						`Combat busy mode will now forward ${MESSAGE_GROUP_NAMES[group]} messages.`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
				} else {
					// immediate
					forwardedGroups.delete(group);
					character.updateSettings({
						combatBusyForwardedGroups: forwardedGroups,
					});
					actor.sendMessage(
						`Combat busy mode will now show ${MESSAGE_GROUP_NAMES[group]} messages immediately.`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
				}
				return;
			}

			// Toggle combat busy mode
			const currentState = character.settings.combatBusyModeEnabled ?? true;
			character.updateSettings({ combatBusyModeEnabled: !currentState });
			actor.sendMessage(
				`Combat busy mode ${!currentState ? "enabled" : "disabled"}.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Handle "forward" and "immediate" actions
		if (normalizedAction === "forward" || normalizedAction === "immediate") {
			// For regular busy mode: "busy forward <group>" or "busy immediate <group>"
			const targetGroup = mode;
			const forwardedGroups = character.settings.busyForwardedGroups!;

			if (!targetGroup) {
				actor.sendMessage(
					`Usage: busy ${action} <group>`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				actor.sendMessage(
					`Available groups: ${getValidForwardableGroupNames().join(", ")}`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			const group = getMessageGroupByName(targetGroup);
			if (!group) {
				actor.sendMessage(
					`Unknown message group "${targetGroup}". Available groups: ${getValidForwardableGroupNames().join(
						", "
					)}`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			if (!VALID_FORWARDABLE_GROUPS.includes(group)) {
				actor.sendMessage(
					`Message group "${targetGroup}" cannot be forwarded. Available groups: ${getValidForwardableGroupNames().join(
						", "
					)}`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			if (normalizedAction === "forward") {
				forwardedGroups.add(group);
				character.updateSettings({ busyForwardedGroups: forwardedGroups });
				actor.sendMessage(
					`Busy mode will now forward ${MESSAGE_GROUP_NAMES[group]} messages.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			} else {
				// immediate
				forwardedGroups.delete(group);
				character.updateSettings({ busyForwardedGroups: forwardedGroups });
				actor.sendMessage(
					`Busy mode will now show ${MESSAGE_GROUP_NAMES[group]} messages immediately.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			}
			return;
		}

		// Unknown action
		actor.sendMessage(
			`Unknown action "${action}". Use: busy, busy on/off, busy forward <group>, busy immediate <group>, busy read, busy combat, busy combat forward <group>, busy combat immediate <group>`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;
