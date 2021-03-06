import _, {atom, derive, derivation, transact} from '../dist/derivable';
import assert from 'assert';
import { fromJS } from 'immutable'
import { label } from './util';

describe("a derivation", () => {
  const oneGigabyte = 1024 * 1024 * 1024;
  const bytes = atom(oneGigabyte);
  let kiloBytes, megaBytes;

  const orderUp = (n, order=1) => {
    return order > 0 ? orderUp(n / 1024, order-1) : n
  };

  it("can be created via the Atom.derive(f) method", () => {
    kiloBytes = bytes.derive(orderUp);
    assert.strictEqual(kiloBytes.get(), 1024 * 1024)
  });

  it("can also be created via the derivation function in the derivable package", () => {
    megaBytes = derivation(() => orderUp(kiloBytes.get()));
    assert.strictEqual(megaBytes.get(), 1024);
  });

  it("can derive from more than one atom", () => {
    const order = label(atom(0), "O");
    const orderName = label(order.derive(order => {
      return (["bytes", "kilobytes", "megabytes", "gigabytes"])[order];
    }), "ON");
    const size = label(bytes.derive(orderUp, order), "!size!");
    const sizeString = derive`${size} ${orderName}`;

    assert.strictEqual(size.get(), bytes.get(), "size is in bytes when order is 0");
    assert.strictEqual(sizeString.get(), bytes.get() + " bytes");
    order.set(1);
    assert.strictEqual(size.get(), kiloBytes.get(), "size is in kbs when order is 1");
    assert.strictEqual(sizeString.get(), kiloBytes.get() + " kilobytes");
    order.set(2);
    assert.strictEqual(size.get(), megaBytes.get(), "size is in mbs when order is 2");
    assert.strictEqual(sizeString.get(), megaBytes.get() + " megabytes");
    order.set(3);
    assert.strictEqual(size.get(), 1, "size is in gbs when order is 2");
    assert.strictEqual(sizeString.get(), "1 gigabytes");
  });

  it("implements the derivable interface", () => {
    let name = atom("smithe");
    let size6 = name.derive(x => x.length === 6);
    let startsWithS = name.derive(x => x[0] === "s");
    let endsWithE = name.derive(x => x[x.length-1] === "e");

    assert.strictEqual(size6.get(), true, "has length 6");
    assert.strictEqual(startsWithS.get(), true, "starts with s");
    assert.strictEqual(endsWithE.get(), true, "ends wth e");

    let isSmithe = name.is(atom("smithe"));

    assert.strictEqual(isSmithe.get(), true, "is smithe");

    let size6orE = size6.or(endsWithE);
    let size6andE = size6.and(endsWithE);
    let sOrE = startsWithS.or(endsWithE);
    let sAndE = startsWithS.and(endsWithE);

    assert.strictEqual(size6orE.get(), true);
    assert.strictEqual(size6andE.get(), true);
    assert.strictEqual(sOrE.get(), true);
    assert.strictEqual(sAndE.get(), true);

    name.set("smithy");

    assert.strictEqual(size6.get(), true, "has length 6");
    assert.strictEqual(startsWithS.get(), true, "starts with s");
    assert.strictEqual(endsWithE.get(), false, "ends wth y");

    assert.strictEqual(isSmithe.get(), false, "is not smithe");

    assert.strictEqual(size6orE.get(), true);
    assert.strictEqual(size6andE.get(), false);
    assert.strictEqual(sOrE.get(), true);
    assert.strictEqual(sAndE.get(), false);

    assert.strictEqual(size6orE.not().get(), false);
    assert.strictEqual(size6andE.not().get(), true);
    assert.strictEqual(sOrE.not().get(), false);
    assert.strictEqual(sAndE.not().get(), true);

    assert.strictEqual(size6orE.not().not().get(), true);
    assert.strictEqual(size6andE.not().not().get(), false);
    assert.strictEqual(sOrE.not().not().get(), true);
    assert.strictEqual(sAndE.not().not().get(), false);

    assert.strictEqual(name.derive('length').get(), 6);
    assert.strictEqual(name.derive(0).get(), "s");

    let x = startsWithS.then(
      () => assert(true, "smithy starts with s"),
      () => assert(false, "smithy what?")
    ).get()();


    endsWithE.then(
      () => assert(false, "smithy doesn't end in e?!"),
      () => assert(true, "smithy ends in y yo")
    ).get()();

    let firstLetter = name.derive(x => x[0]);

    firstLetter.switch(
      "a", () => assert(false, "smithy doesn't start with a"),
      "b", () => assert(false, "smithy doesn't start with b"),
      "s", () => assert(true, "smithy starts with s")
    ).get()();

    it("allows a default value", done => {
      firstLetter.switch(
        "a", () => assert(false, "smithy doesn't start with a"),
        "b", () => assert(false, "smithy doesn't start with b"),
        "x", "blah",
        () => assert(true, "yay")
      ).get()();
    });

    const nonexistent = atom(null);
    assert(nonexistent.mThen(false, true).get(), "null doesn't exist");

    nonexistent.set(false);
    assert(nonexistent.mThen(true, false).get(), "false exists");

    nonexistent.set(void 0);
    assert(nonexistent.mThen(false, true).get(), "undefined doesn't exist");

    nonexistent.set("");
    assert(nonexistent.mThen(true, false).get(), "the empty string exists");

    nonexistent.set(0);
    assert(nonexistent.mThen(true, false).get(), "zero exists");


    const nestedStuff = atom(fromJS({a: {b: {c: false}}}));
    const get = (x, y) => x.get(y);
    const innermost = nestedStuff.mDerive(get, 'a')
                                 .mDerive(get, 'b')
                                 .mDerive(get, 'c')
                                 .mOr('not found');

    assert.strictEqual(innermost.get(), false);

    nestedStuff.set(fromJS({a: {b: {c: 'found'}}}));

    assert.strictEqual(innermost.get(), 'found');

    nestedStuff.set(fromJS({a: {b: {d: 'd'}}}));

    assert.strictEqual(innermost.get(), 'not found');

    nestedStuff.set(fromJS({a: {d: {d: 'd'}}}));

    assert.strictEqual(innermost.get(), 'not found');

    nestedStuff.set(fromJS({d: {d: {d: 'd'}}}));

    assert.strictEqual(innermost.get(), 'not found');

    nestedStuff.set(null);

    assert.strictEqual(innermost.get(), 'not found');

    const thingOr = nestedStuff.mOr('not there');
    assert.strictEqual(thingOr.get(), 'not there');

    nestedStuff.set(false);
    assert.strictEqual(thingOr.get(), false);

    const thingAnd = nestedStuff.mAnd('yes there');

    assert.strictEqual(thingAnd.get(), 'yes there');

    nestedStuff.set(null);

    assert.strictEqual(thingAnd.get(), null);
  });

  it('can be re-instantiated with custom equality-checking', () => {
    const a = atom(5);
    const amod2map = a.derive(a => ({a: a % 2}));

    let numReactions = 0;
    amod2map.reactor(() => numReactions++).start();

    assert.strictEqual(numReactions, 0);
    a.set(7);
    assert.strictEqual(numReactions, 1);
    a.set(9);
    assert.strictEqual(numReactions, 2);
    a.set(11);
    assert.strictEqual(numReactions, 3);

    const amod2map2 = a
      .derive(a => ({a: a % 2}))
      .withEquality(({a: a}, {a: b}) => a === b);

    let numReactions2 = 0;
    amod2map2.reactor(() => numReactions2++).start();

    assert.strictEqual(numReactions2, 0);
    a.set(7);
    assert.strictEqual(numReactions2, 0);
    a.set(9);
    assert.strictEqual(numReactions2, 0);
    a.set(11);
    assert.strictEqual(numReactions2, 0);
  });
});

