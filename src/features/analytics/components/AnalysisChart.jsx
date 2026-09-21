import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { EmptyState } from "@ui";
import { Link } from "react-router-dom";

export default function AnalysisChart({ title, description, data, dataKey, unit, color, type = "line", maximum, hrefForPoint }) {
  const present = data.filter((point) => point[dataKey] !== null);
  const Series = type === "bar" ? BarChart : LineChart;
  return <section className="analysis-chart">
    <div className="section-header"><h3>{title}</h3><p>{description}</p></div>
    {present.length ? <>
      <div className="analysis-chart__plot" role="img" aria-label={`${title}: ${present.length} recorded periods in the selected range`}>
        <ResponsiveContainer width="100%" height={220}>
          <Series data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} width={40} domain={[0, maximum ?? "auto"]} allowDecimals={dataKey !== "workouts"} fontSize={11} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel ?? ""} formatter={(value) => [`${value} ${unit}`, title]} />
            {type === "bar"
              ? <Bar dataKey={dataKey} fill={color} maxBarSize={34} radius={[3, 3, 0, 0]} />
              : <Line type="linear" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />}
          </Series>
        </ResponsiveContainer>
      </div>
      {present.length === 1 ? <p className="analysis-chart__caution">One recorded period is a point, not a trend.</p> : null}
      <details className="analysis-chart__table"><summary>View recorded values</summary><table><thead><tr><th scope="col">Period</th><th scope="col">{title}</th></tr></thead><tbody>{present.map((point) => <tr key={point.start}><td>{hrefForPoint?.(point) ? <Link to={hrefForPoint(point)}>{point.dateLabel}</Link> : point.dateLabel}</td><td>{point[dataKey]} {unit}</td></tr>)}</tbody></table></details>
    </> : <EmptyState compact title={`No ${title.toLowerCase()} history in this range`} description="Nothing is drawn for periods without recorded data." />}
  </section>;
}
