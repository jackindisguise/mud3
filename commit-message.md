feat: template-aware serialization, global template ids, and compression helpers

feat: added templateId to DungeonObject and SerializedDungeonObject for instance-template linkage
feat: based compression/normalization on template baselines to omit redundant fields
feat: added shared helpers getCompressionBaseline and compressSerializedObject to centralize diffing
feat: supported room templates with neutral-coordinate baseline caching for consistent diffs
feat: localized template ids when saving dungeons and globalized them on load (@dungeon:id)
feat: accepted local templateId in resets and auto-prefixed with current dungeon id on load
refactor: updated Equipment/Armor/Weapon serializers to build full uncompressed and use shared compression
refactor: resolved templates via registry or global cache with fallback to type baselines
fix: omitted templateId in uncompressed output when undefined to match serializer expectations
test: added src/dungeon.templates.spec.ts covering templateId, compression vs template, and round-trip
test: switched template tests to deep equality to display full expected forms
chore: updated data/dungeons/tower.yaml to use local template ids and localized reset references