"use client"

import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import dynamic from "next/dynamic"
import { Cell, Legend, Pie, Tooltip, ResponsiveContainer } from "recharts"
import { EmptyChart } from "../EmptyChart"

const LazyPieChart = dynamic(
  () => import("recharts").then(m => ({ default: m.PieChart })),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 rounded-xl animate-pulse" /> }
)

const TOOLTIP_STYLE = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
}

function PieChartCardComponent({ title, description, data, dataKey = "value", nameKey = "type", colSpan = "col-span-12 lg:col-span-5", colors }: {
  title: string
  description?: string
  data: any[]
  dataKey?: string
  nameKey?: string
  colSpan?: string
  colors?: Record<string, string>
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
              <LazyPieChart>
                <Pie 
                  data={data} 
                  dataKey={dataKey} 
                  nameKey={nameKey} 
                  outerRadius={80} 
                  innerRadius={45} 
                  stroke="none" 
                  label={({ [nameKey]: name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} 
                  labelLine={false}
                >
                  {data.map((e: any, i: number) => {
                    const cellColor = colors ? colors[e[nameKey]] ?? "#cbd5e1" : e.color ?? "#cbd5e1"
                    return <Cell key={i} fill={cellColor} />
                  })}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </LazyPieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </CardContent>
    </Card>
  )
}

export const PieChartCard = React.memo(PieChartCardComponent)
