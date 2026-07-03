# Charts Libraries

## Recharts

```js
import {
  LineChart, BarChart, PieChart, AreaChart, ScatterChart,
  Line, Bar, Pie, Area, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
```

```jsx
const data = [
  { month: "Jan", value: 400 },
  { month: "Feb", value: 300 },
  { month: "Mar", value: 600 },
];

<ResponsiveContainer width="100%" height={200}>
  <LineChart data={data}>
    <XAxis dataKey="month" />
    <YAxis />
    <CartesianGrid strokeDasharray="3 3" />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>

// Bar chart
<ResponsiveContainer width="100%" height={200}>
  <BarChart data={data}>
    <XAxis dataKey="month" /><YAxis /><Tooltip />
    <Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} />
  </BarChart>
</ResponsiveContainer>

// Pie chart with cells
<PieChart width={300} height={200}>
  <Pie data={data} dataKey="value" nameKey="month" cx="50%" cy="50%" outerRadius={80}>
    {data.map((_, i) => <Cell key={i} fill={["#3b82f6","#22c55e","#f59e0b"][i]} />)}
  </Pie>
  <Tooltip />
</PieChart>
```

---

## Chart.js

> ⚠️ Do NOT use `import * as Chart from "chart.js"` — `registerables` will be undefined.
> Load via CDN script tag instead, then use `window.Chart`.

```jsx
import { useEffect, useRef } from "react";

export default function BarChart() {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
    script.onload = () => {
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(ref.current, {
        type: "bar",
        data: {
          labels: ["Red", "Blue", "Green"],
          datasets: [{
            data: [12, 19, 8],
            backgroundColor: ["#ef4444", "#3b82f6", "#22c55e"],
            borderRadius: 4,
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { font: { size: 11 } } } }
        }
      });
    };
    document.head.appendChild(script);
    return () => { chartRef.current?.destroy(); document.head.removeChild(script); };
  }, []);

  return <canvas ref={ref} />;
}
```

---

## D3

```js
import * as d3 from "d3";
```

```jsx
import { useEffect, useRef } from "react";

export default function Bars() {
  const ref = useRef(null);
  useEffect(() => {
    const data = [10, 40, 25, 60, 15];
    const scale = d3.scaleLinear().domain([0, 60]).range([0, 300]);
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.selectAll("rect")
      .data(data).join("rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 22)
      .attr("width", scale)
      .attr("height", 18)
      .attr("rx", 4)
      .attr("fill", (d, i) => d3.schemeTableau10[i]);
    svg.selectAll("text")
      .data(data).join("text")
      .attr("x", d => scale(d) + 4)
      .attr("y", (d, i) => i * 22 + 13)
      .attr("font-size", 11)
      .text(d => d);
  }, []);
  return <svg ref={ref} width="100%" height={120} />;
}
```

Useful helpers: `d3.scaleLinear()`, `d3.scaleBand()`, `d3.scaleOrdinal()`, `d3.schemeTableau10`,
`d3.axisBottom()`, `d3.axisLeft()`, `d3.line()`, `d3.area()`, `d3.arc()`, `d3.pie()`,
`d3.hierarchy()`, `d3.treemap()`, `d3.forceSimulation()`.

---

## Plotly

```js
import * as Plotly from "plotly";
```

```jsx
import { useEffect, useRef } from "react";

export default function Plot() {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    Plotly.newPlot(
      ref.current,
      [{
        x: [1, 2, 3, 4, 5],
        y: [2, 6, 3, 8, 4],
        type: "scatter",
        mode: "lines+markers",
        marker: { color: "#3b82f6" },
      }],
      {
        margin: { t: 10, b: 30, l: 30, r: 10 },
        height: 200,
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
      },
      { responsive: true, displayModeBar: false }
    );
  }, []);
  return <div ref={ref} />;
}
```

Other trace types: `"bar"`, `"heatmap"`, `"surface"` (3D), `"choropleth"`, `"box"`, `"histogram"`.
