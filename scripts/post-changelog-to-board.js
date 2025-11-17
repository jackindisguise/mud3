#!/usr/bin/env node

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

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { loadBoard } from "../dist/src/package/board.js";
import logger from "../dist/src/logger.js";
import { string } from "mud-ext";
import { COLOR, color, SIZER } from "../dist/src/color.js";
import { LINEBREAK } from "../dist/src/telnet.js";

const CHANGELOG_PATH = join(process.cwd(), "CHANGELOG.md");
const CHANGES_BOARD_NAME = "changes";
const SYSTEM_AUTHOR = "SYSTEM";

/**
 * Fetches the full commit message body for a given commit hash.
 *
 * @param {string} commitHash - The commit hash to fetch
 * @returns {Object|null} Parsed commit body or null if fetch fails
 */
function fetchCommitBody(commitHash) {
	try {
		// Get the full commit message body (everything after the subject)
		const commitBody = execSync(`git show --format=%B -s ${commitHash}`, {
			encoding: "utf-8",
			cwd: process.cwd(),
		}).trim();

		if (!commitBody) {
			return null;
		}

		// Parse bullet points from the commit body
		// Treat every non-empty line as a bullet point (remove leading "- " if present)
		// Skip the first line (commit subject) as it's already in the changelog
		const lines = commitBody.split(/\r?\n/);
		const bulletPoints = [];

		// Skip the first line (commit subject) - start from index 1
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			// Skip empty lines
			if (!trimmed) {
				continue;
			}

			// Remove leading "- " if present (for commits that follow the format)
			const bulletText = trimmed.replace(/^-\s+/, "").trim();

			// Parse each bullet point using the same logic as changelog entries
			const parsed = parseBulletPoint(bulletText);
			bulletPoints.push(parsed);
		}

		return {
			body: commitBody,
			bulletPoints,
		};
	} catch (error) {
		logger.warn(`Failed to fetch commit body for ${commitHash}: ${error}`);
		return null;
	}
}

/**
 * Parses a bullet point line to extract prefix tag, commit hash, URLs, and issue numbers.
 * Also fetches and parses the commit message body if a commit hash is found.
 *
 * @param {string} bulletText - The bullet point text (without the leading `* `)
 * @returns {Object} Parsed bullet point data
 */
function parseBulletPoint(bulletText) {
	const result = {
		text: bulletText,
		prefixTag: null,
		commitType: null,
		commitHash: null,
		commitUrl: null,
		commitBody: null,
		issueNumber: null,
		issueUrl: null,
		urls: [],
	};

	// Extract prefix tag (e.g., **deprecated:**, **deps:**)
	const prefixMatch = bulletText.match(/^\*\*([^*]+):\*\*\s*/);
	if (prefixMatch) {
		result.prefixTag = prefixMatch[1].trim();
		// Remove prefix from text for cleaner display
		result.text = bulletText.replace(/^\*\*[^*]+:\*\*\s*/, "").trim();
	}

	// Extract conventional commit type (e.g., feat:, fix:, chore:, etc.)
	// Common types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
	// Also supports breaking changes with ! (e.g., feat!:, fix!:)
	const commitTypeMatch = result.text.match(
		/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(!)?(\(.+?\))?:\s*(.+)$/i
	);
	if (commitTypeMatch) {
		const type = commitTypeMatch[1].toLowerCase();
		const isBreaking = !!commitTypeMatch[2]; // The ! indicator
		result.commitType = isBreaking ? `${type}!` : type;
		// Remove the commit type prefix from text (including optional scope and !)
		result.text = commitTypeMatch[4].trim();
	}

	// Extract all markdown links: [text](url)
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	let linkMatch;

	while ((linkMatch = linkPattern.exec(bulletText)) !== null) {
		const linkText = linkMatch[1];
		const linkUrl = linkMatch[2];

		// Check if this is a commit hash (7+ character hex string)
		if (/^[a-f0-9]{7,}$/i.test(linkText)) {
			result.commitHash = linkText;
			result.commitUrl = linkUrl;
			// Note: We no longer fetch commit body here - it's done at the version level
		}

		// Check if this is an issue number (starts with #)
		if (linkText.startsWith("#")) {
			result.issueNumber = linkText;
			result.issueUrl = linkUrl;
		}

		// Collect all URLs
		result.urls.push(linkUrl);
	}

	// Remove all markdown links from the text (replace [text](url) with just text, or remove entirely)
	result.text = result.text.replace(
		/ \(\[([^\]]+)\]\([^)]+\)\)/g,
		(match, linkText) => {
			// For commit hashes and issue numbers, remove them entirely (we'll add them back in formatBulletPoint)
			if (/^[a-f0-9]{7,}$/i.test(linkText) || linkText.startsWith("#")) {
				return "";
			}
			// For other links, keep just the link text
			return linkText;
		}
	);

	// Clean up extra spaces and trim
	result.text = result.text.replace(/\s+/g, " ").trim();

	return result;
}

