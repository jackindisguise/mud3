# Phase 1.1: Core Module Violations Documentation

This document lists all core modules that import from `package/` modules, documenting what each import is used for and categorizing them by solution type.

## Summary

**Total Core Modules with Violations: 5**
- `src/dungeon.ts` - 3 violations
- `src/character.ts` - 1 violation
- `src/board.ts` - 1 violation
- `src/combat.ts` - 2 violations (1 constant, 1 runtime lookup)
- `src/game.ts` - 7 violations (needs classification as core vs package)

**Exception Modules (allowed to import from packages):**
- `src/commands/` - All command implementations (exception)
- `src/abilities/` - All ability implementations (exception)
- `src/command.spec.ts` - Test file (exception)

---

## Detailed Violations

### 1. `src/dungeon.ts`

#### 1.1 `getNextObjectIdSync` from `package/gamestate.js`

**Import Location:** Line 87
```typescript
import { getNextObjectIdSync } from "./package/gamestate.js";
```

**Usage:**
- **Line 2544**: Used in `DungeonObject` constructor to assign unique OID when creating new objects
  ```typescript
  this.oid = getNextObjectIdSync();
  ```

**Category:** **Runtime Lookup / State Management**
- Synchronously generates and increments object IDs from game state
- Accesses mutable global state (`GAME_STATE.nextObjectId`)
- Used during object instantiation

**Solution Type:** **Dependency Injection**
- Add optional `oidProvider?: () => number` parameter to `DungeonObject` constructor
- Pass provider from package layer when creating objects
- Maintain backward compatibility with default behavior

---

#### 1.2 `getAbilityById` from `package/abilities.js`

**Import Location:** Line 99
```typescript
import { getAbilityById } from "./package/abilities.js";
```

**Usage:**
- **Line 5879**: Used in `Mob.useAbilityById()` to get ability name for proficiency increase notification
  ```typescript
  const ability = getAbilityById(abilityId);
  const abilityName = ability?.name ?? abilityId;
  ```

**Category:** **Runtime Lookup**
- Looks up ability from runtime registry (`ABILITY_REGISTRY`)
- Used to get ability metadata (name) for user messaging
- Optional lookup (handles undefined gracefully)

**Solution Type:** **Dependency Injection / Optional Parameter**
- Add optional `abilityLookup?: (id: string) => Ability | undefined` parameter to `Mob.useAbilityById()`
- Pass lookup function from package layer when calling this method
- Or: Make the lookup optional and only show message if ability is found

---

#### 1.3 Archetype Lookups from `package/archetype.js`

**Import Location:** Lines 68-73
```typescript
import {
	getDefaultRace,
	getDefaultJob,
	getRaceById,
	getJobById,
} from "./package/archetype.js";
```

**Usage:**
- **Line 5315**: `getDefaultRace()` - Used in `Mob` constructor as default when no race provided
  ```typescript
  this._race = options?.race ?? getDefaultRace();
  ```
- **Line 5316**: `getDefaultJob()` - Used in `Mob` constructor as default when no job provided
  ```typescript
  this._job = options?.job ?? getDefaultJob();
  ```
- **Line 5943**: `getRaceById()` - Used in `Mob.applyTemplate()` to resolve race from template
  ```typescript
  const race = getRaceById(mobTemplate.race);
  ```
- **Line 5950**: `getJobById()` - Used in `Mob.applyTemplate()` to resolve job from template
  ```typescript
  const job = getJobById(mobTemplate.job);
  ```
- **Line 7419**: `getRaceById()` - Used in `Mob.deserialize()` to restore race from serialized data
  ```typescript
  const race = getRaceById(raceId);
  ```
- **Line 7420**: `getJobById()` - Used in `Mob.deserialize()` to restore job from serialized data
  ```typescript
  const job = getJobById(jobId);
  ```
- **Lines 8012-8013**: `getRaceById()` and `getJobById()` - Used in `Dungeon.deserializeMob()` to restore race/job
  ```typescript
  race: getRaceById(m.race),
  job: getJobById(m.job),
  ```

**Category:** **Runtime Lookup**
- All functions look up archetypes (Race/Job) from runtime registry
- Used for defaults, template application, and deserialization
- Critical for mob creation and restoration

**Solution Type:** **Dependency Injection**
- Add optional parameters to `Mob` constructor: `defaultRace?: Race`, `defaultJob?: Job`
- Add optional lookup functions to `Mob.applyTemplate()`: `raceLookup?: (id: string) => Race | undefined`, `jobLookup?: (id: string) => Job | undefined`
- Add optional lookup functions to `Mob.deserialize()`: same as above
- Add optional lookup functions to `Dungeon.deserializeMob()`: same as above
- Package layer provides these when creating/deserializing mobs

