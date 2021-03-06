

# Propagating Failure

Sometimes as you're threading values through a processing pipeline it can be
convenient to have a way to say 'if this computation fails, then none of the
others should even be attempted. Just propagate the failure.'

Here's how to do that.

```typescript
import { atom } from 'derivable'

const word = atom("hello");

const toUpper = x => x.toUpperCase();
const spacedOut = x => x.split("").join(" ");

let upper = word.derive(toUpper);
let spaced = upper.derive(spacedOut);

console.log(spaced.get()); 
// $> H E L L O

word.set(null);

try {
  spaced.get();
} catch (e) {
  console.log(e); 
// $> [TypeError: Cannot read property 'toUpperCase' of null]
}
```


To avoid this we can wrap the uppercasing function in another function which
checks for null values and propagates them instead of calling the
function on them. This way the error never gets thrown.

```typescript
function maybe (f) {
  return x => {
    if (x == null) {
      return null;
    } else {
      return f(x);
    }
  }
}

upper = word.derive(maybe(toUpper));
spaced = upper.derive(maybe(spacedOut));

console.log(spaced.get()); 
// $> null

// The nullness of `word` is pulled down through `upper` and `spaced`.

word.set("jeff");

console.log(spaced.get()); 
// $> J E F F
```


But sometimes a derivation function might throw errors even with non-null inputs.
You could propagate the error using a similar technique:

```typescript
function maybeE (f) {
  return x => {
    if (x instanceof Error) {
      return x;
    } else {
      try {
        return f(x);
      } catch (e) {
        return e;
      }
    }
  }
}

upper = word.derive(maybeE(toUpper));
spaced = upper.derive(maybeE(spacedOut))

console.log(spaced.get()); 
// $> J E F F

word.set(null);

console.log(spaced.get()); 
// $> [TypeError: Cannot read property 'toUpperCase' of null]
```


So `spaced.get()` is actually returning the error there, not throwing it.

You can use the same wrappers for reactors:

```typescript
let reactor = spaced.react(maybeE(spaced => console.log("word: " + spaced))); 
// ... no output

word.set("ablution"); 
// $> word: A B L U T I O N

word.set([]); 
// ... no output

word.set("convivial"); 
// $> word: C O N V I V I A L
```


The wrappers compose too:

```typescript
const m = f => maybe(maybeE(f));

upper = word.derive(m(toUpper));
spaced = upper.derive(m(spacedOut));

reactor.stop();
reactor = spaced.react(m(spaced => console.log("word: " + spaced))); 
// $> word: C O N V I V I A L

word.set("bananas"); 
// $> word: B A N A N A S

word.set(null); // caught by maybe 
// ... no output

word.set([]); // caught by maybeE 
// ... no output
```


Multi-arity versions left as an exercise for the reader.
