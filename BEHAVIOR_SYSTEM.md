# Mob Behavior System

## Overview

The behavior system allows NPCs (non-player-controlled mobs) to have automated behaviors that affect their actions in the game world. Behaviors are defined as flags that can be enabled or disabled on a per-mob basis.

## Available Behaviors

The system currently supports three behaviors:

1. **AGGRESSIVE** (`"aggressive"`)
   - Mobs with this behavior will attack character mobs (player-controlled mobs)
   - **Stationary aggressive mobs**: Attack character mobs that enter their room (via `room.onEnter` events)
   - **Wandering aggressive mobs**: Attack character mobs when they step into rooms containing them (via `mob.onStep` events)
   - Only triggers if the aggressive mob is not already in combat and both mobs are alive

2. **WIMPY** (`"wimpy"`)
   - Mobs with this behavior will randomly flee combat when their health reaches 25%
   - Fleeing removes the mob from combat and they will not re-engage immediately

3. **WANDER** (`"wander"`)
   - Mobs with this behavior will randomly move around their dungeon every 30 seconds
   - **Wandering mobs do NOT attack anyone by themselves** - wander only causes movement
   - The system maintains a cache of all wandering mobs for efficient processing
   - Wandering mobs are automatically tracked and processed by the game loop

## Key Difference: Aggressive vs Wander

- **AGGRESSIVE**: Mobs that attack character mobs (player-controlled mobs). 
  - Stationary aggressive mobs attack when characters enter their room
  - Wandering aggressive mobs attack when they step into rooms containing characters
- **WANDER**: Mobs that move around randomly every 30 seconds.
  - **Wander alone does NOT cause attacks** - it only makes the mob mobile.

**Important**: Only aggressive mobs attack character mobs. If you want a mob that wanders AND attacks, you must enable both `aggressive` and `wander` behaviors. When both are enabled, the mob will wander around and attack character mobs it encounters in the rooms it enters.

## Implementation Details

### BEHAVIOR Enum

Behaviors are defined using the `BEHAVIOR` enum in `src/dungeon.ts`:

```typescript
export enum BEHAVIOR {
  AGGRESSIVE = "aggressive",
  WIMPY = "wimpy",
  WANDER = "wander",
}
```

### MobTemplate Structure

In your map editor, mob templates should include a `behaviors` field in the `MobTemplate` interface:

```typescript
interface MobTemplate {
  type: "Mob";
  // ... other mob properties ...
  behaviors?: Partial<Record<BEHAVIOR, boolean>>;
}
```

### Serialization Format

When saving mob templates to YAML/JSON, behaviors are serialized as a dictionary where:
- **Keys** are the behavior enum values as strings (`"aggressive"`, `"wimpy"`, `"wander"`)
- **Values** are booleans (`true` to enable, `false` to disable or omit to disable)

Example YAML:
```yaml
type: Mob
id: goblin-warrior
display: "A goblin warrior"
behaviors:
  aggressive: true
  wander: true
  # wimpy is not set, so it defaults to false
```

Example JSON:
```json
{
  "type": "Mob",
  "id": "goblin-warrior",
  "display": "A goblin warrior",
  "behaviors": {
    "aggressive": true,
    "wander": true
  }
}
```

## Map Editor Integration

### UI Recommendations

1. **Behavior Section**: Add a "Behaviors" section to your mob template editor
2. **Checkboxes/Toggles**: Use checkboxes or toggle switches for each behavior:
   - ☐ Aggressive
   - ☐ Wimpy
   - ☐ Wander
4. **Behavior Descriptions**: Show tooltips or help text explaining what each behavior does

### Data Handling

When saving a mob template:

1. **Collect enabled behaviors**: Only include behaviors that are checked/enabled
2. **Build behaviors dictionary**: Create an object with behavior enum values as keys
3. **Omit if empty**: If no behaviors are enabled, you can omit the `behaviors` field entirely

