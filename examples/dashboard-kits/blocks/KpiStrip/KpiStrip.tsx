import clsx from "clsx";
import { useId, useState } from "react";
import { Sparkline } from "../../charts/Sparkline";
import { changeTone } from "../../engine/format";
import { useContainerSize } from "../../engine/hooks";
import type { Kpi } from "../../engine/schemas";
import { DefinitionTip } from "../DefinitionTip";
import { DeltaPill } from "../DeltaPill";
import { RollingNumber } from "../RollingNumber";
import { kpiColumns } from "./kpiLayout";
import { formatLike, sparkPoints, sparkVariant, tileDay } from "./kpiSpark";

/** "Unusually high · usual $1.1M–$1.2M", toned by whether that direction is good. */
export function UsualNote({ kpi }: { kpi: Kpi }) {
  const usual = kpi.usual!;
  const tone = changeTone(usual.status === "above" ? 1 : -1, kpi.goodDirection);
  return (
    <span className="kit-usual">
      <span className={`kit-usual__flag kit-text-${tone}`}>
        Unusually {usual.status === "above" ? "high" : "low"}
      </span>{" "}
      · usual {usual.low}–{usual.high}
    </span>
  );
}

export interface KpiStripProps {
  metrics: Kpi[];
  /** The label of the tile shown in the hero chart, if any. */
  selected?: string;
  /**
   * Make tiles with a trend into tabs: called with a tile's label when it is
   * chosen, or "" when the chosen tile is chosen again.
   */
  onSelect?: (label: string) => void;
}

/**
 * Supporting KPI tiles: each value with its change (colored by whether that
 * direction is good), the previous value, a sparkline, and a definition. The
 * strip balances its rows to its width, and each row's tiles share row lines
 * so values align when a label wraps.
 *
 * The sparklines read days: hovering one (or arrowing through it once focused)
 * shows that tile's value, change, and comparison for the day under the
 * pointer, with the date where its hint was; the other tiles stay as they are.
 * Leaving returns the tile to its latest figures.
 */
export function KpiStrip({ metrics, selected, onSelect }: KpiStripProps) {
  const [ref, size] = useContainerSize<HTMLDivElement>(1200);
  const tipId = useId().replace(/[^a-zA-Z0-9]/g, "");
  // The tile being read (by its place in the strip) and the day under the pointer.
  const [hover, setHover] = useState<{ tile: string; index: number } | null>(null);
  const columns = kpiColumns(metrics.length, size.width);
  const rows = Array.from({ length: Math.ceil(metrics.length / columns) }, (_, r) =>
    metrics.slice(r * columns, (r + 1) * columns),
  );

  const tile = (key: string, m: Kpi, select?: () => void, describedBy?: string) => {
    const points = sparkPoints(m);
    const index = points && hover?.tile === key ? hover.index : null;
    const day = points && index != null ? tileDay(m, points, index) : undefined;
    // A tile that can show a day keeps a line for the date, so nothing shifts.
    const dated = Boolean(points?.labels);
    const hint = m.usual && m.usual.status !== "within" ? <UsualNote kpi={m} /> : m.hint;
    const label = select ? (
      <button
        type="button"
        className={`kit-kpi__label kit-kpi__select${m.definition ? " kit-def-label" : ""}`}
        aria-pressed={selected === m.label}
        aria-describedby={describedBy}
        onClick={select}
      >
        {m.label}
      </button>
    ) : (
      <span className={`kit-kpi__label${m.definition ? " kit-def-label" : ""}`}>{m.label}</span>
    );
    return (
      <>
        {label}
        <RollingNumber value={day?.value ?? m.value} className="kit-kpi__value" />
        <span className="kit-kpi__meta">
          {day ? (
            day.change != null ? (
              <>
                <DeltaPill change={day.change} goodDirection={m.goodDirection} />
                {day.previous && <span className="kit-kpi__previous">vs {day.previous}</span>}
              </>
            ) : (
              // No comparison that day: hold the line's height, show nothing.
              <span className="kit-kpi__hold" aria-hidden>
                <DeltaPill change={m.change} goodDirection={m.goodDirection} />
              </span>
            )
          ) : (
            <>
              <DeltaPill change={m.change} goodDirection={m.goodDirection} />
              {m.previous && <span className="kit-kpi__previous">vs {m.previous}</span>}
            </>
          )}
        </span>
        {points ? (
          // A click on the sparkline still picks the tile; scrubbing it keeps
          // the definition shut (data-def-quiet).
          <div className="kit-kpi__spark" onClick={select} data-def-quiet="">
            <Sparkline
              values={points.values}
              labels={points.labels}
              variant={sparkVariant(m, points)}
              label={m.label}
              formatValue={(v) => formatLike(v, m.value, points.format)}
              hoveredIndex={index}
              onHover={(i) =>
                setHover((prev) =>
                  i != null ? { tile: key, index: i } : prev?.tile === key ? null : prev,
                )
              }
            />
          </div>
        ) : (
          <span />
        )}
        <span className={clsx("kit-kpi__hint", dated && "kit-kpi__hint--dated")}>
          <span className={clsx(day && "kit-kpi__hidden")}>{hint}</span>
          {day && <span className="kit-kpi__date">{day.date}</span>}
        </span>
      </>
    );
  };

  return (
    <div ref={ref} className={clsx("kit-kpis", hover && "kit-kpis--reading")}>
      {rows.map((row, r) => (
        <div
          key={r}
          className="kit-kpis__row"
          style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
        >
          {row.map((m, i) => {
            // Each tile sits in a host that shows its definition on hover or focus.
            const id = m.definition ? `kpi-def-${tipId}-${r}-${i}` : undefined;
            const tab = Boolean(onSelect && m.trend);
            return (
              <div key={`${m.label}-${i}`} className="kit-def-host kit-kpis__cell">
                {tab ? (
                  // A tab tile: its label is the button, stretched over the
                  // tile, so the sparkline above it stays its own focus stop.
                  <div
                    className={clsx(
                      "kit-kpi kit-kpi--tab",
                      selected === m.label && "kit-kpi--selected",
                    )}
                  >
                    {tile(`${r}-${i}`, m, () => onSelect!(selected === m.label ? "" : m.label), id)}
                  </div>
                ) : (
                  <div className="kit-kpi" tabIndex={id ? 0 : undefined} aria-describedby={id}>
                    {tile(`${r}-${i}`, m)}
                  </div>
                )}
                {id && m.definition && <DefinitionTip id={id} definition={m.definition} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
