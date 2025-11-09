import { test, suite } from "node:test";
import assert from "node:assert";
import { COLOR, COLOR_TAG, colorToTag } from "./color.js";
import {
	CHANNEL,
	CHANNELS,
	CHANNEL_INFO,
	formatChannelMessage,
} from "./channel.js";

suite("channel.ts", () => {
	suite("COLOR_TAG constant", () => {
		test("should have dark color tag values", () => {
			assert.strictEqual(COLOR_TAG[COLOR.BLACK], "k");
			assert.strictEqual(COLOR_TAG[COLOR.MAROON], "r");
			assert.strictEqual(COLOR_TAG[COLOR.DARK_GREEN], "g");
			assert.strictEqual(COLOR_TAG[COLOR.OLIVE], "y");
			assert.strictEqual(COLOR_TAG[COLOR.DARK_BLUE], "b");
			assert.strictEqual(COLOR_TAG[COLOR.PURPLE], "m");
			assert.strictEqual(COLOR_TAG[COLOR.TEAL], "c");
			assert.strictEqual(COLOR_TAG[COLOR.SILVER], "w");
		});

		test("should have bright color tag values", () => {
			assert.strictEqual(COLOR_TAG[COLOR.GREY], "K");
			assert.strictEqual(COLOR_TAG[COLOR.CRIMSON], "R");
			assert.strictEqual(COLOR_TAG[COLOR.LIME], "G");
			assert.strictEqual(COLOR_TAG[COLOR.YELLOW], "Y");
			assert.strictEqual(COLOR_TAG[COLOR.LIGHT_BLUE], "B");
			assert.strictEqual(COLOR_TAG[COLOR.PINK], "M");
			assert.strictEqual(COLOR_TAG[COLOR.CYAN], "C");
			assert.strictEqual(COLOR_TAG[COLOR.WHITE], "W");
		});
	});

	suite("COLOR enum", () => {
		test("should have numeric dark color values", () => {
			assert.strictEqual(COLOR.BLACK, 0);
			assert.strictEqual(COLOR.MAROON, 1);
			assert.strictEqual(COLOR.DARK_GREEN, 2);
			assert.strictEqual(COLOR.OLIVE, 3);
			assert.strictEqual(COLOR.DARK_BLUE, 4);
			assert.strictEqual(COLOR.PURPLE, 5);
			assert.strictEqual(COLOR.TEAL, 6);
			assert.strictEqual(COLOR.SILVER, 7);
		});

		test("should have numeric bright color values", () => {
			assert.strictEqual(COLOR.GREY, 8);
			assert.strictEqual(COLOR.CRIMSON, 9);
			assert.strictEqual(COLOR.LIME, 10);
			assert.strictEqual(COLOR.YELLOW, 11);
			assert.strictEqual(COLOR.LIGHT_BLUE, 12);
			assert.strictEqual(COLOR.PINK, 13);
			assert.strictEqual(COLOR.CYAN, 14);
			assert.strictEqual(COLOR.WHITE, 15);
		});
	});

	suite("colorToTag()", () => {
		test("should convert dark colors to tags", () => {
			assert.strictEqual(colorToTag(COLOR.MAROON), "{r");
			assert.strictEqual(colorToTag(COLOR.DARK_GREEN), "{g");
			assert.strictEqual(colorToTag(COLOR.OLIVE), "{y");
		});

		test("should convert bright colors to tags", () => {
			assert.strictEqual(colorToTag(COLOR.CRIMSON), "{R");
			assert.strictEqual(colorToTag(COLOR.LIME), "{G");
			assert.strictEqual(colorToTag(COLOR.YELLOW), "{Y");
			assert.strictEqual(colorToTag(COLOR.CYAN), "{C");
			assert.strictEqual(colorToTag(COLOR.WHITE), "{W");
		});
	});

	suite("CHANNEL enum", () => {
		test("should have all expected channels", () => {
			assert.strictEqual(CHANNEL.OOC, "OOC");
			assert.strictEqual(CHANNEL.NEWBIE, "NEWBIE");
			assert.strictEqual(CHANNEL.TRADE, "TRADE");
			assert.strictEqual(CHANNEL.GOSSIP, "GOSSIP");
			assert.strictEqual(CHANNEL.SAY, "SAY");
			assert.strictEqual(CHANNEL.WHISPER, "WHISPER");
		});
	});

	suite("CHANNELS array", () => {
		test("should contain all channel values", () => {
			assert.strictEqual(CHANNELS.length, 6);
			assert.ok(CHANNELS.includes(CHANNEL.OOC));
			assert.ok(CHANNELS.includes(CHANNEL.NEWBIE));
			assert.ok(CHANNELS.includes(CHANNEL.TRADE));
			assert.ok(CHANNELS.includes(CHANNEL.GOSSIP));
			assert.ok(CHANNELS.includes(CHANNEL.SAY));
			assert.ok(CHANNELS.includes(CHANNEL.WHISPER));
		});
	});

	suite("CHANNEL_INFO", () => {
		test("should have configuration for all channels", () => {
			assert.ok(CHANNEL_INFO[CHANNEL.OOC]);
			assert.ok(CHANNEL_INFO[CHANNEL.NEWBIE]);
			assert.ok(CHANNEL_INFO[CHANNEL.TRADE]);
			assert.ok(CHANNEL_INFO[CHANNEL.GOSSIP]);
		});

		test("OOC should have correct configuration", () => {
			const ooc = CHANNEL_INFO[CHANNEL.OOC];
			assert.strictEqual(ooc.channelName, "Out of Character");
			assert.strictEqual(ooc.channelTag, "OOC");
			assert.strictEqual(ooc.primaryColor, COLOR.CYAN);
			assert.strictEqual(ooc.highlightColor, COLOR.WHITE);
		});

		test("NEWBIE should have correct configuration", () => {
			const newbie = CHANNEL_INFO[CHANNEL.NEWBIE];
			assert.strictEqual(newbie.channelName, "Newbie Help");
			assert.strictEqual(newbie.channelTag, "NEWBIE");
			assert.strictEqual(newbie.primaryColor, COLOR.LIME);
			assert.strictEqual(newbie.highlightColor, COLOR.YELLOW);
		});

		test("TRADE should have correct configuration", () => {
			const trade = CHANNEL_INFO[CHANNEL.TRADE];
			assert.strictEqual(trade.channelName, "Trading");
			assert.strictEqual(trade.channelTag, "TRADE");
			assert.strictEqual(trade.primaryColor, COLOR.OLIVE);
			assert.strictEqual(trade.highlightColor, COLOR.YELLOW);
		});

		test("GOSSIP should have correct configuration", () => {
			const gossip = CHANNEL_INFO[CHANNEL.GOSSIP];
			assert.strictEqual(gossip.channelName, "Gossip");
			assert.strictEqual(gossip.channelTag, "GOSSIP");
			assert.strictEqual(gossip.primaryColor, COLOR.LIME);
			assert.strictEqual(gossip.highlightColor, COLOR.WHITE);
		});
	});

	suite("formatChannelMessage()", () => {
		test("should format OOC message with correct colors", () => {
			const result = formatChannelMessage(
				CHANNEL.OOC,
				"Alice",
				"Hello everyone!"
			);
			assert.strictEqual(result, "{C[OOC] {WAlice{C: {WHello everyone!{x");
		});

		test("should format NEWBIE message with correct colors", () => {
			const result = formatChannelMessage(
				CHANNEL.NEWBIE,
				"Bob",
				"How do I start?"
			);
			assert.strictEqual(result, "{G[NEWBIE] {YBob{G: {YHow do I start?{x");
		});

		test("should format TRADE message with correct colors", () => {
			const result = formatChannelMessage(
				CHANNEL.TRADE,
				"Charlie",
				"Selling sword!"
			);
			assert.strictEqual(result, "{y[TRADE] {YCharlie{y: {YSelling sword!{x");
		});

		test("should format GOSSIP message with correct colors", () => {
			const result = formatChannelMessage(
				CHANNEL.GOSSIP,
				"Diana",
				"Did you hear?"
			);
			assert.strictEqual(result, "{G[GOSSIP] {WDiana{G: {WDid you hear?{x");
		});

		test("should handle empty messages", () => {
			const result = formatChannelMessage(CHANNEL.OOC, "User", "");
			assert.strictEqual(result, "{C[OOC] {WUser{C: {W{x");
		});

		test("should handle messages with color codes", () => {
			const result = formatChannelMessage(
				CHANNEL.OOC,
				"User",
				"{RRed text{x here"
			);
			assert.strictEqual(result, "{C[OOC] {WUser{C: {W{RRed text{x here{x");
		});
	});
});
