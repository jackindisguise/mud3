# Abilities

This directory contains ability implementations that can be learned and used by characters.

## Purpose

Ability modules:
- **Define special abilities** - Combat abilities, utility abilities, etc.
- **Implement ability logic** - Execute ability effects when used
- **Track proficiency** - Manage ability usage and proficiency progression

## Architecture Rules

### ✅ Allowed

- Import from `src/core/` for types and classes
- Import from `src/registry/` for readonly data access
- Import from `src/package/` for package functions (abilities are loaded at runtime)
- Import from `src/combat.ts` and other game systems
- Define ability effects and behavior

### ❌ Forbidden

- **DO NOT** perform file I/O operations
- **DO NOT** mutate registry state directly

## Module Structure

Each ability module **must** export:
- `ability` - An `Ability` object defining the ability's properties (id, name, description, proficiencyCurve)

Each ability module **may** optionally export:
- `command` - A `CommandObject`-compliant object that provides a command interface for using the ability

## Examples

```typescript
// ✅ Good: Ability with required export
import { Ability } from "../core/ability.js";

export const ability: Ability = {
  id: "whirlwind",
  name: "Whirlwind",
  description: "A spinning attack that hits all nearby enemies.",
  proficiencyCurve: [100, 200, 400, 800],
};
```

```typescript
// ✅ Good: Ability with optional command export
import { Ability } from "../core/ability.js";
import { CommandObject, CommandContext } from "../package/commands.js";

export const ability: Ability = {
  id: "whirlwind",
  name: "Whirlwind",
  description: "A spinning attack that hits all nearby enemies.",
  proficiencyCurve: [100, 200, 400, 800],
};

export const command: CommandObject = {
  pattern: "whirlwind~",
  execute(context: CommandContext): void {
    // Ability execution logic
  },
};
```

