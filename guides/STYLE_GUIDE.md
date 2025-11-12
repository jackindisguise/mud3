# Style Guide
Follow these rules when generating codes, responses, and comments.

## Do:
### Code
1. When creating a Set/Map/array/object that represents data that should not change, make sure it is typed as Readonly/ReadonlyMap/ReadonlyArray/etc.
    1. If I have an object that is meant to represent the default state of an object, it should be immutable.
    2. Do not overdo it. Just create TypeScript limitations. If someone wants to edit an array or object by casting it to `any`, I don't really care. That's on them.
2. Clients terminals only support ASCII ([ !"#$%&'()*+,\-./0-9:;<=>?@A-Z\[\\\]^_`a-z{|}~]). Never send characters outside that set. Make do with what you have.
3. Ensure you are always aware of what the color escape character is and how it operates.
4. Messages to client always use \r\n (telnet.LINEBREAK) and never \n.

#### Character Commands
1. Buffer input lines and send them all at the end.

### Comments
1. Add JSDoc style comments when generating code.
2. Don't over-comment types. TypeDoc can figure out types on its own. Only do it when it's necessary in TypeDoc.
3. Include example segments in documentation to ensure users know how to use things at a glance.

## Do NOT:
### Code
1. Use emojis.
2. Use generic linebreak (\n).

#### Character Commands
1. Use Character.send, Character.sendLine

### Comments
1. Write comments that focus on recent requests. If I ask you to add a feature, add a comment that directly references the fact that I just asked you to add that feature.
2. Use emojis.