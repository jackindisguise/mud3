# Utilities

This directory contains utility functions and helper modules used throughout the codebase.

## Purpose

Utility modules provide:
- **Reusable functions** - Common operations used across multiple modules
- **Type utilities** - TypeScript utility types
- **String manipulation** - Text processing helpers
- **Path utilities** - File path helpers

## Architecture Rules

### ✅ Allowed

- Define pure utility functions
- Define TypeScript utility types
- Import standard library modules (fs, path, etc.)
- Be imported by any other module

### ❌ Forbidden

- **DO NOT** depend on game-specific logic
- **DO NOT** import from `src/core/`, `src/registry/`, or `src/package/`
- **DO NOT** perform side effects (keep functions pure when possible)

## Key Modules

- `types.ts` - TypeScript utility types (e.g., `DeepReadonly`)
- `string.ts` - String manipulation helpers
- `path.ts` - Path resolution and directory helpers

## Examples

```typescript
// ✅ Good: Pure utility function
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ✅ Good: Type utility
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
```


