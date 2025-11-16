Templates exist as a kind of bootstrapped deeper classification of an object
below the type. Templates are the "type" of the game world. You can create a
"longsword" template that describes a longsword with a certain attack power,
a certain display string, a certain room description, a certain weight, etc.

Templates belong to dungeons, because they are made to occupy dungeons.
However, templates exist outside of dungeons in a sense that people can
people up objects that are made from these templates, and carry them around,
delete them, save and quit with them in their inventory, and then log in
and have them there again.

Furthermore, templates will be like an extension of the serialize/deserialize
system we've made. We can create a registry of the template's base serialized
form when loading the dungeon. Just like we do with base "types," we can create
base "templates." Then when we serialize an object, we can check for the templateId
field, grab the template, and use it as our base type INSTEAD OF the actual base type.

```typescript
// defined else
const baseTemplate = getTemplateById("@dungeon:longsword");
// the base template is kind of like a compressed serialization
// of the potential "longsword" object with the added "id" of the template
assert.deepEqual(baseTemplate, {
    id: "@dungeon:longsword",
    type: "Weapon",
    attackPower: 3
});

// if it makes life any easier, we can change it slightly.
assert.deepEqual(baseTemplate, {
    id: "@dungeon:longsword",
    serialization: {
        type: "Weapon",
        attackPower: 3
    }
});

// create an instance of the longsword template
const longsword = createFromTemplate(baseTemplate);
const serialized = longsword.serialize({compress:true});
assert.deepEqual(serialized, {
    // i really want to not have "id" be present
    // it is more elegant, and will be expanded into the full longsword
    // data set later on
    templateId: "@dungeon:longsword"
});
```