describe("the derive method", () => {
  it("'pluck's when given a string or derivable string", () => {
    const obj = atom({nested: 'nested!', other: 'also nested!'});

    const nested = obj.derive('nested');
    assert.strictEqual(nested.get(), 'nested!');

    const prop = atom('nested');
    const item = obj.derive(prop);
    assert.strictEqual(item.get(), 'nested!');
    prop.set('other')
    assert.strictEqual(item.get(), 'also nested!');
  });
  it("also 'pluck's when given a number or derivable number", () => {
    const arr = atom([1,2,3]);

    const middle = arr.derive(1);
    assert.strictEqual(middle.get(), 2);

    const cursor = atom(0);
    const item = arr.derive(cursor);

    assert.strictEqual(item.get(), 1);
    cursor.set(1);
    assert.strictEqual(item.get(), 2);
    cursor.set(2);
    assert.strictEqual(item.get(), 3);
  });

  it("uses RegExp objects to do string matching", () => {
    const string = atom("this is a lovely string");
    const words = string.derive(/\w+/g);

    assert.deepEqual(words.get(), ['this', 'is', 'a', 'lovely', 'string']);

    const firstLetters = string.derive(/\b\w/g);
    assert.deepEqual(firstLetters.get(), ['t', 'i', 'a', 'l', 's']);

    string.set("you are so kind");
    assert.deepEqual(firstLetters.get(), ['y', 'a', 's', 'k']);
  });

  it("destructures derivables", () => {
    const s = atom({a: "aye", b: "bee", c: "cee"});
    let [a, b, c] = s.derive(['a', 'b', 'c']);

    assert.strictEqual(a.get(), "aye");
    assert.strictEqual(b.get(), "bee");
    assert.strictEqual(c.get(), "cee");

    // swap a and c over

    const aKey = atom('c');
    const cKey = atom('a');
    [a, b, c] = s.derive([aKey, 'b', cKey]);

    assert.strictEqual(a.get(), "cee");
    assert.strictEqual(b.get(), "bee");
    assert.strictEqual(c.get(), "aye");

    aKey.set('a');
    cKey.set('c');

    assert.strictEqual(a.get(), "aye");
    assert.strictEqual(b.get(), "bee");
    assert.strictEqual(c.get(), "cee");

    const arr = atom(['naught','one','two']);
    const [naught, one, two] = arr.derive([0, 1, atom(2)]);

    assert.strictEqual(naught.get(), "naught");
    assert.strictEqual(one.get(), "one");
    assert.strictEqual(two.get(), "two");

    arr.set(['love', 'fifteen', 'thirty']);

    assert.strictEqual(naught.get(), "love");
    assert.strictEqual(one.get(), "fifteen");
    assert.strictEqual(two.get(), "thirty");
  });

  it('can also do destructuring with regexps etc', () => {
    const string = atom("you are so kind");

    const [firstLetters, len, lastWord, firstChar] = string.derive([
      /\b\w/g,
      'length',
      s => s.split(' ').pop(),
      0
    ]);

    assert.deepEqual(firstLetters.get(), ['y', 'a', 's', 'k']);
    assert.strictEqual(len.get(), 15);
    assert.strictEqual(lastWord.get(), 'kind');
    assert.strictEqual(firstChar.get(), 'y');

    string.set('thank you');

    assert.deepEqual(firstLetters.get(), ['t', 'y']);
    assert.strictEqual(len.get(), 9);
    assert.strictEqual(lastWord.get(), 'you');
    assert.strictEqual(firstChar.get(), 't');
  })
});

