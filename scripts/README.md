# Scripts

This directory contains utility scripts used for building, testing, and maintaining the project.

## Purpose

Scripts in this directory are run independently and perform various tasks:
- **Build scripts** - Generate icons, package applications
- **Test scripts** - Run test suites with different configurations
- **Deployment scripts** - Post-release artifacts, create distributions
- **Development tools** - Setup debugging, manage test runs

## Key Scripts

- `test.js` - Run JavaScript tests
- `test-ts.js` - Run TypeScript tests with source maps
- `test-individual.js` - Run individual test files for easier debugging
- `generate-icon.cjs` - Generate application icons from SVG
- `post-changelog-to-board.js` - Post changelog to message board
- `post-mac-dir.js` - Post macOS distribution artifacts
- `post-win-portable.js` - Post Windows portable distribution
- `setup-debug-logging.js` - Configure debug logging
- `keep-alive.js` - Monitor game server and automatically restart on crash

## Usage

Scripts are typically run via npm scripts defined in `package.json`:

```bash
npm run test
npm run test:ts
npm run test:individual:ts
```

Or directly with Node.js:

```bash
node scripts/test.js
node scripts/test-ts.js
```

## Keep-Alive Script

The `keep-alive.js` script monitors the game server process and automatically restarts it if it crashes or exits unexpectedly. It provides:

- **Automatic restart** - Restarts the server after crashes or unexpected exits
- **Rate limiting** - Prevents restart loops (max 5 restarts per minute)
- **Graceful shutdown** - Handles SIGINT/SIGTERM signals properly
- **Intentional shutdown detection** - Does not restart when server exits with code 2 (intentional shutdown via shutdown command)

Run with:
```bash
npm run start:keep-alive
```

## Notes

- These scripts are separate from `src/scripts/` which contains TypeScript source modules
- Scripts may use CommonJS (`.cjs`) or ES modules (`.js`) depending on their needs
- Some scripts are used during the Electron build process

