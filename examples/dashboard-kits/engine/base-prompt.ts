// Rules every kit adds to its prompt on top of the base library's own groups
// and notes (which @openuidev/dashboard-library now ships).

export const BASE_RULES: string[] = [
  'Trends are objects: {direction: "up" | "down", value: number}.',
  'FilterSelect options are objects: [{value: "30d", label: "Last 30 days"}].',
];

/** Rules every kit shares: dashboards read live data through the kit's tools. */
export const DATA_RULES: string[] = [
  "Every number on the dashboard must come from a Query of the listed tools. Never type sample numbers, labels, or rows into the program.",
  "Tool outputs are shaped for the component that shows them: pass the field straight through, e.g. KpiStrip(kpis.metrics), ConversionFunnel(funnel.steps), CohortGrid(c.cohorts, c.periodLabels, c.format). The tool descriptions name the component each one feeds.",
  'Pluck table columns from an object array: Col("Name", result.rows.name).',
  "Declare each filter as a $variable with a default near the top of the program, before any statement that uses it, bind it as the FilterSelect's defaultValue, and pass it to every Query that accepts that argument.",
];

/**
 * How a generated dashboard is put together. Without these, models open every
 * dashboard with the overview's hero and KPI strip whatever was asked, show
 * one result in two or three cards, and pair a short card with a long one.
 */
export const COMPOSITION_RULES: string[] = [
  "Answer the question asked: the first row is the answer to it (experiments → the experiment cards, restocking → the restock list). Open with the hero and KpiStrip only for overview or health questions.",
  "Show each finding once: never put the same tool result, metric, or change in a second card, chart, title, or callout. DriverCards and VarianceWalk of one change share a row and appear nowhere else; no card beside them restates their top driver. Add a card only when it answers part of the question; 4 to 7 cards is usual.",
  "Use one comparison throughout: pass $compare to every tool that takes it, and name that same comparison in subtitles.",
  "Balance rows: cards in one row hold about as much as each other. A list or table of more than 6 rows takes a LargeCard, beside another long card or alone in its row; never put a few KPIs or a short chart beside it. A callout or a line of text goes inside the card it explains, never in a card of its own.",
  'Titles name the subject or the finding in plain words ("Products running out", "Why mobile checkout fell"), never the component or chart type: no "scorecard", "bridge", "walk", "drivers", "matrix", or "KPIs".',
];
