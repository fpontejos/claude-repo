# Utility Libraries

## Lodash

```js
import _ from "lodash";
```

```js
// Collections
_.groupBy([{name:"Alice",dept:"Eng"},{name:"Bob",dept:"Eng"},{name:"Carol",dept:"Design"}], "dept");
// { Eng: [{...},{...}], Design: [{...}] }

_.chunk([1,2,3,4,5], 2);          // [[1,2],[3,4],[5]]
_.flatten([[1,2],[3,[4,5]]]);      // [1,2,3,[4,5]]
_.flattenDeep([[1,[2,[3]]]]]);     // [1,2,3]
_.uniq([1,2,2,3,3]);               // [1,2,3]
_.sortBy(users, ["dept","name"]);
_.orderBy(users, ["age"], ["desc"]);

// Objects
_.merge({a:1}, {b:2});             // {a:1, b:2}
_.pick(obj, ["name","age"]);
_.omit(obj, ["password"]);
_.cloneDeep(obj);                  // deep clone
_.get(obj, "a.b.c", "default");
_.set(obj, "a.b.c", 42);

// Functions
const search = _.debounce(fn, 300);
const expensive = _.throttle(fn, 1000);
const memoized = _.memoize(fn);
_.once(fn);                        // call only once

// Strings
_.camelCase("foo bar");            // "fooBar"
_.kebabCase("fooBar");             // "foo-bar"
_.capitalize("hello world");       // "Hello world"
_.truncate("long string", { length: 20 });

// Numbers
_.clamp(value, min, max);
_.random(1, 10);
_.sum([1,2,3,4]);                  // 10
_.mean([1,2,3,4]);                 // 2.5
```
