# Dungeon Save/Load Format

## Overview

Dungeons are saved as YAML files with a grid-based room layout. Each room in the grid is represented by a number that references a room template in a `rooms` list. The number `0` represents an empty cell (no room).

## YAML Structure

```yaml
dungeon:
  id: "my-dungeon"                    # Optional: unique identifier
  dimensions:
    width: 5                           # X-axis (east-west)
    height: 5                          # Y-axis (north-south)
    layers: 1                          # Z-axis (up-down)
  
  grid:
    # Each layer is a 2D grid (array of rows)
    # Each row is an array of numbers
    # 0 = empty cell, 1+ = template index (1-based)
    - # Layer 0 (bottom layer)
      - [1, 1, 1, 0, 0]               # Row 0 (y=0)
      - [1, 2, 1, 0, 0]               # Row 1 (y=1)
      - [1, 1, 1, 0, 0]               # Row 2 (y=2)
      - [0, 0, 0, 0, 0]               # Row 3 (y=3)
      - [0, 0, 0, 0, 0]               # Row 4 (y=4)
    # Additional layers would go here
  
  rooms:
    # Room template indices are 1-based (1, 2, 3, ...)
    # Index 0 is reserved for empty cells
    - # Template 1
      keywords: "corridor hallway"
      display: "Corridor"
      description: "A long, narrow corridor."
    
    - # Template 2
      keywords: "chamber room"
      display: "Large Chamber"
      description: "A spacious chamber with stone walls."
```

## Format Details

### Grid Layout

- **Layers**: The `grid` array contains one element per layer (z-axis), ordered from bottom (z=0) to top
- **Rows**: Each layer is an array of rows (y-axis), ordered from north (y=0) to south
- **Columns**: Each row is an array of numbers (x-axis), ordered from west (x=0) to east
- **Numbers**: 
  - `0` = empty cell (no room at this coordinate)
  - `1`, `2`, `3`, ... = room template index (1-based, refers to position in `rooms` array)

### Room Templates

- Room templates are stored in a `rooms` array
- Template indices are **1-based** (first template is index 1, not 0)
- Each template can define any room properties (keywords, display, description, etc.)
- Only fields that differ from defaults are stored (as per template system)
- Do not include `{ type: "Room" }`. It's redundant. Similar to Character mobs losing the type field.
- Do not assign an id to the template, because its position in the rooms grid is its identifier.

### Coordinate Mapping

The grid structure maps to coordinates as follows:
- `grid[z][y][x]` → Room at `{ x, y, z }`
- Example: `grid[0][1][2]` → Room at `{ x: 2, y: 1, z: 0 }`

## Example: Simple 3x3 Dungeon

```yaml
dungeon:
  id: "test-dungeon"
  dimensions:
    width: 3
    height: 3
    layers: 1
  
  grid:
    - # Layer 0
      - [1, 1, 1]                     # y=0: corridor, corridor, corridor
      - [1, 2, 1]                     # y=1: corridor, chamber, corridor
      - [1, 1, 1]                     # y=2: corridor, corridor, corridor
  
  rooms:
    - display: "Corridor"
      description: "A narrow corridor."
    
    - display: "Chamber"
      description: "A large chamber."
```

## Example: Multi-Layer Dungeon

```yaml
dungeon:
  id: "tower"
  dimensions:
    width: 2
    height: 2
    layers: 3
  
  grid:
    - # Ground floor (z=0)
      - [1, 1]
      - [1, 1]
    - # Second floor (z=1)
      - [2, 2]
      - [2, 2]
    - # Third floor (z=2)
      - [3, 0]                        # Only one room on top floor
      - [0, 0]
  
  rooms:
    - display: "Ground Floor"
      description: "The ground floor of the tower."
    
    - display: "Second Floor"
      description: "The second floor of the tower."
    
    - display: "Third Floor"
      description: "The top floor of the tower."
```

## Loading Process

1. Parse YAML file
2. Create `Dungeon` with specified dimensions
3. For each non-zero value in grid:
   - Get room template index (1-based)
   - Look up template in `rooms` array (convert to 0-based: `templateIndex - 1`)
   - Create room using `Room.createFromTemplate(template, coordinates)`
   - Add room to dungeon at the appropriate coordinates
4. Return populated dungeon

## Saving Process

1. Get dungeon dimensions
2. Build `rooms` list by collecting unique room templates
3. Build grid by iterating through all coordinates:
   - If room exists: find its template index in `rooms` list (1-based)
   - If no room: use 0
4. Serialize to YAML format
