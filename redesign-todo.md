# Redesign Implementation Todo

This document outlines the step-by-step plan to separate core modules from package modules without breaking functionality.

## Phase 1: Analysis and Planning

- [ ] **1.1** Document all current violations
  - [ ] Create a list of all core modules that import from `package/`
  - [ ] Document what each import is used for
  - [ ] Identify which are runtime lookups vs constants vs pure functions

- [ ] **1.2** Categorize violations by solution type
  - [ ] **Dependency Injection**: Runtime lookups that need to be passed in
  - [ ] **Extract Constants**: Constants that should move to core
  - [ ] **Remove Persistence**: Save/load calls that should be removed from core
  - [ ] **Callback Pattern**: Functions that need provider/callback interfaces

## Phase 2: Fix Core Module Violations

### 2.1 Fix `dungeon.ts`

- [ ] **2.1.1** Remove `getNextObjectIdSync` dependency
  - [ ] Add optional `oidProvider?: () => number` parameter to `DungeonObject` constructor
  - [ ] Use provider if provided, otherwise use `getNextObjectIdSync` (backward compat)
  - [ ] Update all `new DungeonObject()` calls to pass provider from package layer
  - [ ] Remove import of `getNextObjectIdSync` from `dungeon.ts`

- [ ] **2.1.2** Remove `getAbilityById` dependency
  - [ ] Add optional `abilityLookup?: (id: string) => Ability | undefined` parameter to methods that need it
  - [ ] Update `Mob.useAbilityById()` to accept optional lookup function
  - [ ] Pass lookup function from package layer when calling these methods
  - [ ] Remove import of `getAbilityById` from `dungeon.ts`

- [ ] **2.1.3** Remove archetype lookup dependencies
  - [ ] `getRaceById`, `getJobById`, `getDefaultRace`, `getDefaultJob` are runtime lookups
  - [ ] Add optional parameters to `Mob` constructor for default race/job
  - [ ] Update `Mob` methods that use these to accept optional lookup functions
  - [ ] Update `Dungeon.deserializeMob()` to accept optional lookup functions
  - [ ] Remove imports from `dungeon.ts`

### 2.2 Fix `character.ts`

- [ ] **2.2.1** Remove `CONFIG` dependency
  - [ ] Extract `CONFIG.security.password_salt` usage
  - [ ] Add optional `passwordSalt?: string` parameter to `Character.setPassword()` and `Character.hashPassword()`
  - [ ] Pass salt from package layer when calling these methods
  - [ ] Remove import of `CONFIG` from `character.ts`

### 2.3 Fix `board.ts`

- [ ] **2.3.1** Remove `saveBoard` dependency
  - [ ] Remove `Board.save()` method (persistence should be handled by package)
  - [ ] Remove `saveBoard` import from `board.ts`
  - [ ] Update `Board.markMessageAsRead()` to not call `save()` directly
  - [ ] Package layer should call save after marking as read

### 2.4 Fix `combat.ts`

- [ ] **2.4.1** Handle `LOCATION` enum and `getLocation` dependency
  - [ ] Move `LOCATION` enum to core (it's a constant enum, not runtime)
  - [ ] Create new core file `src/location.ts` with `LOCATION` enum
  - [ ] Update `combat.ts` to import `LOCATION` from core
  - [ ] Remove `getLocation` usage or pass as parameter to functions that need it
  - [ ] Remove import of `getLocation` from `combat.ts`

## Phase 3: Extract Constants to Core

- [ ] **3.1** Create `src/location.ts` for location constants
  - [ ] Move `LOCATION` enum from `package/locations.ts` to `src/location.ts`
  - [ ] Update `package/locations.ts` to re-export from core
  - [ ] Update all imports of `LOCATION` to import from core

- [ ] **3.2** Review other constants
  - [ ] Check if any other constants in packages should be in core
  - [ ] Move pure constants (enums, default values) to appropriate core modules

## Phase 4: Update Package Modules

- [ ] **4.1** Update `package/dungeon.ts`
  - [ ] Ensure it provides lookup functions to core when needed
  - [ ] Update any code that creates `DungeonObject` instances to pass `oidProvider`
  - [ ] Update any code that calls `Mob` methods to pass lookup functions

- [ ] **4.2** Update `package/character.ts`
  - [ ] Ensure it passes `passwordSalt` from `CONFIG` when calling `Character.setPassword()`
  - [ ] Update all character creation/loading code

- [ ] **4.3** Update `package/board.ts`
  - [ ] Ensure it handles saving after `Board.markMessageAsRead()` calls
  - [ ] Update all code that modifies boards to handle persistence

- [ ] **4.4** Update `package/archetype.ts`
  - [ ] Ensure it provides lookup functions to core when needed
  - [ ] Update any code that creates `Mob` instances to pass default race/job

- [ ] **4.5** Update `package/abilities.ts`
  - [ ] Ensure it provides lookup functions to core when needed

- [ ] **4.6** Update `package/locations.ts`
  - [ ] Re-export `LOCATION` from core
  - [ ] Update internal usage

## Phase 5: Update Game Orchestrator

- [ ] **5.1** Review `game.ts` classification
  - [ ] Determine if `game.ts` should be considered core or package
  - [ ] If core: apply same rules (no package imports)
  - [ ] If package: document as exception or move to `package/` directory

- [ ] **5.2** Update `game.ts` if needed
  - [ ] If keeping as core: refactor to use dependency injection
  - [ ] If moving to package: update imports and structure

## Phase 6: Update Commands and Abilities

- [ ] **6.1** Document exception status
  - [ ] Confirm `src/commands/` and `src/abilities/` are exception modules
  - [ ] Document that they can import from packages (they're loaded by packages)

- [ ] **6.2** Verify no circular dependencies
  - [ ] Ensure commands/abilities don't create circular imports
  - [ ] Fix any issues found

## Phase 7: Testing and Validation

- [ ] **7.1** Run test suite
  - [ ] Ensure all existing tests pass
  - [ ] Fix any broken tests

- [ ] **7.2** Manual testing
  - [ ] Test character creation and login
  - [ ] Test dungeon object creation
  - [ ] Test ability usage
  - [ ] Test board operations
  - [ ] Test combat and location features

- [ ] **7.3** Verify no package imports in core
  - [ ] Run grep to verify no `import.*from.*package` in core modules
  - [ ] Document any remaining exceptions with justification

- [ ] **7.4** Verify dependency direction
  - [ ] Core modules only import from other core modules
  - [ ] Package modules can import from core
  - [ ] Commands/abilities can import from packages (exception)

## Phase 8: Documentation

- [ ] **8.1** Update module documentation
  - [ ] Document which modules are core vs package
  - [ ] Document the dependency rules
  - [ ] Document exception modules and why they're exceptions

- [ ] **8.2** Update code comments
  - [ ] Add comments explaining dependency injection patterns
  - [ ] Document why certain functions accept optional parameters

## Phase 9: Cleanup

- [ ] **9.1** Remove unused imports
  - [ ] Clean up any imports that are no longer needed

- [ ] **9.2** Refactor for consistency
  - [ ] Ensure consistent patterns across all modules
  - [ ] Standardize parameter naming (e.g., `lookup`, `provider`)

## Notes

- **Dependency Injection Strategy**: Use optional parameters with default behavior for backward compatibility during transition
- **Testing Strategy**: Test incrementally after each module fix
- **Breaking Changes**: Avoid breaking changes by using optional parameters and defaults
- **Exception Modules**: `src/commands/` and `src/abilities/` are explicitly exception modules that can import from packages

