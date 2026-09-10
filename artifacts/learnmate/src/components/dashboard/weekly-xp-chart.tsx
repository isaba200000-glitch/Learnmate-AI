import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type WeeklyXpItem = { day: string; xp: number };

export function WeeklyXpChart({ data }: { data: WeeklyXpItem[] }) {
  return (
    <div className="h-[250px] w-full mt-2 min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            fontFamily="var(--font-mono)"
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            fontFamily="var(--font-mono)"
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--primary) / 0.2)", strokeWidth: 1 }}
            contentStyle={{
              borderRadius: "0.75rem",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
              backdropFilter: "blur(12px)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
            }}
          />
          <Area
            type="monotone"
            dataKey="xp"
            stroke="hsl(217 91% 60%)"
            strokeWidth={2.5}
            fill="url(#areaGradient)"
            style={{ filter: "drop-shadow(0 0 8px rgba(37, 99, 235, 0.4))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
