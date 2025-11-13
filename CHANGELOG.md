# Changelog

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
