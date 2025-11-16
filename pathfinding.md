So given 3 dungeons of a size 3x3x1, we link them like so:

```
AAA BBB-CCC
AAA BBB CCC
AAA-BBB CCC
```

tile @A{2,2,0} links eastward to @B{0,2,0}
tile @B{2,0,0} links eastward to @C{0,0,0}

Given room @A{0,0,0} and @C{2,2,0}, this
should find the set of steps you have to take.

In this case, it'd be [s,s,s,e,e,e,n,n,n,e,e,e] I think.

None of the functions you gave me seem to be doing this.