I want to re-imagine the serialization process entirely.

First of all, I think *serialized* versions of a DungeonObject should be an object that contains anything.

We will pick and choose what we want to load and how later on.

# Base Serialization
Each "type" of `DungeonObject` has a "base serialization" which contains all of the fields that are saved and loaded.
When you create a new `DungeonObject` and call `obj.serialize()`, this is the object that will be generated.

```typescript
// defined elsewhere and populated elsewhere
// const baseTypeSerialized: Map<DungeonObjectType, object> = new Map();

// example of how to use it
const baseDungeonObjectSerialized = baseTypeSerialized.get("DungeonObject");
const vanillaDungeonObject = new DungeonObject();
const vanillaDungeonObjectSerialized = vanillaDungeonObject.serialize();
assert.deepEqual(baseDungeonObjectSerialized, vanillaDungeonObjectSerialized) // true
assert.deepEqual(baseDungeonObjectSerialized, {
    type: "DungeonObject",
    keywords: "dungeon object",
    display: "Dungeon Object",
    description: undefined,
    roomDescription: undefined,
    mapText: undefined,
    mapColor: undefined,
}); // true
```

# Compressed Serialization
We'll add a flag to `serialize()` called `compress`.
When `serialize({compress: true})` is called, we will take the base serialized version of the object's type,
the current uncompressed serialized version of the object, and we will remove all the values that are equivalent from
the returned serialized form of the object.

```typescript
const baseDungeonObjectSerialized = baseTypeSerialized.get("DungeonObject"); // the base (default) serialization of the type
const vanillaDungeonObject = new DungeonObject(); // an object with no changes
const compressed = vanillaDungeonObject.serialize({compress:true}); // create a compressed serialization
assert.deepEqual(compressed, {
    type: "DungeonObject"
})

vanillaDungeonObject.display = "changed"; // make a change
const changed = vanillaDungeonObject.serialize({compress:true}); // serialize again
assert.deepEqual(compressed, {
    type: "DungeonObject",
    display: "changed"
})
```

What this tells us is if we get the base serialization and lay this serialized form on top of it,
we'll have identical objects.