---

### 2. `src/character.ts`

#### 2.1 `CONFIG` from `package/config.js`

**Import Location:** Line 58
```typescript
import { CONFIG } from "./package/config.js";
```

**Usage:**
- **Line 1185**: Used in `Character.hashPassword()` static method to get password salt
  ```typescript
  const saltedPassword = password + CONFIG.security.password_salt;
  ```

**Category:** **Runtime Configuration**
- Accesses loaded configuration value (password salt)
- Used for password hashing security
- Configuration is loaded from YAML at runtime

**Solution Type:** **Dependency Injection**
- Add optional `passwordSalt?: string` parameter to `Character.hashPassword()` static method
- Add optional `passwordSalt?: string` parameter to `Character.setPassword()` instance method
- Package layer passes salt from `CONFIG` when calling these methods
- Consider: Could also extract salt to a core constant if it's truly constant (but it's configurable, so injection is better)

---

### 3. `src/board.ts`

#### 3.1 `saveBoard` from `package/board.js`

**Import Location:** Line 12
```typescript
import { saveBoard } from "./package/board.js";
```

**Usage:**
- **Line 368**: Used in `Board.save()` instance method to persist board to disk
  ```typescript
  public async save(): Promise<void> {
      await saveBoard(this);
  }
  ```
- **Line 221**: Called indirectly from `Board.markMessageAsRead()` which calls `this.save()`
  ```typescript
  await this.save().catch((err) => {
      // Error saving is logged by saveBoard, continue anyway
  });
  ```

**Category:** **Persistence / I/O**
- Direct persistence call from core module
- Violates separation: core should not know about persistence
- Used for saving board state after modifications

**Solution Type:** **Remove Persistence from Core**
- Remove `Board.save()` method entirely
- Remove `saveBoard` import
- Update `Board.markMessageAsRead()` to not call `save()` directly
- Package layer handles saving after any board modifications
- Core only provides `serialize()` method for data extraction

---

### 4. `src/combat.ts`

#### 4.1 `LOCATION` enum from `package/locations.js`

**Import Location:** Line 19
```typescript
import { getLocation, LOCATION } from "./package/locations.js";
```

**Usage:**
- **Line 292**: Used as constant enum value to specify graveyard location
  ```typescript
  const graveyard = getLocation(LOCATION.GRAVEYARD);
  ```

**Category:** **Constant Enum**
- `LOCATION` is a pure enum with constant values: `START`, `RECALL`, `GRAVEYARD`
- Not runtime-loaded, just a type-safe constant
- Should be in core, not package

**Solution Type:** **Extract to Core**
- Create `src/location.ts` with `LOCATION` enum
- Move enum from `package/locations.ts` to core
- Update `combat.ts` to import from core
- Update `package/locations.ts` to re-export from core for backward compatibility

---

#### 4.2 `getLocation` from `package/locations.js`

**Import Location:** Line 19
```typescript
import { getLocation, LOCATION } from "./package/locations.js";
```

**Usage:**
- **Line 292**: Used in `handleDeath()` to get graveyard room reference
  ```typescript
  const graveyard = getLocation(LOCATION.GRAVEYARD);
  ```

**Category:** **Runtime Lookup**
- Looks up room reference from loaded location configuration
- Returns `Room | undefined` based on runtime-loaded YAML data
- Used to find where to move dead mobs

**Solution Type:** **Dependency Injection**
- Add optional `locationLookup?: (key: string) => Room | undefined` parameter to `handleDeath()` function
- Or: Pass graveyard room directly as parameter
- Package layer provides lookup function or room reference when calling

---

### 5. `src/game.ts` (Needs Classification)

**Note:** `game.ts` is an orchestrator that manages server lifecycle, connections, and sessions. It bridges network layer with domain model and persistence. It defines core types (`LOGIN_STATE`, `LoginSession`) but also manages runtime state. **Needs decision: Core or Package?**

#### 5.1 `isNameBlocked` from `package/reservedNames.js`

**Import Location:** Line 35
```typescript
import { isNameBlocked } from "./package/reservedNames.js";
```

**Usage:**
- **Line 695**: Used during character creation to validate usernames
  ```typescript
  if (isNameBlocked(trimmed)) {
      // Reject blocked name
  }
  ```