/**
 * Categorizes a bullet point based on its commit type.
 *
 * @param {Object} bullet - Parsed bullet point
 * @returns {string|null} Category name: "feature", "bugfix", "breaking", "misc", or null
 */
function categorizeBulletPoint(bullet) {
	if (!bullet.commitType) {
		return null;
	}

	const type = bullet.commitType.toLowerCase();

	// Check for breaking changes (indicated by ! in conventional commits, e.g., feat!:, fix!:)
	if (type.includes("!") || bullet.text.toLowerCase().includes("breaking")) {
		return "breaking";
	}

	// Map commit types to categories
	switch (type) {
		case "feat":
			return "feature";
		case "fix":
			return "bugfix";
		default:
			// Other types (docs, style, refactor, perf, test, build, ci, chore, revert)
			// go to miscellaneous
			return "misc";
	}
}

/**
 * Extracts all commit hashes from a version section.
 *
 * @param {string[]} contentLines - All content lines for this version
 * @returns {Set<string>} Set of commit hashes found in the version
 */
function extractCommitHashes(contentLines) {
	const commitHashes = new Set();
	const commitHashPattern = /\[([a-f0-9]{7,})\]/gi;

	for (const line of contentLines) {
		let match;
		while ((match = commitHashPattern.exec(line)) !== null) {
			commitHashes.add(match[1]);
		}
	}

	return commitHashes;
}

/**
 * Parses version content by extracting all commit hashes, fetching their bodies,
 * and compiling all bullet points into categorized lists.
 *
 * @param {string[]} contentLines - All content lines for this version
 * @param {string[]} sectionLines - All lines including header
 * @param {string} version - Version number
 * @returns {Object} Parsed version data
 */
function parseVersionContent(contentLines, sectionLines, version) {
	const contentText = contentLines.join("\n");
	const sectionText = sectionLines.join("\n");

	const features = [];
	const bugFixes = [];
	const breakingChanges = [];
	const miscellaneous = [];

	// Extract all commit hashes from the version section
	const commitHashes = extractCommitHashes(contentLines);
	logger.debug(
		`Found ${
			commitHashes.size
		} commit hash(es) in version ${version}: ${Array.from(commitHashes).join(
			", "
		)}`
	);

	// Fetch and parse all commit bodies
	for (const commitHash of commitHashes) {
		const commitBody = fetchCommitBody(commitHash);
		if (!commitBody) {
			continue;
		}

		// Parse all bullet points from this commit body
		for (const bodyBullet of commitBody.bulletPoints) {
			const category = categorizeBulletPoint(bodyBullet);
			if (category === "feature") {
				features.push(bodyBullet);
			} else if (category === "bugfix") {
				bugFixes.push(bodyBullet);
			} else if (category === "breaking") {
				breakingChanges.push(bodyBullet);
			} else {
				// If category is null or "misc", add to miscellaneous
				// (null means no commit type prefix, which should go to misc)
				miscellaneous.push(bodyBullet);
			}
		}
	}

	return {
		version,
		content: contentText,
		fullSection: sectionText,
		features,
		bugFixes,
		breakingChanges,
		miscellaneous,
	};
}

/**
 * Parses a changelog file and returns structured version sections.
 *
 * @param {string} filePath - Path to the changelog file
 * @returns {Object[]} Array of parsed version sections
 */
