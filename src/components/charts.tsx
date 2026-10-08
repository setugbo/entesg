"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, ScatterChart, Scatter, ZAxis, Cell } from "recharts";

export function TrendChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#065f46" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Bar dataKey="value" fill="#059669" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MaterialityMatrix({ topics }: { topics: { topic: string; impact: number; financial: number }[] }) {
  const data = topics.map((t) => ({ x: t.impact, y: t.financial, z: 220, topic: t.topic }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis type="number" dataKey="x" domain={[0, 5]} label={{ value: "Impact materiality →", position: "insideBottom", offset: -2, fontSize: 11 }} fontSize={11} />
          <YAxis type="number" dataKey="y" domain={[0, 5]} label={{ value: "Financial →", angle: -90, position: "insideLeft", fontSize: 11 }} fontSize={11} />
          <ZAxis type="number" dataKey="z" range={[180, 320]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="#065f46">
            {data.map((d, i) => (
              <Cell key={i} fill={d.x >= 3 && d.y >= 3 ? "#b91c1c" : d.x >= 3 || d.y >= 3 ? "#b45309" : "#059669"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
