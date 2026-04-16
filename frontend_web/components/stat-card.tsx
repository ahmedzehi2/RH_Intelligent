import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardProps = {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: "up" | "down" | "neutral"
  className?: string
  delay?: number
  progress?: number
  progressColor?: string
}

export function StatCard({ title, value, description, icon: Icon, trend, className, delay = 0, progress, progressColor }: StatCardProps) {
  return (
    <Card 
      className={cn(
        "relative overflow-hidden opacity-0 animate-fade-in-up card-hover group flex flex-col justify-between min-h-[110px]",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <CardContent className="flex flex-col flex-1 p-5 pt-5">
        <div className="flex items-start justify-between mb-auto">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {description && (
              <p className={cn(
                "text-xs transition-colors duration-200 mt-1",
                trend === "up" && "text-[oklch(0.62_0.19_165)]",
                trend === "down" && "text-destructive",
                !trend && "text-muted-foreground"
              )}>
                {description}
              </p>
            )}
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-transform duration-300 group-hover:scale-110 ml-4">
            <Icon className="size-5 text-primary" />
          </div>
        </div>
        
        {typeof progress === "number" && (
          <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-500", progressColor || "bg-primary")} 
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} 
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
