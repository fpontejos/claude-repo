# Math / Science Libraries

## MathJS

```js
import * as math from "mathjs";
```

```js
// Expression evaluation
math.evaluate("sqrt(3^2 + 4^2)")       // 5
math.evaluate("factorial(6)")           // 720
math.evaluate("sin(pi/2)")             // 1
math.evaluate("det([[1,2],[3,4]])")    // -2
math.evaluate("2 inch to cm")          // 5.08 cm (unit conversion)

// Matrix operations
const m = math.matrix([[1,2],[3,4]]);
math.inv(m);          // inverse
math.transpose(m);    // transpose
math.multiply(m, m);  // matrix multiplication

// Symbolic / parsing
const expr = math.parse("2x^2 + 3x + 1");
const f = expr.compile();
f.evaluate({ x: 5 }); // 66

// Statistics
math.mean([1,2,3,4,5]);   // 3
math.std([1,2,3,4,5]);    // 1.58...
math.median([1,2,3,4,5]); // 3
```

> ⚠️ Call `math.evaluate()` inside a component or `useMemo` — not at module top level.

```jsx
import { useMemo } from "react";
import * as math from "mathjs";

export default function MathDemo() {
  const results = useMemo(() => ({
    hypotenuse: math.evaluate("sqrt(3^2 + 4^2)"),
    factorial:  math.evaluate("factorial(6)"),
  }), []);
  return <pre>{JSON.stringify(results, null, 2)}</pre>;
}
```

---

## TensorFlow.js

```js
import * as tf from "tensorflow";
```

```jsx
import { useEffect, useState } from "react";
import * as tf from "tensorflow";

export default function TFDemo() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Matrix multiplication
    const a = tf.tensor2d([[1, 2], [3, 4]]);
    const b = tf.tensor2d([[5, 6], [7, 8]]);
    tf.matMul(a, b).array().then(setResult);

    // Always dispose tensors to avoid memory leaks
    return () => { a.dispose(); b.dispose(); };
  }, []);

  return <pre>{JSON.stringify(result)}</pre>;
}
```

```js
// Tensor creation
tf.tensor1d([1, 2, 3]);
tf.tensor2d([[1,2],[3,4]]);
tf.zeros([3, 3]);
tf.ones([3, 3]);
tf.randomNormal([100, 10]);

// Operations
tf.add(a, b);
tf.sub(a, b);
tf.mul(a, b);          // element-wise
tf.matMul(a, b);       // matrix multiply
tf.transpose(a);
tf.sigmoid(a);
tf.relu(a);
tf.softmax(a);

// Layers API (simple model)
const model = tf.sequential();
model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [4] }));
model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
model.compile({ optimizer: "adam", loss: "binaryCrossentropy", metrics: ["accuracy"] });
```
