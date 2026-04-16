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
}

export function StatCard({ title, value, description, icon: Icon, trend, className, delay = 0 }: StatCardProps) {
  return (
    <Card 
      className={cn(
        "relative overflow-hidden opacity-0 animate-fade-in-up card-hover group",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <CardContent className="flex items-start justify-between pt-0">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className={cn(
              "text-xs transition-colors duration-200",
              trend === "up" && "text-[oklch(0.62_0.19_165)]",
              trend === "down" && "text-destructive",
              !trend && "text-muted-foreground"
            )}>
              {description}
            </p>
          )}
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-transform duration-300 group-hover:scale-110">
          <Icon className="size-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  )
}
