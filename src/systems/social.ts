/**
 * Social command message definitions.
 *
 * This module defines all social emotes/actions that can be performed in the game.
 * Social commands are auto-generated from these definitions at runtime.
 *
 * @module social
 */

import { ActMessageTemplates } from "../utils/act.js";

/**
 * Message templates for a social action.
 */
export interface SocialMessages {
	/** Message when performed alone (no target) */
	alone: ActMessageTemplates;
	/** Message when performed with a target */
	withTarget: ActMessageTemplates;
}

/**
 * Configuration for a social command.
 */
export interface SocialDefinition {
	/** The command name (e.g., "laugh", "dance") */
	name: string;
	/** Message templates for the social action */
	messages: SocialMessages;
	/** Whether the target is required (true) or optional (false) */
	requiresTarget?: boolean;
}

/**
 * All social command definitions.
 */
export const SOCIAL_COMMANDS: Record<string, SocialDefinition> = {
	laugh: {
		name: "laugh",
		messages: {
			alone: {
				user: "You laugh heartily.",
				room: "{User} laughs heartily.",
			},
			withTarget: {
				user: "You laugh at {target}.",
				room: "{User} laughs at {target}.",
				target: "{User} laughs at you.",
			},
		},
	},
	poke: {
		name: "poke",
		messages: {
			alone: {
				user: "You poke the air.",
				room: "{User} pokes the air.",
			},
			withTarget: {
				user: "You poke {target}.",
				room: "{User} pokes {target}.",
				target: "{User} pokes you.",
			},
		},
		requiresTarget: true,
	},
	cry: {
		name: "cry",
		messages: {
			alone: {
				user: "You burst into tears.",
				room: "{User} bursts into tears.",
			},
			withTarget: {
				user: "You cry to {target}.",
				room: "{User} cries to {target}.",
				target: "{User} cries to you.",
			},
		},
	},
	dance: {
		name: "dance",
		messages: {
			alone: {
				user: "You start dancing.",
				room: "{User} starts dancing.",
			},
			withTarget: {
				user: "You start dancing with {target}.",
				room: "{User} starts dancing with {target}.",
				target: "{User} starts dancing with you.",
			},
		},
	},
	mock: {
		name: "mock",
		messages: {
			alone: {
				user: "You mock the air.",
				room: "{User} mocks the air.",
			},
			withTarget: {
				user: "You mock {target}.",
				room: "{User} mocks {target}.",
				target: "{User} mocks you.",
			},
		},
		requiresTarget: true,
	},
	spit: {
		name: "spit",
		messages: {
			alone: {
				user: "You spit on the ground.",
				room: "{User} spits on the ground.",
			},
			withTarget: {
				user: "You spit at {target}.",
				room: "{User} spits at {target}.",
				target: "{User} spits at you.",
			},
		},
	},
	die: {
		name: "die",
		messages: {
			alone: {
				user: "You dramatically collapse and die!",
				room: "{User} dramatically collapses and dies!",
			},
			withTarget: {
				user: "You dramatically collapse and die!",
				room: "{User} dramatically collapses and dies!",
			},
		},
	},
};

/**
 * Get all social command names.
 */
export function getSocialCommandNames(): string[] {
	return Object.keys(SOCIAL_COMMANDS);
}

/**
 * Get a social command definition by name.
 */
export function getSocialCommand(name: string): SocialDefinition | undefined {
	return SOCIAL_COMMANDS[name.toLowerCase()];
}
