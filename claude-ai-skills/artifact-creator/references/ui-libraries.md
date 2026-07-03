# UI Libraries

## React (v18)

```js
import { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext, useReducer } from "react";
```

```jsx
export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Clicked {count} times
    </button>
  );
}
```

---

## lucide-react (0.383.0)

```js
import { Camera, Heart, Star, Search, Home, Zap, User, Settings } from "lucide-react";
```

```jsx
<Camera size={24} color="#3b82f6" />
<Heart size={24} color="#ef4444" fill="#ef4444" />
<Star size={24} color="#f59e0b" strokeWidth={1.5} />
```

Props: `size` (number), `color` (string), `strokeWidth` (number), `fill` (string).

---

## shadcn/ui

```js
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
```

```jsx
<Alert>
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>You can add components using the CLI.</AlertDescription>
</Alert>

<Badge variant="outline">New</Badge>

<Card>
  <CardHeader><CardTitle>Title</CardTitle></CardHeader>
  <CardContent>Content here</CardContent>
</Card>
```

> Note: Tell the user if you use shadcn/ui components, as they may need to verify availability.
