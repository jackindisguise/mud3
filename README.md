# mud3 packages guide

This document covers the built-in packages under `src/package/` and shows how to use them together in your MUD server.

- Package loader target: each module exports a default object `{ name, loader, dependencies }` for composition with a package loader.
  - `name: string` — unique package identifier
  - `loader: () => Promise<void>` — async initializer
  - `dependencies?: Package[]` — optional array of other package objects (their default exports) that must be loaded first
- Standalone APIs: many packages also export helper functions or data for direct use.

## Quick start: running loaders

```ts
// app.ts (TypeScript / ESM)
import { loadPackage } from 'package-loader';
import commands from './src/package/commands.ts';
import config, { CONFIG } from './src/package/config.ts';
import lockfile from './src/package/lockfile.ts';
import character from './src/package/character.ts';

// Run packages in a simple sequence (recommended)
await loadPackage(lockfile);   // ensure single instance
await loadPackage(config);     // load config.yaml (creates default if missing)
await loadPackage(commands);   // load commands from data/commands/ and src/commands/
await loadPackage(character);  // prepare character storage directory

console.log('Server port:', CONFIG.server.port);
```

If you prefer dynamic discovery, you can wire these into your package loader of choice; each export conforms to `{ name: string, loader: () => Promise<void>, dependencies?: Package[] }`.

Note: Outside of tests, do not call `pkg.loader()` directly. Always use `loadPackage(pkg)` so ordering, errors, and lifecycle are handled consistently.

---

## package
### commands

Loads command modules from two locations at startup:

- `data/commands` (runtime-extensible JS commands)
- `dist/src/commands` (compiled built-in commands)

Only `.js` files are loaded; files beginning with `_` are ignored. The loader logs progress and registers commands into `CommandRegistry.default`.

#### Command shape

Each command module should export a default plain object:

```js
// data/commands/say.js
export default {
  pattern: 'say <...text:any>',
  aliases: ['"'],
  execute(ctx, args) {
    const text = args.get('text');
    ctx.client.sendLine(text);
  },
  onError(ctx, result) {
    ctx.client.sendLine(result.error ?? 'Could not parse command');
  }
};
```

#### Using the loader (via package-loader)

```ts
import { loadPackage } from 'package-loader';
import commands from './src/package/commands.ts';
await loadPackage(commands);
// Commands are now registered with CommandRegistry.default
```

Directory conventions:

- Put custom runtime commands in `data/commands/*.js`
- Built-in commands live in `src/commands/*.ts`

---

### config
#### YAML configuration loader

Loads `data/config.yaml` and merges it into a typed in-memory `CONFIG` object. If the file is absent or unreadable, a default is written to disk.

#### Shapes

```ts
export type GameConfig = { name: string; creator: string };
export type ServerConfig = { port: number; inactivity_timeout: number };
export type SecurityConfig = { password_salt: string };
export type Config = {
  game: GameConfig;
  server: ServerConfig;
  security: SecurityConfig;
};
```

#### Defaults and usage

```ts
import configPkg, { CONFIG } from './src/package/config.ts';
await loadPackage(configPkg);
console.log(CONFIG.server.port);
```

Example `data/config.yaml` you can customize:

```yaml
game:
  name: mud3
  creator: jackindisguise
server:
  port: 23
  inactivity_timeout: 1800
security:
  password_salt: changeme_default_salt_12345
```

Notes:

- Only known keys are merged; unknown keys are ignored.
- The loader logs which values come from defaults vs overrides.

---

### lockfile (single-instance process lock)

Ensures only one instance of the app runs by managing a `.lock` file in the project root. On startup the loader checks for an existing lock and whether the process associated with it is alive, removing stale locks automatically. It creates and cleans up the lock on exit.

#### Using the loader (via package-loader)

```ts
import { loadPackage } from 'package-loader';
import lockfile from './src/package/lockfile.ts';
await loadPackage(lockfile);
// Exits the process if another instance is running
```

#### Standalone utilities

You can also use helpers directly:

```ts
import { isProcessRunning, createLock, removeLock, checkLock } from './src/package/lockfile.ts';

if (await checkLock()) process.exit(1);
await createLock();
// ... later
await removeLock();
```

---

### character

Persists `Character` entities to `data/characters/<username>.yaml` and restores them back using `Character.serialize()`/`character.deserialize()`.

- Filenames are derived from a sanitized, lowercased username.
- On save, directories are created as needed; YAML is written without references and with a wide line width for readability.
- On load, returns `undefined` if the file doesn’t exist.

Active character registry (local lock): this package maintains a registry of usernames that are currently active. `loadCharacter()` refuses to load a character that’s already active and automatically registers loaded characters. The game calls `unregisterActiveCharacter(username)` on disconnect.

### API and usage

Example of declaring dependencies between packages:

```ts
// src/package/world.ts
import type { Package } from 'package-loader';
import config from './config.ts';
import character from './character.ts';

export default {
  name: 'world',
  dependencies: [config, character], // depends on config and character being loaded first
  loader: async () => {
    // initialization that requires CONFIG and character storage
  }
} as Package;
```

```ts
import { loadPackage } from 'package-loader';
import characterPkg, { saveCharacter, loadCharacter, isCharacterActive, unregisterActiveCharacter } from './src/package/character.ts';
import { Character } from './src/character.ts';

await loadPackage(characterPkg);

const player = new Character({ credentials: { username: 'Alice' } });
await saveCharacter(player);

const reloaded = await loadCharacter('Alice');
if (reloaded) {
  console.log('Loaded', reloaded.credentials.username);
}

// Later, on disconnect
unregisterActiveCharacter('Alice');
```

---

## Directory conventions summary

- `data/config.yaml` — game/server/security config (autocreated if missing)
- `data/commands/*.js` — runtime command modules
- `data/characters/*.yaml` — character saves
- `.lock` — process lock file (created/removed by lockfile package)

---

## Tips

- Logging: console logging is disabled during tests; file logs go to `logs/` with JSON lines. Set `LOG_LEVEL` to adjust console verbosity.