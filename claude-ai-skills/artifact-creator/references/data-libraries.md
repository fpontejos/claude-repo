# Data Libraries

## Papaparse

```js
import Papa from "papaparse";
```

```js
// Parse CSV string
const { data, errors } = Papa.parse(csvString, {
  header: true,          // use first row as keys
  dynamicTyping: true,   // auto-convert numbers/booleans
  skipEmptyLines: true,
});
// data: [{ name: "Alice", age: 30 }, ...]

// Parse a File object (from <input type="file">)
Papa.parse(file, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: ({ data }) => console.log(data),
  error: err => console.error(err),
});

// Unparse (array → CSV string)
const csv = Papa.unparse([{ name: "Alice", age: 30 }]);
```

```jsx
import { useState } from "react";
import Papa from "papaparse";

export default function CSVUploader() {
  const [rows, setRows] = useState([]);
  const onFile = e => {
    Papa.parse(e.target.files[0], {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: ({ data }) => setRows(data),
    });
  };
  return (
    <>
      <input type="file" accept=".csv" onChange={onFile} />
      <pre>{JSON.stringify(rows.slice(0,3), null, 2)}</pre>
    </>
  );
}
```

---

## SheetJS (xlsx)

```js
import * as XLSX from "xlsx";
```

```jsx
import { useState } from "react";
import * as XLSX from "xlsx";

export default function ExcelUploader() {
  const [rows, setRows] = useState([]);
  const onFile = async e => {
    const buf = await e.target.files[0].arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    setRows(XLSX.utils.sheet_to_json(ws));
  };
  return (
    <>
      <input type="file" accept=".xlsx,.xls" onChange={onFile} />
      <pre>{JSON.stringify(rows.slice(0,3), null, 2)}</pre>
    </>
  );
}
```

```js
// Create and download a workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ["Name", "Age"],
  ["Alice", 30],
  ["Bob", 25],
]);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, "output.xlsx");

// From JSON
const ws2 = XLSX.utils.json_to_sheet([{ Name:"Alice", Age:30 }]);
```

---

## Mammoth

```js
import * as mammoth from "mammoth";
```

```jsx
import { useState } from "react";
import * as mammoth from "mammoth";

export default function DocReader() {
  const [html, setHtml] = useState("");
  const onFile = async e => {
    const buf = await e.target.files[0].arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
    setHtml(value);
  };
  return (
    <>
      <input type="file" accept=".docx" onChange={onFile} />
      <div
        style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 8 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

// Extract plain text instead
const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf });
```
