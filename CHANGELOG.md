# Changelog

## [1.23.0](https://github.com/jackindisguise/mud3/compare/v1.22.0...v1.23.0) (2025-12-02)


### Features

* **calendar:** added calendar system with time tracking and events ([040724b](https://github.com/jackindisguise/mud3/commit/040724bfb3bb00935c8b897f4bc10ba9cb150c55)), closes [#25](https://github.com/jackindisguise/mud3/issues/25)
* **combat:** added NPC target switching and aggro behavior when leaving combat ([c3742c3](https://github.com/jackindisguise/mud3/commit/c3742c397c4c23a61057a9913db4de2156935ba3))
* **combat:** prevented self-targeting in combat ([de8ecf4](https://github.com/jackindisguise/mud3/commit/de8ecf4f1cab73bb8b1c65660ba0339ab69a2a41))
* **commands:** added effects command to list active effects ([bcbf2d6](https://github.com/jackindisguise/mud3/commit/bcbf2d67ab779ae58dfdbd78e2b4339ecea9e6f0))
* **dungeon:** integrate room migration system into deserialization ([40f9677](https://github.com/jackindisguise/mud3/commit/40f9677af1f51c4ff932ec4b29f6966024f97fad))
* **dungeon:** made diagonal directions independent bit flags ([b631280](https://github.com/jackindisguise/mud3/commit/b6312800a57eef2d7d5a2b2d277f4e20fe4f37f7))
* **dungeon:** updated default allowed exits to include diagonals ([5a1695f](https://github.com/jackindisguise/mud3/commit/5a1695fbdcadeb9623b4650c372bf453d629d252))
* **effects:** added adaptable effect template for human race ([3153cf9](https://github.com/jackindisguise/mud3/commit/3153cf978424dca0f1186696d7cbaebe2db4668d))
* **effects:** added effect serialization and deserialization ([5ee0798](https://github.com/jackindisguise/mud3/commit/5ee0798e020eaef7191ea5d8b8ebb341a44775b6))
* **effects:** added poison effect template ([669a4bc](https://github.com/jackindisguise/mud3/commit/669a4bcf35d408bc5cdb8ed766a8464b091aa05b))
* **effects:** implemented core effect system ([8234517](https://github.com/jackindisguise/mud3/commit/82345178086638f0f406464127a95a34a69979eb))
* implementing telnet protocols ([fa3d046](https://github.com/jackindisguise/mud3/commit/fa3d046c8158b5a2cc057d22c0c29cee631b4790))
* **io:** wait for telnet negotiations before emitting client connection ([90d8dd8](https://github.com/jackindisguise/mud3/commit/90d8dd828b327e35e5a48d88a3d15cbce838732b))
* **map-editor:** add make 2-way button for room links ([dff9f22](https://github.com/jackindisguise/mud3/commit/dff9f22ade5e9e56c01c6ec7512977895102cc7e))
* **map-editor:** added Clear Resets and Clear Exit Overrides buttons to UI ([a99b5a2](https://github.com/jackindisguise/mud3/commit/a99b5a2fed4f1bad80212b83e65a7e3f81f6b55c))
* **map-editor:** reorganized exit buttons layout in room editor modal ([3980fd3](https://github.com/jackindisguise/mud3/commit/3980fd3256e00b314d4ce5a4c19b08734d0a7522))
* **migrations:** add room migration system ([8a84b22](https://github.com/jackindisguise/mud3/commit/8a84b222d40ce102f9831ad779566beb50a0b3e2))
* **migrations:** add separate dungeonVersion field for dungeon migrations ([cf223a8](https://github.com/jackindisguise/mud3/commit/cf223a82572fcc4f7430a09b91f8434e7532bb29))
* **mob:** integrated effect system into Mob class ([18a860f](https://github.com/jackindisguise/mud3/commit/18a860feee5f8322d9a2033c2172c6dadb8d4e89))
* **telnet:** add comprehensive telnet option definitions and improve negotiation ([c2cb1d3](https://github.com/jackindisguise/mud3/commit/c2cb1d3ebdd4b7a6b6c5d76f3a874457ab67d69f))
* **telnet:** protocol handlers now use MCCP2 compression when active ([80ad90c](https://github.com/jackindisguise/mud3/commit/80ad90cf6676cf84768233a9c827e5952bdccd97))
* **utils:** added assertion utilities with comparison operators ([4ba9aaf](https://github.com/jackindisguise/mud3/commit/4ba9aaf235b2302222c1389b9f0f7006e50a9b09))


### Bug Fixes

* **character:** use getCurrentDungeonVersion for character serialization ([cb0a376](https://github.com/jackindisguise/mud3/commit/cb0a37635d87a4247518f94e1dce555aeff09dc5))
* **combat:** fixed threat and aggro system to properly initiate combat with free rounds ([f91af15](https://github.com/jackindisguise/mud3/commit/f91af15cd572c01c7c3b11dfb00aceddf1d4884f)), closes [#24](https://github.com/jackindisguise/mud3/issues/24)
* **combat:** prevent threat expiration for mobs in same room as NPC ([da6de63](https://github.com/jackindisguise/mud3/commit/da6de63ef9d75b2b89c737b4060629889f7a7f40))
* **commands:** changed learn command to accept text instead of word ([91237ab](https://github.com/jackindisguise/mud3/commit/91237ab4dd7de2301ede64c974333eae03789dbe))
* **commands:** handle undefined messages in gocial command ([addabdf](https://github.com/jackindisguise/mud3/commit/addabdf5185ce5460417ac38b9923facb4732082))
* **core:** changed IO encoding to binary and added debug logging ([5c54bec](https://github.com/jackindisguise/mud3/commit/5c54becd4d17f532d972a8d0e66e6c0c5018a5a0))
* **dungeon:** changed combat check from isInCombat to combatTarget ([1a64868](https://github.com/jackindisguise/mud3/commit/1a64868836687876861127ca8e589af38e555f40))
* **dungeon:** preserve oid field during object deserialization ([13ab54c](https://github.com/jackindisguise/mud3/commit/13ab54c14e744490e0dff5b34ddd3912c718c589))
* **effects:** removed target from effect message templates ([c252567](https://github.com/jackindisguise/mud3/commit/c252567caf0bf332394ccbd7cc470918b5756b31))
* **game:** fix race condition and close client on inactivity timeout ([6727c55](https://github.com/jackindisguise/mud3/commit/6727c5517a52501257fda3ff8b2808da0ac840f8))
* **io:** increased telnet negotiation timeout to 3 seconds ([c9443bb](https://github.com/jackindisguise/mud3/commit/c9443bb9ae7b3f165eb92cfb4a0d586092c89526))
* **io:** only send GA messages for prompts without linebreaks ([7370e64](https://github.com/jackindisguise/mud3/commit/7370e64deb0c2eb746fc6c568c407712eb910d74))
* **map-editor:** corrected Mobius perimeter and added exit override features ([7d601c7](https://github.com/jackindisguise/mud3/commit/7d601c7a66c8afda1c55699bdf7538d5c8d98eb2))
* **map-editor:** save mob template behavior button states ([a7f5e72](https://github.com/jackindisguise/mud3/commit/a7f5e72ea7dab7f3677ead383ad548871287de46))
* **test:** clear threat tables before clearing combat targets in combat tests ([af7baa5](https://github.com/jackindisguise/mud3/commit/af7baa59078004a88a1d3971dddab3da8ee6e84a))
* **test:** updated threat expiration tests to account for same-room prevention ([18ac020](https://github.com/jackindisguise/mud3/commit/18ac0200f46524b5fa64f4be06034dbfa3964448))

## [1.22.0](https://github.com/jackindisguise/mud3/compare/v1.21.0...v1.22.0) (2025-11-27)


### Features

* **build:** enable incremental TypeScript compilation ([4c7b507](https://github.com/jackindisguise/mud3/commit/4c7b5073bc5c26b99365069a381d9f90ac82acb1))
* **color:** added ColorName type and COLOR_NAME_TO_COLOR mapping ([9803021](https://github.com/jackindisguise/mud3/commit/9803021ec1fc5efe0d004f4fb3e2eff87ba8ee45))
* **core:** added version support to serialization system ([aeb1c9a](https://github.com/jackindisguise/mud3/commit/aeb1c9a3086336d1e8c8b1b01f24999ecbce24c3))
* **data:** added version fields to dungeon files ([cd3ed4d](https://github.com/jackindisguise/mud3/commit/cd3ed4d63efc7deb6f74a543ea0d76fa9ddff82d))
* **deserialization:** integrated migrations into object deserialization ([2783811](https://github.com/jackindisguise/mud3/commit/278381121b6cb3c0738d6005367ce96066c50059))
* **dungeon:** added parentVersion support to all deserializers ([d04aeba](https://github.com/jackindisguise/mud3/commit/d04aeba68c95fa10590b9291a4fdd65f26927add))
* **map-editor:** added version support and dungeon migration integration ([c03aa68](https://github.com/jackindisguise/mud3/commit/c03aa68f299c97cb1c6240b5300830872f068e98))
* **map-editor:** added version support to room and template creation ([ab595b6](https://github.com/jackindisguise/mud3/commit/ab595b69dcb7c5050a2357011ed16190c22666e3))
* **migrations:** added data migration system for dungeons and characters ([9847079](https://github.com/jackindisguise/mud3/commit/9847079f37dd2612c9e4ede88ff6a10abf01ec70))
* **migrations:** added migration frameworks for mobs, items, equipment, armor, and weapons ([26dfa2d](https://github.com/jackindisguise/mud3/commit/26dfa2dd95e4ad0ea792334cc4e5472cdb850a50))
* **migrations:** added template migration system for all entity types ([e5db66e](https://github.com/jackindisguise/mud3/commit/e5db66e4b84c65c65c41f81b979cf866ff0f948a))
* **package:** integrated migration system into dungeon and character loading ([e67be41](https://github.com/jackindisguise/mud3/commit/e67be410a76c610041394ea93d85219da5251346))
* **schemas:** added version field to dungeon and character schemas ([a14b513](https://github.com/jackindisguise/mud3/commit/a14b513d3d7b7034dc5306cfe815bfc621560383))
* **test-parallel:** track and display cancelled, skipped, and todo tests ([dba915d](https://github.com/jackindisguise/mud3/commit/dba915dac13281c776448a454c6d4903750ea838))


### Bug Fixes

* **build:** improved clean-orphaned script to handle .cts and .mts file extensions ([285e076](https://github.com/jackindisguise/mud3/commit/285e0768b2536f796a18e2bbb4f9685cffae9248))
* **build:** improved TypeScript error formatting in tsc-and-list script ([ab2f917](https://github.com/jackindisguise/mud3/commit/ab2f91706e6e619dd5cf6a06266929068cc48134))
* **tests:** updated tests to handle async deserialization functions ([fecfded](https://github.com/jackindisguise/mud3/commit/fecfdede91c958f0fbb54566201d3bfc809bd936))

## [1.21.0](https://github.com/jackindisguise/mud3/compare/v1.20.0...v1.21.0) (2025-11-26)


### Features

* **package-loader:** added automated package discovery and loading ([94dbb2f](https://github.com/jackindisguise/mud3/commit/94dbb2f8f6d65ddf0dbdb444ba6e9de43341b813))
* **schema:** added busy mode fields to character schema ([55666b6](https://github.com/jackindisguise/mud3/commit/55666b6e3b61fc080539e1791cf6effdd2dc7c54))
* **testing:** added script to run individual test files ([2588bca](https://github.com/jackindisguise/mud3/commit/2588bca82decc31448939c2f16ada1d05a5db36a))
* **testing:** added TypeScript test runner with source maps ([4f7d0f8](https://github.com/jackindisguise/mud3/commit/4f7d0f8c3caef72d30bdf41ccea08806475311ce))
* **utils:** added DeepReadonly utility type ([28ab965](https://github.com/jackindisguise/mud3/commit/28ab9655f226758d6a2677f0bbfd89fae57eb055))


### Bug Fixes

* **character:** added validation for mob when saving character ([b108db2](https://github.com/jackindisguise/mud3/commit/b108db26af1837bc741df3ba172b207a1cbca7b0))
* **io:** removed duplicate server listening log message ([efbb51c](https://github.com/jackindisguise/mud3/commit/efbb51cd658782104f775a50a743764aa91b7b4b))
* **pathfinding:** registered dungeons in test suite ([637ba57](https://github.com/jackindisguise/mud3/commit/637ba57e6aa3c4820beff1e26244802845bd2fe0))

## [1.20.0](https://github.com/jackindisguise/mud3/compare/v1.19.0...v1.20.0) (2025-11-25)


### Features

* added regeneration system with Spirit attribute and rest command ([078c5a5](https://github.com/jackindisguise/mud3/commit/078c5a50b8fb7928013c218458318a1b907a3b3b))
* enhanced combat messages with colored verbs and ASCII art kill messages ([7445bae](https://github.com/jackindisguise/mud3/commit/7445bae342afee8be661ba38ad3ec0c43bdab99e))


### Bug Fixes

* **map-editor:** improved dropdown menu readability in dark theme ([0b3eee4](https://github.com/jackindisguise/mud3/commit/0b3eee4dfbe5f769d258b9c82fae28fd6444ddbd))

## [1.19.0](https://github.com/jackindisguise/mud3/compare/v1.18.0...v1.19.0) (2025-11-25)


### Features

* added busy mode system for message queuing ([93f0fc7](https://github.com/jackindisguise/mud3/commit/93f0fc7fa2e3d715b9db1ba2992560396b9ec080))
* **combat:** improved death handling and player mob combat ([94dddf6](https://github.com/jackindisguise/mud3/commit/94dddf692ace2b43a3b9d0f7749bb2443e0e7f3d))

## [1.18.0](https://github.com/jackindisguise/mud3/compare/v1.17.0...v1.18.0) (2025-11-24)


### Features

* add pure power passive and movement cooldown gating ([f954deb](https://github.com/jackindisguise/mud3/commit/f954debc4a78ce765e9f565f8a368435b1d4d15f))
* added Ability interface in src/ability.ts ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* added ability loader in src/package/abilities.ts that loads TypeScript abilities from dist/src/abilities ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* added ability system with learned abilities and dynamic command loading ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* added AbilityCommand class that requires actor to know ability before matching ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* added abilityName option to oneHit for custom damage messages ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* added attackPowerBonus and attackPowerMultiplier options to oneHit for dynamic damage scaling ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* added change tracking system and improved map editor UX ([89daaf3](https://github.com/jackindisguise/mud3/commit/89daaf3ea402fadc827d8b3d81093e092e0a006a))
* added change tracking system with history panel ([89daaf3](https://github.com/jackindisguise/mud3/commit/89daaf3ea402fadc827d8b3d81093e092e0a006a))
* added expandable metadata details when selecting history entries ([89daaf3](https://github.com/jackindisguise/mud3/commit/89daaf3ea402fadc827d8b3d81093e092e0a006a))
* added knowsAbility, addAbility, and removeAbility helper methods to Mob class ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* added learned abilities Map to Mob class with proficiency tracking (0-100) ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* added Pure Power passive ability and applied multiplier in Mob attacks ([f954deb](https://github.com/jackindisguise/mud3/commit/f954debc4a78ce765e9f565f8a368435b1d4d15f))
* added schemas for data files ([1598b97](https://github.com/jackindisguise/mud3/commit/1598b97b083835b42e8fa377cd1fb2aff7d1b2f8))
* added selection bounds and shape metadata to placement operations ([89daaf3](https://github.com/jackindisguise/mud3/commit/89daaf3ea402fadc827d8b3d81093e092e0a006a))
* added status bar at bottom of editor showing template, tool, mode, position, history, and changes ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* added theme system and improved map editor UI ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* added triangle arrow indicators for UP and DOWN exits on grid cells ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* added visual indicators and status bar improvements ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* added weaponType field with default to shortsword ([5c70a99](https://github.com/jackindisguise/mud3/commit/5c70a99d611ba0742e9a6d1a4565003600ab7ac4))
* changed exit override indicator from lightning bolt to warning triangle symbol ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* created example whirlwind ability in src/abilities/whirlwind.ts ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* created learn command in src/commands/learn.ts for learning abilities ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* exit overrides can now add roomlinks as well as the allowed exits ([96df8a3](https://github.com/jackindisguise/mud3/commit/96df8a3cc43bbd9af42fcf700b1456ffef10a746))
* gated movement and flee cooldowns and set directional commands to low priority ([f954deb](https://github.com/jackindisguise/mud3/commit/f954debc4a78ce765e9f565f8a368435b1d4d15f))
* implemented edge-line selection tool to create frame around line with two parallel lines and connecting segments ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* implemented flood fill paint mode for mobs and objects ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* mapped YAML data to JSON schemas and added VS Code schema associations ([f954deb](https://github.com/jackindisguise/mud3/commit/f954debc4a78ce765e9f565f8a368435b1d4d15f))
* **minimap:** replaced up/down exit text with ^ and V arrows in minimap grid ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* registered ability loader in package system (index.ts) ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* required whirlwind command to be known, alive, and in-room before cooldown applied ([f954deb](https://github.com/jackindisguise/mud3/commit/f954debc4a78ce765e9f565f8a368435b1d4d15f))
* **theme:** added dark and light theme system with toggle button ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **theme:** added spin animation for theme toggle button ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **theme:** added theme-init.js for CSP-compliant theme loading ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **theme:** created dark.css and light.css with futuristic styling ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **theme:** implemented theme persistence using localStorage ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **ui:** added styling for add/edit exit override button ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **ui:** disabled text highlighting globally while preserving input functionality ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **ui:** improved reset editor modal with min/max count on same line ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **ui:** improved template info box colors for light theme ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **ui:** updated exit override modal to show capitalized direction names ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* **ui:** updated help box with theme and reset action documentation ([79e9f98](https://github.com/jackindisguise/mud3/commit/79e9f98d3a098d65ccf9696fd8e73ecbeb9164b7))
* updated CommandRegistry.execute to skip ability commands if actor doesn't know the ability ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* updated Mob serialize and deserialize methods to persist learned abilities ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* updated SerializedMob interface to include learnedAbilities field ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* updated whirlwind ability to use abilityName and attackPowerMultiplier ([711198d](https://github.com/jackindisguise/mud3/commit/711198d7692eea1d313597ecaa69b78757f9dda1))
* working on web-client ([c5aa68f](https://github.com/jackindisguise/mud3/commit/c5aa68fff20b3d47555068ee54eb180eea2735ce))


### Bug Fixes

* added filledCount metadata to paint flood-fill change history ([89daaf3](https://github.com/jackindisguise/mud3/commit/89daaf3ea402fadc827d8b3d81093e092e0a006a))
* cleared selection tools when switching to paint flood-fill mode ([89daaf3](https://github.com/jackindisguise/mud3/commit/89daaf3ea402fadc827d8b3d81093e092e0a006a))
* corrected paint mode history tracking for mobs and objects to only record when cells are actually painted ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* corrected selection clearing behavior to clear previous selection when starting new selection with any tool ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* corrected status bar template check to handle template ID 0 correctly ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* ensured edge-line selection always includes start and end cells of original line ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))
* fixed dungeon test, proficiency at uses, and reciprocal combat ([c1c50eb](https://github.com/jackindisguise/mud3/commit/c1c50eb232ffd79d151ddfc437e7ccbd6df16412))
* improved minimap display and web client UX ([4700301](https://github.com/jackindisguise/mud3/commit/470030135b0ac8553be0821379b99a1e947b694f))
* removed misuse of newParameters/oldParameters in selection placements ([89daaf3](https://github.com/jackindisguise/mud3/commit/89daaf3ea402fadc827d8b3d81093e092e0a006a))
* updated status bar to show selected template and tool, not active usage state ([26bbf41](https://github.com/jackindisguise/mud3/commit/26bbf413ceb623fed30346a029600c409672b352))

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