Example code (pseudo-code):
```javascript
const behaviors = {};
if (aggressiveChecked) behaviors["aggressive"] = true;
if (wimpyChecked) behaviors["wimpy"] = true;
if (wanderChecked) behaviors["wander"] = true;

const mobTemplate = {
  type: "Mob",
  // ... other properties ...
  ...(Object.keys(behaviors).length > 0 ? { behaviors } : {})
};
```

When loading a mob template:

1. **Read behaviors dictionary**: Extract the `behaviors` field if present
2. **Set checkboxes**: Check each behavior that has a `true` value
3. **Handle missing behaviors**: If `behaviors` is missing or a behavior key is missing, default to unchecked

Example code (pseudo-code):
```javascript
const behaviors = mobTemplate.behaviors || {};
aggressiveChecked = behaviors["aggressive"] === true;
wimpyChecked = behaviors["wimpy"] === true;
wanderChecked = behaviors["wander"] === true;
```

### Validation

- **Valid keys**: Only accept `"aggressive"`, `"wimpy"`, and `"wander"` as behavior keys
- **Valid values**: Only accept boolean values (`true` or `false`)
- **Case sensitivity**: Behavior keys are case-sensitive and must match the enum values exactly

## Runtime Behavior

### Automatic Management

The system automatically manages behavior state:

- **WANDER cache**: When a mob's wander behavior is enabled, it's automatically added to a global cache (`WANDERING_MOBS`)
- **WANDER cache cleanup**: When wander is disabled, the mob is removed from the cache
- **Player control**: If a mob becomes player-controlled (gets a character), behaviors are automatically disabled
- **Mob destruction**: When a mob is destroyed, it's automatically removed from the wander cache

### Behavior Processing

- **Aggressive**: Processed in two scenarios:
  - When character mobs enter the aggressive mob's room (via `room.onEnter` events) - for stationary aggressive mobs
  - When aggressive mobs step into rooms containing character mobs (via `mob.onStep` events) - for wandering aggressive mobs
  - Only aggressive mobs attack character mobs
- **Wimpy**: Processed during combat rounds when mob health reaches 25%
- **Wander**: Processed every 30 seconds by a game timer; causes the mob to randomly move to adjacent rooms. Does NOT cause attacks - only aggressive mobs attack.

## Examples

### Example 1: Stationary Guard

A guard that attacks characters entering its room:

```yaml
type: Mob
id: guard
display: "A city guard"
behaviors:
  aggressive: true
```

### Example 2: Peaceful Wanderer

A mob that wanders around but does NOT attack (wander alone does not cause attacks):

```yaml
type: Mob
id: peaceful-wanderer
display: "A peaceful creature"
behaviors:
  wander: true
```

### Example 3: Cowardly Mob

A mob that flees when hurt:

```yaml
type: Mob
id: cowardly-kobold
display: "A kobold"
behaviors:
  wimpy: true
```

### Example 4: Aggressive Wanderer

A mob that both wanders around AND attacks character mobs when it enters rooms containing them (requires both behaviors):

```yaml
type: Mob
id: dangerous-wanderer
display: "A dangerous creature"
behaviors:
  aggressive: true
  wander: true
```

**Note**: This mob will wander around, and when it enters a room with character mobs, it will attack them because it has the aggressive behavior. Without the aggressive behavior, it would only wander and never attack.

## Notes for Map Editors

1. **NPCs Only**: Behaviors only work for NPCs. Player-controlled mobs cannot have behaviors.

2. **Optional Field**: The `behaviors` field is optional. If omitted, the mob has no behaviors.

3. **Partial Dictionary**: The `behaviors` field is a partial dictionary, meaning you only need to include behaviors you want to enable. Omitted behaviors default to `false`.

4. **String Keys**: When serializing, behavior keys must be the exact enum string values: `"aggressive"`, `"wimpy"`, `"wander"` (lowercase).

5. **Boolean Values**: Only use `true` to enable behaviors. Using `false` is equivalent to omitting the key, but including `false` explicitly is also valid.

6. **Future Behaviors**: The system is designed to be extensible. New behaviors may be added in the future, so your editor should gracefully handle unknown behavior keys (either ignore them or show a warning).
