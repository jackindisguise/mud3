# Changelog

## [1.17.0](https://github.com/jackindisguise/mud3/compare/v1.16.0...v1.17.0) (2025-11-21)


### Features

* dungedit now properly supports macOS .app generation ([e69d292](https://github.com/jackindisguise/mud3/commit/e69d292f065635cda134c9289770c97949475623))

## [1.16.0](https://github.com/jackindisguise/mud3/compare/v1.15.0...v1.16.0) (2025-11-21)


### Features

* add portable electron build tooling ([cabac0b](https://github.com/jackindisguise/mud3/commit/cabac0b39926aae1e4d7ae9cbd00dc61bb19015d))
* add post-processing for electron builds ([f48dbd3](https://github.com/jackindisguise/mud3/commit/f48dbd3a773b8726126ab64f1535897fded81a9f))
* added a map editor service plus HTTP and electron entrypoints that expose dungeon CRUD, race/job/hit-type data, attribute calculations, and safe portable paths. ([1023dae](https://github.com/jackindisguise/mud3/commit/1023dae9161ee076739472a2ba9483111a0eeb60))
* added electron-builder config, icon pipeline, and assets ([cabac0b](https://github.com/jackindisguise/mud3/commit/cabac0b39926aae1e4d7ae9cbd00dc61bb19015d))
* added line and grouped edge selection buttons in toolbox ([66fe7b9](https://github.com/jackindisguise/mud3/commit/66fe7b98afc21bfd695eaf66db7f62f98428c955))
* added post build steps for win/mac portable artifacts ([f48dbd3](https://github.com/jackindisguise/mud3/commit/f48dbd3a773b8726126ab64f1535897fded81a9f))
* adjusted `jsyaml.dump` flow level to preserve the new row formatting when saving from the editor. ([f5b21e0](https://github.com/jackindisguise/mud3/commit/f5b21e0420c2bf3e2a8f2e8bc3fd866ac2341cd0))
* aligned sidebar tabs with the toolbox bar using shared toolbar sizing vars. ([f1bc940](https://github.com/jackindisguise/mud3/commit/f1bc940bca32e895332a473b40a3080e2bc30fd1))
* bundled the in-repo dungeon map editor UI with new selection tools, placement modes, undo/redo history, template modals, and richer help/toast UX. ([1023dae](https://github.com/jackindisguise/mud3/commit/1023dae9161ee076739472a2ba9483111a0eeb60))
* enforced a local js-yaml bundle plus CSP so the electron renderer avoids external scripts and warnings. ([f1bc940](https://github.com/jackindisguise/mud3/commit/f1bc940bca32e895332a473b40a3080e2bc30fd1))
* extended dungeon serialization, data packages, and specs to persist dungeon metadata, improve templates, and broaden serializer/template/location coverage. ([1023dae](https://github.com/jackindisguise/mud3/commit/1023dae9161ee076739472a2ba9483111a0eeb60))
* format dungeon grid rows ([f5b21e0](https://github.com/jackindisguise/mud3/commit/f5b21e0420c2bf3e2a8f2e8bc3fd866ac2341cd0))
* integrate map editor and tooling ([1023dae](https://github.com/jackindisguise/mud3/commit/1023dae9161ee076739472a2ba9483111a0eeb60))
* moved template action buttons under descriptions for clarity ([6118ebb](https://github.com/jackindisguise/mud3/commit/6118ebbcaf01c52aea656ea5231d94d4efee2fc2))
* ordered dungeon YAML serialization to keep core fields readable and deterministic. ([f1bc940](https://github.com/jackindisguise/mud3/commit/f1bc940bca32e895332a473b40a3080e2bc30fd1))
* polish template and reset controls ([6118ebb](https://github.com/jackindisguise/mud3/commit/6118ebbcaf01c52aea656ea5231d94d4efee2fc2))
* reformatted `data/dungeons/tower.yaml` so each grid row renders as a single inline array. ([f5b21e0](https://github.com/jackindisguise/mud3/commit/f5b21e0420c2bf3e2a8f2e8bc3fd866ac2341cd0))
* refreshed map editor frontend bundle and package data modules for new build ([cabac0b](https://github.com/jackindisguise/mud3/commit/cabac0b39926aae1e4d7ae9cbd00dc61bb19015d))
* restyled reset list cards and icons to match template panel ([6118ebb](https://github.com/jackindisguise/mud3/commit/6118ebbcaf01c52aea656ea5231d94d4efee2fc2))
* tighten map editor security ([f1bc940](https://github.com/jackindisguise/mud3/commit/f1bc940bca32e895332a473b40a3080e2bc30fd1))
* updated electron bootstrap, services, and logger to use safe paths and structured renderer logging ([cabac0b](https://github.com/jackindisguise/mud3/commit/cabac0b39926aae1e4d7ae9cbd00dc61bb19015d))


### Bug Fixes

* ensured toast stack respects toolbox and placement indicator bounds ([6118ebb](https://github.com/jackindisguise/mud3/commit/6118ebbcaf01c52aea656ea5231d94d4efee2fc2))
* improve selection tools behavior and ui ([66fe7b9](https://github.com/jackindisguise/mud3/commit/66fe7b98afc21bfd695eaf66db7f62f98428c955))
* kept selection tool active when placing templates on selections ([66fe7b9](https://github.com/jackindisguise/mud3/commit/66fe7b98afc21bfd695eaf66db7f62f98428c955))
* returned early to skip template selection toggling after bulk placement ([66fe7b9](https://github.com/jackindisguise/mud3/commit/66fe7b98afc21bfd695eaf66db7f62f98428c955))

## [1.15.0](https://github.com/jackindisguise/mud3/compare/v1.14.0...v1.15.0) (2025-11-20)


### Features

* added combat movement restrictions and minimap improvements ([5b2ae51](https://github.com/jackindisguise/mud3/commit/5b2ae51a5b2464154756cf4996462c8db61f01f0))
* added debug logging setup script for map editor development ([27b083f](https://github.com/jackindisguise/mud3/commit/27b083ffcc583fa65d655c53f6ff11063d300a0e))
* added flee command for escaping combat ([2cd5828](https://github.com/jackindisguise/mud3/commit/2cd5828100a49e8dcbf24817dafdaa17d5605f9d))
* added flee command with 5-second cooldown that allows players to attempt escape from combat ([2cd5828](https://github.com/jackindisguise/mud3/commit/2cd5828100a49e8dcbf24817dafdaa17d5605f9d))
* added generateMinimapFromSteps function that respects portals and room links ([5b2ae51](https://github.com/jackindisguise/mud3/commit/5b2ae51a5b2464154756cf4996462c8db61f01f0))
* added map editor frontend with HTML, CSS, and JavaScript ([27b083f](https://github.com/jackindisguise/mud3/commit/27b083ffcc583fa65d655c53f6ff11063d300a0e))
* added map editor HTTP server with API endpoints for dungeon management ([27b083f](https://github.com/jackindisguise/mud3/commit/27b083ffcc583fa65d655c53f6ff11063d300a0e))
* added start script for map editor server ([27b083f](https://github.com/jackindisguise/mud3/commit/27b083ffcc583fa65d655c53f6ff11063d300a0e))
* added vision blocking for dense rooms in minimap generation ([5b2ae51](https://github.com/jackindisguise/mud3/commit/5b2ae51a5b2464154756cf4996462c8db61f01f0))
* added web-based map editor for dungeon editing ([27b083f](https://github.com/jackindisguise/mud3/commit/27b083ffcc583fa65d655c53f6ff11063d300a0e))
* disabled movement commands when player is in combat ([5b2ae51](https://github.com/jackindisguise/mud3/commit/5b2ae51a5b2464154756cf4996462c8db61f01f0))
* flee command bypasses combat movement restriction by calling actor.step() directly ([2cd5828](https://github.com/jackindisguise/mud3/commit/2cd5828100a49e8dcbf24817dafdaa17d5605f9d))
* flee command can only be used when player is in combat ([2cd5828](https://github.com/jackindisguise/mud3/commit/2cd5828100a49e8dcbf24817dafdaa17d5605f9d))
* flee command has 33% chance of failure with act message ([2cd5828](https://github.com/jackindisguise/mud3/commit/2cd5828100a49e8dcbf24817dafdaa17d5605f9d))
* flee command sends act message when player successfully flees to a random direction ([2cd5828](https://github.com/jackindisguise/mud3/commit/2cd5828100a49e8dcbf24817dafdaa17d5605f9d))
* updated look command to use new minimap generation function ([5b2ae51](https://github.com/jackindisguise/mud3/commit/5b2ae51a5b2464154756cf4996462c8db61f01f0))

## [1.14.0](https://github.com/jackindisguise/mud3/compare/v1.13.0...v1.14.0) (2025-11-19)


### Features

* added BEHAVIOR enum and behavior dictionary to Mob class ([377374e](https://github.com/jackindisguise/mud3/commit/377374eb5afb2012d860e371ca5b325cba7cc99d))
* added BEHAVIOR_SYSTEM.md documentation for map editor integration ([377374e](https://github.com/jackindisguise/mud3/commit/377374eb5afb2012d860e371ca5b325cba7cc99d))
* added behavior.ts module with processAggressiveBehavior, processWimpyBehavior, and processWanderBehavior functions ([377374e](https://github.com/jackindisguise/mud3/commit/377374eb5afb2012d860e371ca5b325cba7cc99d))
* added checkAggressiveBehaviorInRoom function to check for targets after wandering ([c969167](https://github.com/jackindisguise/mud3/commit/c969167b6fee6b6a33114cbd4351e093699ab7c6))
* added getNextObjectIdSync() function for synchronous OID generation ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* added getNextObjectIdSync() function for synchronous OID generation ([87da35c](https://github.com/jackindisguise/mud3/commit/87da35c713905c1e1a037f08847385c8c3769d2a))
* added GOCIAL channel for global social communication ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* added gocial command for global social messages ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* added initial wander cycle after dungeon load before starting timer ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* added mob behavior system with aggressive, wimpy, and wander behaviors ([377374e](https://github.com/jackindisguise/mud3/commit/377374eb5afb2012d860e371ca5b325cba7cc99d))
* added nextObjectId counter to gamestate package ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* added nextObjectId counter to gamestate package ([87da35c](https://github.com/jackindisguise/mud3/commit/87da35c713905c1e1a037f08847385c8c3769d2a))
* added object ID (OID) system for dungeon objects ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* added object ID (OID) system for dungeon objects ([87da35c](https://github.com/jackindisguise/mud3/commit/87da35c713905c1e1a037f08847385c8c3769d2a))
* added oid property to DungeonObject class ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* added oid property to DungeonObject class ([87da35c](https://github.com/jackindisguise/mud3/commit/87da35c713905c1e1a037f08847385c8c3769d2a))
* added onStep event hook to Movable class for post-movement behavior ([377374e](https://github.com/jackindisguise/mud3/commit/377374eb5afb2012d860e371ca5b325cba7cc99d))
* added recall command to teleport players to recall location ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* added wander behavior timer in game.ts (30 second interval) ([377374e](https://github.com/jackindisguise/mud3/commit/377374eb5afb2012d860e371ca5b325cba7cc99d))
* added WANDERING_MOBS cache for efficient wander behavior processing ([377374e](https://github.com/jackindisguise/mud3/commit/377374eb5afb2012d860e371ca5b325cba7cc99d))
* centralized social commands in social.ts module with auto-generation ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* created locations package with YAML config for game locations ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* created reserved names package for blocking inappropriate/IP names ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* implemented aggressive behavior processing in room.onEnter and mob.onStep ([377374e](https://github.com/jackindisguise/mud3/commit/377374eb5afb2012d860e371ca5b325cba7cc99d))
* implemented name blocking system during character creation ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* made oid optional in SerializedDungeonObject (present for instances, absent for templates) ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* made oid optional in SerializedDungeonObject (present for instances, absent for templates) ([87da35c](https://github.com/jackindisguise/mud3/commit/87da35c713905c1e1a037f08847385c8c3769d2a))
* updated compression logic to handle optional oid ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* updated compression logic to handle optional oid ([87da35c](https://github.com/jackindisguise/mud3/commit/87da35c713905c1e1a037f08847385c8c3769d2a))
* updated toTemplate() to exclude oid from templates ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* updated toTemplate() to exclude oid from templates ([87da35c](https://github.com/jackindisguise/mud3/commit/87da35c713905c1e1a037f08847385c8c3769d2a))


### Bug Fixes

* fixed location validation to re-throw errors instead of treating them as file read errors ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* fixed locations.spec.ts to use Room class directly in instanceof checks ([c162c29](https://github.com/jackindisguise/mud3/commit/c162c2901a8fbc8ef11e8a6c3fc53f5fefdae7b3))
* updated all manually created serialized objects in tests to include oid ([f2e0f1e](https://github.com/jackindisguise/mud3/commit/f2e0f1e22deb2935c42d566ec38c66c9c96279c1))
* updated all manually created serialized objects in tests to include oid ([87da35c](https://github.com/jackindisguise/mud3/commit/87da35c713905c1e1a037f08847385c8c3769d2a))

## [1.13.0](https://github.com/jackindisguise/mud3/compare/v1.12.0...v1.13.0) (2025-11-19)


### Features

* added cross-dungeon template reference in tower reset to neo-tokyo bubblegum-cannon ([6a5ec61](https://github.com/jackindisguise/mud3/commit/6a5ec6171485e1fcf204a9884d4b40e99d7f107d))
* added EquipmentTemplate, ArmorTemplate, and WeaponTemplate interfaces ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))
* added equipped and inventory arrays to Reset class for mob spawning ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))
* added equipped and inventory fields to mob resets ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))
* added neo-tokyo dungeon and cross-dungeon template reference in tower ([6a5ec61](https://github.com/jackindisguise/mud3/commit/6a5ec6171485e1fcf204a9884d4b40e99d7f107d))
* added neo-tokyo dungeon with bubblegum-cannon weapon template ([6a5ec61](https://github.com/jackindisguise/mud3/commit/6a5ec6171485e1fcf204a9884d4b40e99d7f107d))
* added unit tests for reset equipped and inventory functionality ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))
* **character:** added default prompt showing health, mana, exhaustion, xp, and tnl with light colors ([1d8f6eb](https://github.com/jackindisguise/mud3/commit/1d8f6eb2de47ddb9193cd085128b5dd8b8e9ac32))
* **character:** set default prompt with colored stats display ([1d8f6eb](https://github.com/jackindisguise/mud3/commit/1d8f6eb2de47ddb9193cd085128b5dd8b8e9ac32))
* updated applyTemplate methods to accept specific template types ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))
* updated createFromTemplate to use template-specific properties for equipment ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))
* updated reset deserialization to restore equipped and inventory arrays ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))
* updated reset serialization to include equipped and inventory template IDs ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))


### Bug Fixes

* corrected resolveTemplateById() to use globalized template IDs for lookups ([2de0287](https://github.com/jackindisguise/mud3/commit/2de0287e290a3c93ec6428d62dea48cddf33ac55))
* **dungeon:** added null, undefined, and NaN checks for template indices ([acc1047](https://github.com/jackindisguise/mud3/commit/acc104793b4c6fba2863ff73d9ef13bdc9a59522))
* **dungeon:** convert template index to number before arithmetic operations ([acc1047](https://github.com/jackindisguise/mud3/commit/acc104793b4c6fba2863ff73d9ef13bdc9a59522))
* **game:** replaced UTF-8 bullet character with asterisk in board message notifications ([55bcda4](https://github.com/jackindisguise/mud3/commit/55bcda49cdca1e320564e3fe44d8182bb3505884))
* **game:** use asterisk instead of UTF-8 bullet for telnet compatibility ([55bcda4](https://github.com/jackindisguise/mud3/commit/55bcda49cdca1e320564e3fe44d8182bb3505884))
* handle null/undefined values in dungeon grid during load ([211f66a](https://github.com/jackindisguise/mud3/commit/211f66a7b391011cd66d694bb095f8e76a7b29b6))
* **package:** improve template index validation in dungeon loading ([acc1047](https://github.com/jackindisguise/mud3/commit/acc104793b4c6fba2863ff73d9ef13bdc9a59522))
* updated character.spec.ts test for DEFAULT_PLAYER_SETTINGS prompt value ([eba8338](https://github.com/jackindisguise/mud3/commit/eba8338a07fa0017fb79fc84fd25ca2e01019d4b))
* updated cross-dungeon template resolution in Reset.execute() to use resolveTemplateById() ([2de0287](https://github.com/jackindisguise/mud3/commit/2de0287e290a3c93ec6428d62dea48cddf33ac55))

## [1.12.0](https://github.com/jackindisguise/mud3/compare/v1.11.0...v1.12.0) (2025-11-18)


### Features

* add pure JavaScript version of post-changelog-to-board script ([7ee30fd](https://github.com/jackindisguise/mud3/commit/7ee30fd7a205f0812f33f6ce342bc1adbf3fce13))
* arguably feature complete ([dd2a1a3](https://github.com/jackindisguise/mud3/commit/dd2a1a359252c4dbfc074888ef1c3decfce9cf67))
* **combat:** added guaranteedHit option to disable miss chance in oneHit method ([6c1bfc3](https://github.com/jackindisguise/mud3/commit/6c1bfc389941222494a3de7d647431baea19e457))
* **combat:** added OneHitOptions interface with target, weapon, and guaranteedHit options ([6c1bfc3](https://github.com/jackindisguise/mud3/commit/6c1bfc389941222494a3de7d647431baea19e457))
* initial map editor commit ([cdb98ac](https://github.com/jackindisguise/mud3/commit/cdb98ac50989749c061e9502e7b6c7657b80c8cf))
* **map-editor:** added delete room template option with bulldozer icon indicator ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added keyboard shortcuts for layer navigation (PageUp/PageDown, Home/End) ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added localStorage auto-save to prevent data loss on page refresh ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added map editor with placement tools, undo/redo, and auto-save ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added map text and map color fields to templates with visual color selector ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added placement indicator showing selected template and placement mode ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added reset management system for placing mobs and objects in rooms ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added room, mob, and object template editors with full CRUD operations ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added toast notification system for user feedback on actions ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** added visual indicator on save button for unsaved changes ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** created selection toolbox with rectangle, circle, and squircle selection tools ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** created template modal system for editing room, mob, and object properties ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** implemented drag-to-place functionality for drawing across multiple cells ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** implemented grid-based dungeon layout with multi-layer support ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** implemented initial map editor with dungeon grid visualization and template management ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** implemented insert and paint placement modes for rooms ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** implemented multi-cell selection with delete key support ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** implemented restore functionality for unsaved work with user prompt ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** implemented room description field for rooms ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** implemented undo/redo system with Ctrl+Z and Ctrl+Y shortcuts ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* more features ([ca61d3f](https://github.com/jackindisguise/mud3/commit/ca61d3faafbc1e0e570cc7c5107523ad67592c24))
* **pathfinding:** added getCachedPathResult function to retrieve full cached path results ([6c1bfc3](https://github.com/jackindisguise/mud3/commit/6c1bfc389941222494a3de7d647431baea19e457))
* **scripts:** created pure JavaScript version of post-changelog-to-board in scripts directory ([7ee30fd](https://github.com/jackindisguise/mud3/commit/7ee30fd7a205f0812f33f6ce342bc1adbf3fce13))


### Bug Fixes

* **map-editor:** added proper event listener cleanup for reset edit modal ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** corrected template index 0 selection bug ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** corrected toast message positioning and stacking behavior ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** fixed PageUp/PageDown layer navigation direction ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** fixed reset tab edit and delete button functionality ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** prevented duplicate cell processing during drag operations ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** replaced all alert() calls with toast notifications ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))
* **map-editor:** resolved mob template editor close issue when opened first ([e5d83fb](https://github.com/jackindisguise/mud3/commit/e5d83fb4934b4b3322d911bdb8ce10522a11507c))

## [1.11.0](https://github.com/jackindisguise/mud3/compare/v1.10.0...v1.11.0) (2025-11-17)


### Features

* **combat:** add damageMessage function with HP percentage display ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **combat:** add experience gain on mob death ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **combat:** added experience gain to handleDeath function ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **combat:** added HP percentage suffix to user and target messages (not room messages) ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **combat:** created damageMessage function that wraps act() to inject HP percentage ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **combat:** experience messages sent to killer ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **combat:** only players gain experience from kills ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **commands:** add levelup command ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **commands:** created levelup command that grants one level's worth of experience (100 XP) ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* **commands:** shows level up message if threshold reached ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))
* refactor combat system and add experience/leveling features ([b8b96e6](https://github.com/jackindisguise/mud3/commit/b8b96e64e1a3841bbf0daec292196fee03f419bc))


### Bug Fixes

* **attribute:** updated createPrimaryAttributesView to handle non-finite values ([105a371](https://github.com/jackindisguise/mud3/commit/105a371e9a5e35847048841ebc53d8bb4883f056))
* **attribute:** updated createResourceCapsView to handle non-finite values ([105a371](https://github.com/jackindisguise/mud3/commit/105a371e9a5e35847048841ebc53d8bb4883f056))
* **attribute:** updated createSecondaryAttributesView to handle non-finite values ([105a371](https://github.com/jackindisguise/mud3/commit/105a371e9a5e35847048841ebc53d8bb4883f056))

## [1.10.0](https://github.com/jackindisguise/mud3/compare/v1.9.0...v1.10.0) (2025-11-16)


### Features

* **data:** added tiny-a and tiny-b dungeons and linked them (↔ and to tower) ([a4c3992](https://github.com/jackindisguise/mud3/commit/a4c3992063ee3c1518ff90fbe203e2bb4a84bbc3))
* **mob:** applied template-aware compression to mob serializer ([a4c3992](https://github.com/jackindisguise/mud3/commit/a4c3992063ee3c1518ff90fbe203e2bb4a84bbc3))
* **mob:** compressed equipped by omitting slots matching baseline ([a4c3992](https://github.com/jackindisguise/mud3/commit/a4c3992063ee3c1518ff90fbe203e2bb4a84bbc3))
* **pathfinding:** add flat-step APIs, caching, and startup pre-cache ([a4c3992](https://github.com/jackindisguise/mud3/commit/a4c3992063ee3c1518ff90fbe203e2bb4a84bbc3))
* **pathfinding:** added findDirectionsBetweenRooms and findDirectionsViaRefs ([a4c3992](https://github.com/jackindisguise/mud3/commit/a4c3992063ee3c1518ff90fbe203e2bb4a84bbc3))
* **pathfinding:** implemented suffix-based path cache for direction lookups ([a4c3992](https://github.com/jackindisguise/mud3/commit/a4c3992063ee3c1518ff90fbe203e2bb4a84bbc3))
* **startup:** pre-cached gateway-to-gateway paths across all dungeons in index.ts ([a4c3992](https://github.com/jackindisguise/mud3/commit/a4c3992063ee3c1518ff90fbe203e2bb4a84bbc3))


### Performance Improvements

* **pathfinding:** memoized dungeon graph via buildDungeonGraph cache ([a4c3992](https://github.com/jackindisguise/mud3/commit/a4c3992063ee3c1518ff90fbe203e2bb4a84bbc3))

## [1.9.0](https://github.com/jackindisguise/mud3/compare/v1.8.0...v1.9.0) (2025-11-16)


### Features

* accepted local templateId in resets and auto-prefixed with current dungeon id on load ([1ef2415](https://github.com/jackindisguise/mud3/commit/1ef2415d5bbb8f73fffe433653dc920c4840e2f9))
* added shared helpers getCompressionBaseline and compressSerializedObject to centralize diffing ([1ef2415](https://github.com/jackindisguise/mud3/commit/1ef2415d5bbb8f73fffe433653dc920c4840e2f9))
* added templateId to DungeonObject and SerializedDungeonObject for instance-template linkage ([1ef2415](https://github.com/jackindisguise/mud3/commit/1ef2415d5bbb8f73fffe433653dc920c4840e2f9))
* based compression/normalization on template baselines to omit redundant fields ([1ef2415](https://github.com/jackindisguise/mud3/commit/1ef2415d5bbb8f73fffe433653dc920c4840e2f9))
* localized template ids when saving dungeons and globalized them on load ([@dungeon](https://github.com/dungeon):id) ([1ef2415](https://github.com/jackindisguise/mud3/commit/1ef2415d5bbb8f73fffe433653dc920c4840e2f9))
* supported room templates with neutral-coordinate baseline caching for consistent diffs ([1ef2415](https://github.com/jackindisguise/mud3/commit/1ef2415d5bbb8f73fffe433653dc920c4840e2f9))
* template-aware serialization, global template ids, and compression helpers ([1ef2415](https://github.com/jackindisguise/mud3/commit/1ef2415d5bbb8f73fffe433653dc920c4840e2f9))


### Bug Fixes

* omitted templateId in uncompressed output when undefined to match serializer expectations ([1ef2415](https://github.com/jackindisguise/mud3/commit/1ef2415d5bbb8f73fffe433653dc920c4840e2f9))

## [1.8.0](https://github.com/jackindisguise/mud3/compare/v1.7.0...v1.8.0) (2025-11-16)


### Features

* **serialization:** add base+compressed serialization and normalize deserialize\n\n- Add {compress} option and propagate to subclasses\n- Emit base-form keys with undefined for uncompressed\n- Implement compression vs baseSerializedTypes\n- Introduce normalizeSerializedData and integrate into DungeonObject.deserialize ([4f16ad7](https://github.com/jackindisguise/mud3/commit/4f16ad7407e87bd27f9eeea0d9536f1a432e61c6))

## [1.7.0](https://github.com/jackindisguise/mud3/compare/v1.6.0...v1.7.0) (2025-11-15)


### Features

* add action queue visibility and cancellation ([90443ed](https://github.com/jackindisguise/mud3/commit/90443ed0e7131ee319df51a9056f87e6ffc21268))
* add per-character action queue cooldowns ([85af1bd](https://github.com/jackindisguise/mud3/commit/85af1bdadcd305af200e2ff1e5affb88b77e9520))
* added automatic bidirectional link detection - if two rooms link to each other, creates two-way link, otherwise creates one-way link ([a297d26](https://github.com/jackindisguise/mud3/commit/a297d26ac4a7894f6f092ef5575652d9200864ac))
* added cancel and queue commands for action management ([90443ed](https://github.com/jackindisguise/mud3/commit/90443ed0e7131ee319df51a9056f87e6ffc21268))
* added Command.getActionCooldownMs with registry queueing/notifications ([85af1bd](https://github.com/jackindisguise/mud3/commit/85af1bdadcd305af200e2ff1e5affb88b77e9520))
* added comprehensive debug logging to room link processing including per-link processing, bidirectional detection, and summary statistics ([a297d26](https://github.com/jackindisguise/mud3/commit/a297d26ac4a7894f6f092ef5575652d9200864ac))
* added item templates for Materia orbs and potions ([cd749a6](https://github.com/jackindisguise/mud3/commit/cd749a694d8f49dc7d7ea0bd847ab8c7552522e7))
* added NPC templates for Sector 7 residents, shopkeepers, and Mako trains ([cd749a6](https://github.com/jackindisguise/mud3/commit/cd749a694d8f49dc7d7ea0bd847ab8c7552522e7))
* added persistent room links system ([a297d26](https://github.com/jackindisguise/mud3/commit/a297d26ac4a7894f6f092ef5575652d9200864ac))
* added processPendingRoomLinks function that creates RoomLink instances after all dungeons are loaded ([a297d26](https://github.com/jackindisguise/mud3/commit/a297d26ac4a7894f6f092ef5575652d9200864ac))
* added roomLinks field to RoomTemplate interface for storing room links in dungeon files ([a297d26](https://github.com/jackindisguise/mud3/commit/a297d26ac4a7894f6f092ef5575652d9200864ac))
* added Sector 7 dungeon from Final Fantasy 7 ([cd749a6](https://github.com/jackindisguise/mud3/commit/cd749a694d8f49dc7d7ea0bd847ab8c7552522e7))
* added tests covering cancel, queue, and prompt formatting ([90443ed](https://github.com/jackindisguise/mud3/commit/90443ed0e7131ee319df51a9056f87e6ffc21268))
* added upper plate layer accessible via stairs ([cd749a6](https://github.com/jackindisguise/mud3/commit/cd749a694d8f49dc7d7ea0bd847ab8c7552522e7))
* allowed package commands to declare cooldowns and applied defaults to movement plus new work command ([85af1bd](https://github.com/jackindisguise/mud3/commit/85af1bdadcd305af200e2ff1e5affb88b77e9520))
* configured resets for NPCs and items at appropriate locations ([cd749a6](https://github.com/jackindisguise/mud3/commit/cd749a694d8f49dc7d7ea0bd847ab8c7552522e7))
* created sector7.yaml dungeon file with 15x15 slums layer ([cd749a6](https://github.com/jackindisguise/mud3/commit/cd749a694d8f49dc7d7ea0bd847ab8c7552522e7))
* enhanced minimap display with box formatting in look command ([0f56443](https://github.com/jackindisguise/mud3/commit/0f564438e0eea3bccf0aedc864a6cb18a1e2d55d))
* implemented room link loading in loadDungeon to collect roomLinks and defer creation until all dungeons are loaded ([a297d26](https://github.com/jackindisguise/mud3/commit/a297d26ac4a7894f6f092ef5575652d9200864ac))
* implemented room link serialization in saveDungeon to extract links from rooms and save them in templates ([a297d26](https://github.com/jackindisguise/mud3/commit/a297d26ac4a7894f6f092ef5575652d9200864ac))
* implemented room templates for slums, Seventh Heaven bar, train station, pillar, houses, shops, and plate areas ([cd749a6](https://github.com/jackindisguise/mud3/commit/cd749a694d8f49dc7d7ea0bd847ab8c7552522e7))
* improved minimap display and fixed logging issues ([0f56443](https://github.com/jackindisguise/mud3/commit/0f564438e0eea3bccf0aedc864a6cb18a1e2d55d))
* included raw command text in prompts and listing output ([90443ed](https://github.com/jackindisguise/mud3/commit/90443ed0e7131ee319df51a9056f87e6ffc21268))
* moved action state into Character and exposed queue prompt status ([85af1bd](https://github.com/jackindisguise/mud3/commit/85af1bdadcd305af200e2ff1e5affb88b77e9520))
* stored input on action queue entries for later display ([90443ed](https://github.com/jackindisguise/mud3/commit/90443ed0e7131ee319df51a9056f87e6ffc21268))
* updated tower dungeon configuration ([0f56443](https://github.com/jackindisguise/mud3/commit/0f564438e0eea3bccf0aedc864a6cb18a1e2d55d))


### Bug Fixes

* added debug logging to diagnose room lookup failures in room link processing ([a297d26](https://github.com/jackindisguise/mud3/commit/a297d26ac4a7894f6f092ef5575652d9200864ac))
* fixed logging issue where mob was logged after destruction in game.ts ([0f56443](https://github.com/jackindisguise/mud3/commit/0f564438e0eea3bccf0aedc864a6cb18a1e2d55d))

## [1.6.0](https://github.com/jackindisguise/mud3/compare/v1.5.0...v1.6.0) (2025-11-14)


### Features

* added dozens of new starter races/classes with lore helpfiles and scripts ([aae31e1](https://github.com/jackindisguise/mud3/commit/aae31e1b6ae771c6ee0e1feaf44f707c381df817))
* broadcast dungeon reset messages and updated dungeon data ([aae31e1](https://github.com/jackindisguise/mud3/commit/aae31e1b6ae771c6ee0e1feaf44f707c381df817))
* **core:** improve config guidance and auto-look handling ([6fd77b4](https://github.com/jackindisguise/mud3/commit/6fd77b49d80aa682b786652bb2eb03110a6910f5))
* enriched help and features docs, added config and who command ux tweaks ([aae31e1](https://github.com/jackindisguise/mud3/commit/aae31e1b6ae771c6ee0e1feaf44f707c381df817))
* expand archetypes and polish ux ([aae31e1](https://github.com/jackindisguise/mud3/commit/aae31e1b6ae771c6ee0e1feaf44f707c381df817))
* refactored the config command with helper functions, richer usage text, and color listings via mud-ext ([6fd77b4](https://github.com/jackindisguise/mud3/commit/6fd77b49d80aa682b786652bb2eb03110a6910f5))
* reworked character creation storing archetype objects plus !info support ([aae31e1](https://github.com/jackindisguise/mud3/commit/aae31e1b6ae771c6ee0e1feaf44f707c381df817))
* routed movement through Mob.step() so movement feedback and auto-look display live with the mob ([6fd77b4](https://github.com/jackindisguise/mud3/commit/6fd77b49d80aa682b786652bb2eb03110a6910f5))


### Bug Fixes

* improved prompt/echo handling and telnet IAC stripping compatibility ([aae31e1](https://github.com/jackindisguise/mud3/commit/aae31e1b6ae771c6ee0e1feaf44f707c381df817))
* prevented equipped items from being duplicated in serialized mob contents ([6fd77b4](https://github.com/jackindisguise/mud3/commit/6fd77b49d80aa682b786652bb2eb03110a6910f5))

## [1.5.0](https://github.com/jackindisguise/mud3/compare/v1.4.0...v1.5.0) (2025-11-13)


### Features

* added character settings system with config command and prompt formatter ([cef443d](https://github.com/jackindisguise/mud3/commit/cef443da17b8bbaeeb6a6db00a2897cba7dfa027))
* added config command for managing character settings ([cef443d](https://github.com/jackindisguise/mud3/commit/cef443da17b8bbaeeb6a6db00a2897cba7dfa027))
* added defaultColor setting to PlayerSettings for terminal color customization ([cef443d](https://github.com/jackindisguise/mud3/commit/cef443da17b8bbaeeb6a6db00a2897cba7dfa027))
* added prompt formatter with placeholders for health, mana, exhaustion, XP, and max values ([cef443d](https://github.com/jackindisguise/mud3/commit/cef443da17b8bbaeeb6a6db00a2897cba7dfa027))
* implemented stickyColor application in Character.send() when defaultColor is set ([cef443d](https://github.com/jackindisguise/mud3/commit/cef443da17b8bbaeeb6a6db00a2897cba7dfa027))
* updated serialization/deserialization to handle defaultColor setting ([cef443d](https://github.com/jackindisguise/mud3/commit/cef443da17b8bbaeeb6a6db00a2897cba7dfa027))

## [1.4.0](https://github.com/jackindisguise/mud3/compare/v1.3.0...v1.4.0) (2025-11-13)


### Features

* add bonuses command to display all attribute/resource bonuses from race, class, equipment, and attributes ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add destroy() method to DungeonObject for proper garbage collection ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add drop command to drop items from inventory (prevents dropping equipped items) ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add equipment templates to tower dungeon (sword, helmet, chest gear) ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add equipment/gear command to show equipped items with slot names ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add get command to pick up items from room or containers ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add inventory/inv command to show unequipped inventory items ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add number prefix support to find functions (e.g., "2.sword" selects 2nd match) ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add quit command to save and disconnect ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add remove command to unequip items with reverse action messages ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add save command to save character without quitting ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add secondaryAttributeBonuses field to Equipment ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add wear command to equip items with slot-specific messages ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* add XYZ coordinates to room display in look command ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* added mapText and mapColor fields across dungeon objects, templates, and serialization ([9c660e5](https://github.com/jackindisguise/mud3/commit/9c660e56813b3e3225b45d9230abbb776d12be2b))
* added quoted phrase support for word arguments ([5186ba9](https://github.com/jackindisguise/mud3/commit/5186ba9ca860e3d5f25eb209fb6434f3969aa25b))
* extracted mob implementation into src/mob.ts with registry helpers for custom dungeon objects ([9480cd8](https://github.com/jackindisguise/mud3/commit/9480cd804eba4827ec27c3cf27de7e07be26d181))
* extracted mob module and refreshed score display ([9480cd8](https://github.com/jackindisguise/mud3/commit/9480cd804eba4827ec27c3cf27de7e07be26d181))
* introduced package loader for races and classes ([1a7356a](https://github.com/jackindisguise/mud3/commit/1a7356a3a30618789a2bb009dbce906ab1df6c41))
* load archetypes and refine mob presentation ([1a7356a](https://github.com/jackindisguise/mud3/commit/1a7356a3a30618789a2bb009dbce906ab1df6c41))
* presented floored mob stats via readonly views ([1a7356a](https://github.com/jackindisguise/mud3/commit/1a7356a3a30618789a2bb009dbce906ab1df6c41))
* redesigned score command output with alignment utilities and box combiners ([9480cd8](https://github.com/jackindisguise/mud3/commit/9480cd804eba4827ec27c3cf27de7e07be26d181))
* refined tower dungeon data with guardian room description and directional staircase templates ([9c660e5](https://github.com/jackindisguise/mud3/commit/9c660e56813b3e3225b45d9230abbb776d12be2b))
* restyled score command into boxed sections ([1a7356a](https://github.com/jackindisguise/mud3/commit/1a7356a3a30618789a2bb009dbce906ab1df6c41))
* scheduled timed dungeon resets ([1a7356a](https://github.com/jackindisguise/mud3/commit/1a7356a3a30618789a2bb009dbce906ab1df6c41))
* support styled minimap tiles and top-first grids ([9c660e5](https://github.com/jackindisguise/mud3/commit/9c660e56813b3e3225b45d9230abbb776d12be2b))
* updated minimap rendering to honor room defaults, highlight mobs, and add alternating palette ([9c660e5](https://github.com/jackindisguise/mud3/commit/9c660e56813b3e3225b45d9230abbb776d12be2b))
* updated word argument regex to capture quoted strings or single words ([5186ba9](https://github.com/jackindisguise/mud3/commit/5186ba9ca860e3d5f25eb209fb6434f3969aa25b))


### Bug Fixes

* add type casts to Equipment/Armor/Weapon serialize methods ([1b49fd3](https://github.com/jackindisguise/mud3/commit/1b49fd35b3807b5bc74d397f0fc60b04b7acea86))
* call mob.destroy() when client disconnects or quits ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* exclude inventory items when source is "room" ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* improve test runner argument parsing for Windows compatibility ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))
* resolve serialization type compatibility issues ([1b49fd3](https://github.com/jackindisguise/mud3/commit/1b49fd35b3807b5bc74d397f0fc60b04b7acea86))
* update Item.deserialize to accept AnySerializedDungeonObject for compatibility ([1b49fd3](https://github.com/jackindisguise/mud3/commit/1b49fd35b3807b5bc74d397f0fc60b04b7acea86))
* use DungeonObject.deserialize() instead of Equipment.deserialize() to properly restore Weapon/Armor types with their stats ([0f80854](https://github.com/jackindisguise/mud3/commit/0f80854c1f62862b0cf01d9307e805979c88371f))

## [1.3.0](https://github.com/jackindisguise/mud3/compare/v1.2.0...v1.3.0) (2025-11-12)


### Features

* added board alias commands and updated changelog posting order ([a27fee2](https://github.com/jackindisguise/mud3/commit/a27fee2a4c4e0e687b3cd59dfadc1f0353fa21a0))
* added categorizeBulletPoint function to categorize bullet points by commit type ([bc7c2dc](https://github.com/jackindisguise/mud3/commit/bc7c2dc03707baa755acab1bebd0937654ecac68))
* added changes, general, and trade commands as aliases for board command ([a27fee2](https://github.com/jackindisguise/mud3/commit/a27fee2a4c4e0e687b3cd59dfadc1f0353fa21a0))
* added commit body parsing to post-changelog-to-board script ([bc7c2dc](https://github.com/jackindisguise/mud3/commit/bc7c2dc03707baa755acab1bebd0937654ecac68))
* added extractCommitHashes function to scrape commit hashes from version sections ([bc7c2dc](https://github.com/jackindisguise/mud3/commit/bc7c2dc03707baa755acab1bebd0937654ecac68))
* added fetchCommitBody function to retrieve and parse commit message bodies ([bc7c2dc](https://github.com/jackindisguise/mud3/commit/bc7c2dc03707baa755acab1bebd0937654ecac68))
* added miscellaneous category for bullet points without commit type prefixes ([bc7c2dc](https://github.com/jackindisguise/mud3/commit/bc7c2dc03707baa755acab1bebd0937654ecac68))

## [1.2.0](https://github.com/jackindisguise/mud3/compare/v1.1.0...v1.2.0) (2025-11-12)


### Features

* Added dungeon template registry and automatic reset system ([71192d1](https://github.com/jackindisguise/mud3/commit/71192d186266ad5c7d9b9338450f514cb0da469f))
* implemented movement commands, look command, and room descriptions ([e241a09](https://github.com/jackindisguise/mud3/commit/e241a09cc68ff01f158bfc2f4d71ef937668c681))
* improve changelog posting script with multi-version support and commit bodies ([2f457fb](https://github.com/jackindisguise/mud3/commit/2f457fbb3922b5f68a43a8784f4550e33b10d427))
* Integrated structured changelog parser into post-changelog-to-board script ([6fd11ac](https://github.com/jackindisguise/mud3/commit/6fd11acb7fd328eac6f35a670482b3c329d740bc))

## [1.1.0](https://github.com/jackindisguise/mud3/compare/v1.0.0...v1.1.0) (2025-11-10)


### Features

* add character ID system, board read tracking, and improved board UI ([20dd3ce](https://github.com/jackindisguise/mud3/commit/20dd3ce99902276679b4995e9671be5921c8f448))
* add gamestate package and implement atomic file writes ([4dd7842](https://github.com/jackindisguise/mud3/commit/4dd78427bc058d8f9f39bb8edfa825792135a552))

## 1.0.0 (2025-11-09)


### Features

* Add customizable channel message patterns and recipient formatting ([f184a8b](https://github.com/jackindisguise/mud3/commit/f184a8b368a7288049d4e4394a97843a1470fd0c))
* Add persistent message board system with interactive editor and colorized who command ([bc2742c](https://github.com/jackindisguise/mud3/commit/bc2742c03c1dd82e329a9c5908693b9bd5abbd28))
* added autocomplete literals to command patterns ([c73c090](https://github.com/jackindisguise/mud3/commit/c73c090665aec30204cdc926ca9fbd473c2000d4))
* added logger ([6a3d6e5](https://github.com/jackindisguise/mud3/commit/6a3d6e53505548715755c8a22aa9936d459d2315))
* doin a lot out here ([8d44100](https://github.com/jackindisguise/mud3/commit/8d441009cb729b634c11d35e98623abc75d9dc98))
* implement channel system with SAY support and admin tools ([6403972](https://github.com/jackindisguise/mud3/commit/640397293e0a9cb46dece917b79189e55a42b2fe))
* we be doin this ([aa71119](https://github.com/jackindisguise/mud3/commit/aa71119f9eb7bf4af778ddf75785f797a06a4cda))


### Bug Fixes

* fixed development flow a little bit ([139f47b](https://github.com/jackindisguise/mud3/commit/139f47b3a8bc961f0f0764ff3bf431dca5a54e4e))
* fixed mob/character relationship ([e342f44](https://github.com/jackindisguise/mud3/commit/e342f44145621624af6d88ea59b851272a8a43f9))
