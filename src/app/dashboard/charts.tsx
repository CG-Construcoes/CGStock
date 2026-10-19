"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

type ChartData = {
  name: string
  entradas: number
  saidas: number
}

export function DashboardCharts({ data }: { data: ChartData[] }) {
  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        Sem dados suficientes.
      </div>
    )
  }

  const maxVal = data.reduce((max, item) => Math.max(max, item.entradas || 0, item.saidas || 0), 0)
  const topTickEstimate = Math.max(maxVal * 1.5, 100)
  const formattedMax = Math.ceil(topTickEstimate).toLocaleString("pt-BR")
  const yAxisWidth = Math.max(54, formattedMax.length * 8 + 18)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={2} margin={{ top: 10, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="currentColor" className="text-border opacity-30" />
        <XAxis 
          dataKey="name" 
          stroke="currentColor" 
          className="text-muted-foreground font-medium"
          tick={{ fontSize: 11, fill: "currentColor" }}
          tickLine={false} 
          axisLine={false} 
          tickMargin={12}
        />
        <YAxis 
          stroke="currentColor" 
          className="text-muted-foreground font-medium"
          tick={{ fontSize: 11, fill: "currentColor" }}
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(value) => Number(value).toLocaleString("pt-BR")}
          tickMargin={6}
          tickCount={4}
          width={yAxisWidth}
        />
        <Tooltip 
          cursor={{ fill: 'currentColor', className: 'text-muted opacity-5' }}
          contentStyle={{ borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', fontSize: '11px', boxShadow: 'none', padding: '8px 12px' }}
          itemStyle={{ fontWeight: 600, padding: 0, margin: 0 }}
          labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '6px' }}
          formatter={(value: any) => [Number(value || 0).toLocaleString("pt-BR"), ""]}
        />
        <Bar dataKey="entradas" fill="var(--chart-entry)" radius={[2, 2, 0, 0]} barSize={12} />
        <Bar dataKey="saidas" fill="var(--chart-exit)" radius={[2, 2, 0, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  )
}
