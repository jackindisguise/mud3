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
import { exec } from "child_process";
import { promisify } from "util";
import { loadBoard, saveBoard } from "../package/board.js";
import logger from "../logger.js";
import { string } from "mud-ext";
import { SIZER, TEXT_STYLE, textStyleToTag } from "../color.js";
import { LINEBREAK } from "../telnet.js";

const execAsync = promisify(exec);

const CHANGELOG_PATH = join(process.cwd(), "CHANGELOG.md");
const CHANGES_BOARD_NAME = "changes";
const SYSTEM_AUTHOR = "SYSTEM";

/**
 * Parses a single version section from the changelog.
 *
 * @param lines - All lines from the changelog
 * @param versionLineIndex - Index of the version header line
 * @returns Object containing version, date, and formatted change content, or null if parsing fails
 */
async function parseVersionSection(
	lines: string[],
	versionLineIndex: number
): Promise<{
	version: string;
	date: string;
	content: string;
} | null> {
	// Extract version and date from the header line
	const versionMatch = lines[versionLineIndex].match(
		/^##\s+\[?(\d+\.\d+\.\d+)\]?/
	);
	if (!versionMatch) {
		return null;
	}

	const version = versionMatch[1];
	let date: string | undefined;
	const dateMatch = lines[versionLineIndex].match(/\((\d{4}-\d{2}-\d{2})\)/);
	if (dateMatch) {
		date = dateMatch[1];
	}

	// Extract content until the next version header or end of file
	const contentLines: string[] = [];
	for (let i = versionLineIndex + 1; i < lines.length; i++) {
		// Check for next version header (## [X.Y.Z] or ## X.Y.Z)
		if (lines[i].match(/^##\s+\[?\d+\.\d+\.\d+\]?/)) {
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
		return null;
	}

	let content = contentLines.join("\n");

	// Extract commit hashes and fetch full commit bodies
	const commitHashRegex =
		/\[([^\]]+)\]\(https:\/\/[^)]+\/commit\/([a-f0-9]+)\)/g;
	const commitHashes: string[] = [];
	let match;
	while ((match = commitHashRegex.exec(content)) !== null) {
		commitHashes.push(match[2]);
	}

	// Fetch commit bodies for each hash
	const commitDetails: Map<string, string> = new Map();
	for (const hash of commitHashes) {
		try {
			const { stdout } = await execAsync(`git log -1 --format=%B ${hash}`);
			const commitBody = stdout.trim();
			if (commitBody) {
				commitDetails.set(hash, commitBody);
			}
		} catch (error) {
			logger.warn(`Failed to fetch commit body for ${hash}: ${error}`);
		}
	}

	// Replace markdown links with short hash and append commit body if available
	content = content.replace(
		/\[([^\]]+)\]\(https:\/\/[^)]+\/commit\/([a-f0-9]+)\)/g,
		(_, _text, fullHash) => {
			const shortHash = fullHash.substring(0, 7);
			const commitBody = commitDetails.get(fullHash);
			if (commitBody) {
				// Include commit body after the hash
				return `${shortHash}\n\n${commitBody}`;
			}
			return shortHash;
		}
	);

	// Trim whitespace from start and end
	content = content.trim();

	return { version, date: date || "", content };
}

/**
 * Parses the CHANGELOG.md file to extract all versions.
 *
 * @returns Array of version entries, ordered from newest to oldest
 */
async function parseAllChangelogVersions(): Promise<
	Array<{
		version: string;
		date: string;
		content: string;
	}>
> {
	try {
		const changelogContent = await readFile(CHANGELOG_PATH, "utf-8");
		const lines = changelogContent.split("\n");

		// Find all version headers
		const versionIndices: number[] = [];
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].match(/^##\s+\[?\d+\.\d+\.\d+\]?/)) {
				versionIndices.push(i);
			}
		}

		if (versionIndices.length === 0) {
			logger.warn("No version headers found in CHANGELOG.md");
			return [];
		}

		// Parse each version section
		const versions: Array<{
			version: string;
			date: string;
			content: string;
		}> = [];

		for (const index of versionIndices) {
			const versionData = await parseVersionSection(lines, index);
			if (versionData) {
				versions.push(versionData);
			}
		}

		return versions;
	} catch (error) {
		logger.error(`Failed to parse CHANGELOG.md: ${error}`);
		return [];
	}
}

/**
 * Posts all unposted changelog entries to the changes board.
 * Posts versions from newest to oldest, stopping when it finds a version that's already posted.
 */
async function postChangelogToBoard(): Promise<void> {
	try {
		const versions = await parseAllChangelogVersions();
		if (versions.length === 0) {
			logger.warn("No changelog versions found");
			return;
		}

		const board = await loadBoard(CHANGES_BOARD_NAME);
		if (!board) {
			logger.error(`Changes board not found: ${CHANGES_BOARD_NAME}`);
			return;
		}

		// Get all existing version messages
		const existingMessages = board.getAllMessages();
		const postedVersions = new Set(
			existingMessages
				.filter((msg) => msg.author === SYSTEM_AUTHOR)
				.map((msg) => {
					const match = msg.subject.match(/^Version (.+)$/);
					return match ? match[1] : null;
				})
				.filter((v): v is string => v !== null)
		);

		// Post all unposted versions, starting from newest
		let postedCount = 0;
		for (const versionData of versions) {
			if (postedVersions.has(versionData.version)) {
				logger.info(`Version ${versionData.version} already posted, skipping`);
				continue;
			}

			const versionSubject = `Version ${versionData.version}`;
			// Normalize line endings: replace multiple consecutive line breaks with single \n
			const normalizedContent = versionData.content
				.trim()
				.split(/\r?\n/g)
				.join("\n");
			const wrappedContent = string.wrap(normalizedContent, 72, SIZER);
			const resetTag = textStyleToTag(TEXT_STYLE.RESET_ALL);
			const linesWithReset = wrappedContent.map((line) => line + resetTag);
			console.log(linesWithReset);
			// Create the message
			board.createMessage(
				SYSTEM_AUTHOR,
				versionSubject,
				linesWithReset.join(LINEBREAK)
			);
			postedCount++;

			logger.info(
				`Posted changelog for version ${versionData.version} to changes board`
			);
		}

		if (postedCount > 0) {
			// Save the board after posting all new versions
			await saveBoard(board);
			logger.info(`Posted ${postedCount} new changelog version(s)`);
		} else {
			logger.info("All changelog versions are already posted");
		}
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

export { postChangelogToBoard, parseAllChangelogVersions, parseVersionSection };