**Category:** **Runtime Lookup / Validation**
- Checks if a name is in the reserved names list
- Runtime validation function
- Used for username validation during character creation

**Solution Type:** **Dependency Injection** (if game.ts is core)
- Pass validation function as parameter to methods that need it
- Or: Keep as package module (recommended - game.ts is an orchestrator)

---

#### 5.2 `CONFIG` from `package/config.js`

**Import Location:** Line 39
```typescript
import { CONFIG } from "./package/config.js";
```

**Usage:**
- **Line 123**: Stored in `Game` class as `private config = CONFIG;`
- Used throughout `Game` class for server configuration (port, timeouts, etc.)

**Category:** **Runtime Configuration**
- Accesses loaded configuration
- Used for server settings

**Solution Type:** **Dependency Injection** (if game.ts is core)
- Pass config object to `Game` constructor
- Or: Keep as package module (recommended - game.ts is an orchestrator)

---

#### 5.3 Character Package Functions from `package/character.js`

**Import Location:** Lines 40-49
```typescript
import {
	saveCharacter as saveCharacterFile,
	loadCharacter as loadCharacterFile,
	characterExists,
	isCharacterActive,
	registerActiveCharacter,
	unregisterActiveCharacter,
	checkCharacterPassword,
	loadCharacterFromSerialized,
} from "./package/character.js";
```

**Usage:** Used throughout `Game` class for:
- Character persistence (save/load)
- Character existence checks
- Active character tracking
- Authentication

**Category:** **Persistence / Runtime State Management**
- All are package-level operations

**Solution Type:** **Keep as Package Module** (recommended)
- `game.ts` should be considered a package module, not core
- It orchestrates runtime functionality
- If kept as core: extensive dependency injection needed

---

#### 5.4 Board Package Functions from `package/board.js`

**Import Location:** Line 50
```typescript
import { getBoards, loadBoards } from "./package/board.js";
```

**Usage:** Used for loading and accessing boards at runtime

**Category:** **Runtime State Management**

**Solution Type:** **Keep as Package Module** (recommended)

---

#### 5.5 GameState Functions from `package/gamestate.js`

**Import Location:** Line 52
```typescript
import { saveGameState, getNextCharacterId } from "./package/gamestate.js";
```

**Usage:** Used for saving game state and generating character IDs

**Category:** **Persistence / Runtime State Management**

**Solution Type:** **Keep as Package Module** (recommended)

---

#### 5.6 Dungeon Package Functions from `package/dungeon.js`

**Import Location:** Line 53
```typescript
import { executeAllDungeonResets } from "./package/dungeon.js";
```

**Usage:** Used to execute dungeon resets

**Category:** **Runtime Functionality**

**Solution Type:** **Keep as Package Module** (recommended)

---

#### 5.7 Archetype Package Functions from `package/archetype.js`

**Import Location:** Line 57
```typescript
import { getStarterRaces, getStarterJobs } from "./package/archetype.js";
```

**Usage:** Used for character creation (showing starter options)

**Category:** **Runtime Lookup**

**Solution Type:** **Keep as Package Module** (recommended)

---

#### 5.8 Help Package Functions from `package/help.js`

**Import Location:** Line 58
```typescript
import { getHelpfile, searchHelpfiles } from "./package/help.js";
```

**Usage:** Used for help system

**Category:** **Runtime Lookup**

**Solution Type:** **Keep as Package Module** (recommended)

---

## Categorization Summary

### Dependency Injection Required (Runtime Lookups)
1. `dungeon.ts` → `getNextObjectIdSync` - OID generation
2. `dungeon.ts` → `getAbilityById` - Ability lookup
3. `dungeon.ts` → `getDefaultRace`, `getDefaultJob`, `getRaceById`, `getJobById` - Archetype lookups
4. `character.ts` → `CONFIG.security.password_salt` - Password salt
5. `combat.ts` → `getLocation` - Location lookup

### Extract to Core (Constants)
1. `combat.ts` → `LOCATION` enum - Pure constant enum

### Remove from Core (Persistence)
1. `board.ts` → `saveBoard` - Persistence function

### Needs Classification
1. `game.ts` - Should be classified as package module (orchestrator) rather than core

---

## Next Steps

1. **Classify `game.ts`**: Decide if it's core or package (recommend: package)
2. **Extract constants**: Move `LOCATION` enum to core
3. **Remove persistence**: Remove `Board.save()` method
4. **Implement dependency injection**: Add optional parameters to core methods
5. **Update package modules**: Ensure packages provide dependencies when calling core

