#!/usr/bin/env node
/**
 * Post-commit check: ensure each non-empty line in the commit body
 * starts with a conventional-commit type prefix (e.g., "feat:", "fix:", etc.).
 *
 * Notes:
 * - Title (first line) is ignored; checks begin after the first blank line.
 * - Lines that are purely whitespace are ignored.
 * - This is a post-commit hook: it won't prevent the commit, but it will
 *   exit non-zero and print guidance if violations are found.
 */
import { execSync } from "node:child_process";

function getLastCommitMessage() {
	try {
		const out = execSync("git log -1 --pretty=%B", { encoding: "utf-8" });
		return out.replace(/\r\n/g, "\n");
	} catch {
		return "";
	}
}

const allowed = [
	"feat",
	"fix",
	"refactor",
	"test",
	"chore",
	"docs",
	"perf",
	"build",
	"ci",
	"style",
	"revert",
];
const prefixRe = new RegExp(`^(${allowed.join("|")}):\\s`);

const message = getLastCommitMessage();
const lines = message.split("\n");

// Find index of the first blank line after title; body starts after it.
let bodyStart = 0;
for (let i = 0; i < lines.length; i++) {
	if (i === 0) continue;
	if (lines[i].trim() === "") {
		bodyStart = i + 1;
		break;
	}
}

const violations = [];
for (let i = bodyStart; i < lines.length; i++) {
	const line = lines[i];
	if (line.trim() === "") continue;
	if (!prefixRe.test(line)) {
		violations.push({ lineNo: i + 1, line });
	}
}

if (violations.length > 0) {
	console.error("post-commit: commit body includes lines without a conventional-commit prefix:");
	for (const v of violations) {
		console.error(`  line ${v.lineNo}: ${v.line}`);
	}
	console.error(
		`Allowed prefixes are: ${allowed.map((t) => `${t}:`).join(", ")}`
	);
	console.error("Tip: amend the commit with `git commit --amend` to fix the body prefixes.");
	process.exit(1);
}

