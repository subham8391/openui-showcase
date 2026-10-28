// Click-to-dig-in: what a chart says was clicked, and the questions the
// dashboard offers about it. Each question becomes a new generation, so its
// prompt carries enough context (the chart, the dashboard, the figures) for
// the model to build a dashboard about that one point.

/** What was clicked on a chart, in the chart's own words and formatting. */
export interface DrillTarget {
  /**
   * One point or column, a selected range of days, one cell of a grid, or one
   * named part of a whole (a row of a ranked list, a step of a walk), which
   * the questions ask about by its own name: "Why was Web +$316?".
   */
  kind: "point" | "range" | "cell" | "part";
  /**
   * The measure: a series name ("Orders"), or the chart's own name for a grid.
   * A part with no measure of its own names itself (`metric` = `label`).
   */
  metric: string;
  /** Where: "Oct 3", "Sep 13 → Sep 27", "Wed 14:00"; for a part, its name: "Web". */
  label: string;
  /** The figure there, formatted as the chart shows it: "530", "55.3K → 61.3K". */
  value?: string;
  /** For a range or a part, its change: "+10.8%". */
  change?: string;
  /**
   * The point before, for a "why": `{ label: "Oct 2", value: "480" }`; for a
   * part, the same part in the comparison: `{ label: "Plan", value: "+$290" }`.
   */
  previous?: { label: string; value: string };
  /**
   * What the labels along the axis are, when they aren't dates: "Days active
   * in the last 7 days" for columns labelled 1 to 7.
   */
  axis?: string;
}

/** The titles around a chart, read from the page: its card and its dashboard. */
export interface DrillPlace {
  dashboard?: string;
  chart?: string;
}

export interface DrillQuestion {
  id: "why" | "breakdown";
  /** The short question shown on the menu. */
  label: string;
  /** What is sent to the model. */
  prompt: string;
}

/** The first line of an element's text, trimmed: a card header's title. */
function firstLine(el: Element | null | undefined): string | undefined {
  const text = (el as HTMLElement | null)?.innerText ?? el?.textContent ?? "";
  const line = text
    .split("\n")
    .find((l) => l.trim())
    ?.trim();
  return line || undefined;
}

/**
 * The card and dashboard titles around `el`. A card's title is its header's
 * first line; a hero card has no header, so its metric label stands in.
 */
export function drillPlaceOf(el: Element | null): DrillPlace {
  if (!el) return {};
  const card = el.closest(".c1-shell-card, .openui-card");
  const chart =
    firstLine(card?.querySelector(".c1-dashboard-card-header__content")) ??
    firstLine(card?.querySelector(".kit-hero__label"));
  const root = el.closest(".canvas") ?? document;
  const dashboard = firstLine(root.querySelector('[class*="dashboard-header"]'));
  return { dashboard, chart };
}

/** A label that names a time: a date, weekday, month, hour, week, quarter, or year. */
const WHEN =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\d{1,2}:\d{2}|\b(19|20)\d{2}\b|^q[1-4]\b|^w(ee)?k?\s?\d|\d{1,2}\/\d{1,2}|\b(today|yesterday)\b/i;

export function isWhen(label: string): boolean {
  return WHEN.test(label);
}

/** "on the “Orders by day” chart of the “Store overview” dashboard". */
function where(place: DrillPlace): string {
  const chart = place.chart ? `the “${place.chart}” chart` : "a chart";
  return place.dashboard ? `${chart} on the “${place.dashboard}” dashboard` : chart;
}

/** Cuts a menu label to a readable length on a word boundary. */
function short(text: string, max = 64): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2))}…`;
}

/** A series named for its period ("This period", "Prior year") rather than for what it measures. */
const PERIOD_NAME =
  /^(this|current|prior|previous|last|same)( (period|day|week|month|quarter|year|year's))*$|^(current|actual|now)$/i;

/**
 * The measure's name for a question: the series name, unless it only names a
 * period ("This period"), in which case the card's title says what it is.
 */
export function drillMetric(target: DrillTarget, place: DrillPlace = {}): string {
  return PERIOD_NAME.test(target.metric.trim()) && place.chart ? place.chart : target.metric;
}

/** The two questions offered for a clicked target: why it is so, and what it is made of. */
export function drillQuestions(target: DrillTarget, place: DrillPlace = {}): DrillQuestion[] {
  const { label, value, change, previous } = target;
  const metric = drillMetric(target, place);
  const from = `It's from ${where(place)}.`;

  if (target.kind === "range") {
    const figures = [value, change].filter(Boolean).join(", ");
    const span = `${metric} from ${label.replace(" → ", " to ")}${figures ? ` (${figures})` : ""}`;
    return [
      {
        id: "why",
        label: short(`What drove ${metric} over ${label}?`),
        prompt: `What drove ${span}? ${from} Build a dashboard that explains the change: which segments, channels, or events moved it.`,
      },
      {
        id: "breakdown",
        label: short(`Compare ${label} with the period before`),
        prompt: `Compare ${span} with the same length of time just before it, and show what changed and where. ${from}`,
      },
    ];
  }

  if (target.kind === "part") {
    // Asked by the part's own name (a total named for its period, "This
    // period", by the card's title); the chart's title, in `from`, says what
    // it is a part of.
    const name = drillMetric({ ...target, metric: label }, place);
    const why = value ? `Why was ${name} ${value}` : `Why did ${name} look like this`;
    const figures = [change, previous && `${previous.label}: ${previous.value}`]
      .filter(Boolean)
      .join(", ");
    const against = previous ? previous.label : "the other parts";
    return [
      {
        id: "why",
        label: short(`${why}?`),
        prompt: `${why}${figures ? ` (${figures})` : ""}? ${from} Build a dashboard that explains what drove it.`,
      },
      {
        id: "breakdown",
        label: short(`Break down ${name}`),
        prompt: `Break down ${name}${value ? ` (${value})` : ""}: what made it up, and how that compares with ${against}. ${from}`,
      },
    ];
  }

  // A time reads "on Oct 3" (or "at Wed 14:00" in a grid); a category, such as
  // a column labelled 4 under "Days active", reads "for 4" and names its axis.
  const when = isWhen(label);
  const on = target.kind === "cell" ? "at" : when ? "on" : "for";
  const axis = !when && target.axis ? ` (${target.axis})` : "";
  const why = value
    ? `Why was ${metric} ${value} ${on} ${label}`
    : `Why did ${metric} look like this ${on} ${label}`;
  const before = previous ? ` (${previous.value} ${on} ${previous.label})` : "";
  const usual = target.kind === "cell" ? "a usual slot" : when ? "a usual day" : "its neighbours";
  return [
    {
      id: "why",
      label: short(`${why}?`),
      prompt: `${why}${axis}${before}? ${from} Build a dashboard that explains what drove it.`,
    },
    {
      id: "breakdown",
      label: short(`Break down ${label}`),
      prompt: `Break down ${metric} for ${label}${axis}${value ? ` (${value})` : ""}: what made it up, and how that compares with ${usual}. ${from}`,
    },
  ];
}