describe("mDerive", () => {
  it('is like derive, but propagates nulls', () => {
    const thing = atom({prop: 'val'});
    const val = thing.mDerive('prop');

    assert.strictEqual(val.get(), 'val');
    thing.set(null);
    assert.equal(val.get(), null);

    const [foo, bar] = thing.mDerive(['foo', 'bar']);

    assert.equal(foo.get(), null);
    assert.equal(bar.get(), null);

    thing.set({foo: 'FOO!', bar: 'BAR!'});

    assert.strictEqual(foo.get(), 'FOO!');
    assert.strictEqual(bar.get(), 'BAR!');
  });
});

describe("the disowning bug", () => {
  // a node is disowned when its parents haven't changed
  // but it wasn't dereferenced during the latest react phase
  it("used to occur when the disowned child's parents hadn't changed", () => {
    var root = atom(0);
    var parent = root.derive(x => x % 2)
    var child = parent.derive(x => x);

    assert.strictEqual(child.get(), 0);

    parent.react(x => x); // force parent to get turned to stable

    root.set(2);

    assert.strictEqual(child._state, 6); // disowned

    assert.strictEqual(child.get(), 0);

    assert.strictEqual(child._state, 2); // unchanged

    // when the bug existed, the child was no longer in the parent's child set
    // so the following tests failed
    root.set(4);
    assert.strictEqual(child._state, 6); // disowned
    assert.strictEqual(child.get(), 0);
    assert.strictEqual(child._state, 2); // unchanged
    root.set(3);
    assert.strictEqual(child.get(), 1);

  })
});


describe("derivations inside a transaction", () => {
  it("can take on temporary values", () => {
    const a = atom(0);
    const plusOne = a.derive(a => a + 1);

    assert.strictEqual(plusOne.get(), 1);

    transact(abort => {
      a.set(1);
      assert.strictEqual(plusOne.get(), 2);
      abort();
    });

    assert.strictEqual(plusOne.get(), 1);

    let thrown = null;
    try {
      transact(() => {
        a.set(2);
        assert.strictEqual(plusOne.get(), 3);
        throw "death";
      });
    } catch (e) {
      thrown = e;
    }

    assert.strictEqual(thrown, "death");
    assert.strictEqual(plusOne.get(), 1);
  });
});
