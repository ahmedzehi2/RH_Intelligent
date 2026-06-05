"use client"

import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import dynamic from "next/dynamic"
import { CartesianGrid, Legend, Line, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { EmptyChart } from "../EmptyChart"

const LazyLineChart = dynamic(
  () => import("recharts").then(m => ({ default: m.LineChart })),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 rounded-xl animate-pulse" /> }
)

const TOOLTIP_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
}

type LineConfig = {
  dataKey: string
  name: string
  stroke: string
}

function LineChartCardComponent({ title, description, data, lines, colSpan = "col-span-12 lg:col-span-6" }: {
  title: string
  description?: string
  data: any[]
  lines: LineConfig[]
  colSpan?: string
}) {
  return (
    <Card className={`${colSpan} shadow-sm border-gray-100 rounded-2xl transition-all duration-300 hover:shadow-md`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {data?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LazyLineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {lines.map((l, idx) => (
                  <Line 
                    key={idx}
                    type="monotone" 
                    dataKey={l.dataKey} 
                    stroke={l.stroke} 
                    strokeWidth={2.5} 
                    name={l.name} 
                    dot={false} 
                    activeDot={{ r: 4 }} 
                  />
                ))}
              </LazyLineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </CardContent>
    </Card>
  )
}

export const LineChartCard = React.memo(LineChartCardComponent)