function parseChangelog(filePath) {
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split(/\r?\n/);

	const versions = [];
	let currentVersion = null;
	let currentContent = [];
	let currentSection = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Check if this is a version header (## [version] or ## version)
		const versionMatch = line.match(/^##\s+(?:\[([^\]]+)\]|([^\s(]+))/);

		if (versionMatch) {
			// Save previous version if exists
			if (currentVersion !== null) {
				const parsed = parseVersionContent(
					currentContent,
					currentSection,
					currentVersion
				);
				versions.push(parsed);
			}

			// Start new version
			const version = versionMatch[1] || versionMatch[2];
			currentVersion = version;
			currentContent = [];
			currentSection = [line];
		} else if (currentVersion !== null) {
			// Add line to current version's content
			currentContent.push(line);
			currentSection.push(line);
		}
	}

	// Don't forget the last version
	if (currentVersion !== null) {
		const parsed = parseVersionContent(
			currentContent,
			currentSection,
			currentVersion
		);
		versions.push(parsed);
	}

	return versions;
}

/**
 * Replaces non-ASCII characters with a pound symbol.
 *
 * @param {string} text - Text to sanitize
 * @returns {string} Text with non-ASCII characters replaced with #
 */
function replaceNonAscii(text) {
	return text.replace(/[^\x00-\x7F]/g, "#");
}

/**
 * Formats a parsed bullet point for display in the board message.
 *
 * @param {Object} bullet - Parsed bullet point
 * @returns {string} Formatted string
 */
function formatBulletPoint(bullet) {
	let formatted = replaceNonAscii(bullet.text);

	// Add prefix tag if present
	if (bullet.prefixTag) {
		formatted = `[${bullet.prefixTag}] ${formatted}`;
	}

	return formatted;
}

/**
 * Formats a parsed version into a board message content string.
 *
 * @param {Object} version - Parsed version data
 * @returns {string[]} Formatted content string
 */
function formatVersionContent(version) {
	const lines = [];

	// Add breaking changes first (if any)
	if (version.breakingChanges.length > 0) {
		lines.push(color("BREAKING CHANGES:", COLOR.CRIMSON));
		for (const change of version.breakingChanges) {
			lines.push(...myformat(change, COLOR.CRIMSON, COLOR.MAROON));
		}
	}

	// Add features
	if (version.features.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(color("Features:", COLOR.YELLOW));
		for (const feature of version.features) {
			lines.push(...myformat(feature, COLOR.YELLOW, COLOR.OLIVE));
		}
	}

	// Add bug fixes
	if (version.bugFixes.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(color("Bug Fixes:", COLOR.LIME));
		for (const fix of version.bugFixes) {
			lines.push(...myformat(fix, COLOR.LIME, COLOR.DARK_GREEN));
		}
	}

	// Add miscellaneous
	if (version.miscellaneous.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(color("Miscellaneous:", COLOR.CYAN));
		for (const misc of version.miscellaneous) {
			lines.push(...myformat(misc, COLOR.CYAN, COLOR.TEAL));
		}
	}

	return lines;
}

/**
 * Formats a bullet point with wrapping.
 *
 * @param {Object} point - Parsed bullet point
 * @param {number} bulletColor - Color for the bullet
 * @param {number} textColor - Color for the text
 * @returns {string[]} Formatted lines
 */
function myformat(point, bulletColor, textColor) {
	return string.wrap({
		string: `${color(" *", bulletColor)} ${color(
			formatBulletPoint(point),
			textColor
		)}`,
		width: 72,
		sizer: SIZER,
		prefix: "   ",
		color: (str) => color(str, textColor),
	});
}

/**
 * Parses the CHANGELOG.md file to extract all versions.
 *
 * @returns {Promise<Object[]>} Array of parsed version entries, ordered from newest to oldest
 */
async function parseAllChangelogVersions() {
	try {
		const versions = parseChangelog(CHANGELOG_PATH);
		if (versions.length === 0) {
			logger.warn("No version headers found in CHANGELOG.md");
			return [];
		}
		return versions;
	} catch (error) {
		logger.error(`Failed to parse CHANGELOG.md: ${error}`);
		return [];
	}
}

/**
 * Posts all unposted changelog entries to the changes board.
 * Posts versions from oldest to newest, stopping when it finds a version that's already posted.
 */
async function postChangelogToBoard() {
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
				.filter((v) => v !== null)
		);

		// Post all unposted versions, starting from oldest (reverse order)
		let postedCount = 0;
		for (const versionData of [...versions].reverse()) {
			if (postedVersions.has(versionData.version)) {
				logger.info(`Version ${versionData.version} already posted, skipping`);
				continue;
			}

			const versionSubject = `Version ${versionData.version}`;
			// Format the version content using parsed data
			const formattedContent = formatVersionContent(versionData);
			// Normalize line endings: replace multiple consecutive line breaks with single \n
			const normalizedContent = formattedContent.join(LINEBREAK);
			// Create the message
			board.createMessage(SYSTEM_AUTHOR, versionSubject, normalizedContent);
			postedCount++;

			logger.info(
				`Posted changelog for version ${versionData.version} to changes board`
			);
		}

		if (postedCount > 0) {
			// Save the board after posting all new versions
			await board.save();
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

export {
	postChangelogToBoard,
	parseAllChangelogVersions,
	parseChangelog,
	parseBulletPoint,
	fetchCommitBody,
	formatVersionContent,
};
