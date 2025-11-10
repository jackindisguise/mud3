/**
 * Script to post recent changelog entries to the changes board.
 *
 * Parses CHANGELOG.md to extract the most recent version's changes and posts
 * them to the changes board with SYSTEM as the author.
 *
 * @example
 * ```bash
 * npm run post-changelog
 * ```
 *
 * @module scripts/post-changelog-to-board
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { loadBoard, saveBoard } from "../package/board.js";
import logger from "../logger.js";

const CHANGELOG_PATH = join(process.cwd(), "CHANGELOG.md");
const CHANGES_BOARD_NAME = "changes";
const SYSTEM_AUTHOR = "SYSTEM";

/**
 * Parses the CHANGELOG.md file to extract the most recent version's changes.
 *
 * @returns Object containing version, date, and formatted change content, or null if parsing fails
 */
async function parseLatestChangelog(): Promise<{
	version: string;
	date: string;
	content: string;
} | null> {
	try {
		const changelogContent = await readFile(CHANGELOG_PATH, "utf-8");
		const lines = changelogContent.split("\n");

		// Find the first version header (## X.Y.Z (YYYY-MM-DD))
		let versionLineIndex = -1;
		for (let i = 0; i < lines.length; i++) {
			const match = lines[i].match(/^##\s+([\d.]+)\s+\((\d{4}-\d{2}-\d{2})\)/);
			if (match) {
				versionLineIndex = i;
				const version = match[1];
				const date = match[2];
				break;
			}
		}

		if (versionLineIndex === -1) {
			logger.warn("No version header found in CHANGELOG.md");
			return null;
		}

		const versionMatch = lines[versionLineIndex].match(
			/^##\s+([\d.]+)\s+\((\d{4}-\d{2}-\d{2})\)/
		);
		if (!versionMatch) {
			return null;
		}

		const version = versionMatch[1];
		const date = versionMatch[2];

		// Extract content until the next version header or end of file
		const contentLines: string[] = [];
		for (let i = versionLineIndex + 1; i < lines.length; i++) {
			if (lines[i].match(/^##\s+[\d.]+\s+\(\d{4}-\d{2}-\d{2}\)/)) {
				break;
			}
			contentLines.push(lines[i]);
		}

		// Trim empty lines from start and end
		while (contentLines.length > 0 && contentLines[0].trim() === "") {
			contentLines.shift();
		}
		while (
			contentLines.length > 0 &&
			contentLines[contentLines.length - 1].trim() === ""
		) {
			contentLines.pop();
		}

		if (contentLines.length === 0) {
			logger.warn("No content found for latest version in CHANGELOG.md");
			return null;
		}

		let content = contentLines.join("\n");

		// Strip markdown links: [text](url) -> short hash
		// Pattern matches: [text](https://github.com/.../commit/abc123def456) -> abc123
		// Extracts first 7 characters of the commit hash as the short hash
		// Replaces the entire markdown link with just the short hash (no parentheses)
		// The changelog format already has parentheses around the link
		content = content.replace(
			/\[([^\]]+)\]\(https:\/\/[^)]+\/commit\/([a-f0-9]+)\)/g,
			(_, _text, fullHash) => {
				const shortHash = fullHash.substring(0, 7);
				return shortHash;
			}
		);

		// Trim whitespace from start and end
		content = content.trim();

		return { version, date, content };
	} catch (error) {
		logger.error(`Failed to parse CHANGELOG.md: ${error}`);
		return null;
	}
}

/**
 * Posts the latest changelog entry to the changes board.
 */
async function postChangelogToBoard(): Promise<void> {
	try {
		const changelogData = await parseLatestChangelog();
		if (!changelogData) {
			logger.warn("No changelog data to post");
			return;
		}

		const board = await loadBoard(CHANGES_BOARD_NAME);
		if (!board) {
			logger.error(`Changes board not found: ${CHANGES_BOARD_NAME}`);
			return;
		}

		// Check if we've already posted this version
		const existingMessages = board.getAllMessages();
		const versionSubject = `Version ${changelogData.version}`;
		const alreadyPosted = existingMessages.some(
			(msg) => msg.author === SYSTEM_AUTHOR && msg.subject === versionSubject
		);

		if (alreadyPosted) {
			logger.info(
				`Version ${changelogData.version} already posted to changes board`
			);
			return;
		}

		// Ensure content is trimmed (should already be done, but double-check)
		const trimmedContent = changelogData.content.trim();

		// Create the message
		board.createMessage(SYSTEM_AUTHOR, versionSubject, trimmedContent);

		// Save the board
		await saveBoard(board);

		logger.info(
			`Posted changelog for version ${changelogData.version} to changes board`
		);
	} catch (error) {
		logger.error(`Failed to post changelog to board: ${error}`);
		throw error;
	}
}

// Run if executed directly
const scriptPath = fileURLToPath(import.meta.url);
const isMainModule =
	process.argv[1] === scriptPath ||
	process.argv[1]?.endsWith("post-changelog-to-board.js");

if (isMainModule) {
	postChangelogToBoard()
		.then(() => {
			process.exit(0);
		})
		.catch((error) => {
			logger.error(`Script failed: ${error}`);
			process.exit(1);
		});
}

export { postChangelogToBoard, parseLatestChangelog };
