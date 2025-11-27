# Logs

This directory contains application log files generated during runtime.

## Purpose

Log files record:
- **Application events** - Game events, state changes, user actions
- **Error messages** - Exceptions, stack traces, error conditions
- **Debug information** - Detailed diagnostic information
- **Performance metrics** - Timing data, resource usage

## Structure

Logs are organized by date in subdirectories:
- `YYYY-MM-DD/` - Daily log directories
  - `app-*.log` - Application log files
  - `error-*.log` - Error log files

## Log Files

- `app-*.log` - General application logs with INFO, DEBUG, WARN levels
- `error-*.log` - Error logs with ERROR and FATAL levels

## Log Rotation

Log files are rotated based on:
- File size limits
- Time-based rotation (daily)
- Process restarts

## Notes

- Log files are automatically created during runtime
- Old log files may be cleaned up periodically
- Log format is configurable via the logger configuration
- Logs should not be committed to version control (typically in `.gitignore`)


