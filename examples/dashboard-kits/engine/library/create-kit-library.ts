import { createLibrary, type DefinedComponent, type Library } from "@openuidev/react-lang";

/** Base containers a kit component can be placed in. */
export type CardSlot = "MediumCard" | "LargeCard";

export interface KitComponent {
  component: DefinedComponent<any>;
  /** Cards that accept this component as a child. */
  slots: CardSlot[];
}

/**
 * Base components every kit replaces with its own: the charts (TrendChart,
 * ColumnChart, BarList, ShareBar, ...) and the KPI cards (KpiStrip,
 * HeroMetric), with the icon labels those cards took; and the buttons, whose
 * actions have no chat to reach on this site. They are removed, so the model never sees a component it
 * should not use, and the prompt is shorter.
 */
export const REPLACED_BASE = [
  "LineChart",
  "AreaChart",
  "BarChart",
  "HorizontalBarChart",
  "PieChart",
  "RadialChart",
  "RadarChart",
  "ScatterChart",
  "Series",
  "ScatterSeries",
  "Point",
  "SmallCard",
  "MetricIndicator",
  "OverviewCardBlock",
  "OverviewCardItem",
  "IconText",
  "IconTag",
  "Button",
  "ButtonGroup",
];

export interface KitLibraryDefinition {
  /** Prompt group for the kit's own components. */
  group: { name: string; notes: string[] };
  components: KitComponent[];
}

/**
 * A base dashboard library plus one kit's components. The base is passed in
 * (`library` from `@openuidev/dashboard-library`), so the kits do not depend
 * on any one dashboard implementation. `extend` adds each component to the
 * cards it may sit in, so the prompt lists it as a valid child there; the
 * kit's own prompt group then joins the base groups.
 */
export function createKitLibrary(base: Library, def: KitLibraryDefinition): Library {
  if (!base.extend) {
    throw new Error(
      "[dashboard-kit] The base library has no extend(); use OpenUI Lang 1.0 or later.",
    );
  }
  const removed = REPLACED_BASE.filter((name) => base.components[name]);
  const extended = base.extend({
    components: {
      add: def.components.map(({ component, slots }) =>
        slots.length ? { component, slots: slots.map((slot) => `${slot}.children`) } : component,
      ),
      remove: removed,
    },
  });
  // The base groups without the removed charts, or the notes that name them.
  const mentions = new RegExp(`\\b(${removed.join("|")})\\b`);
  const baseGroups = (base.componentGroups ?? [])
    .map((group) => ({
      ...group,
      components: group.components.filter((name) => !removed.includes(name)),
      notes: group.notes?.filter((note) => !mentions.test(note)),
    }))
    .filter((group) => group.components.length > 0);
  return createLibrary({
    root: extended.root ?? "Dashboard",
    components: Object.values(extended.components),
    componentGroups: [
      ...baseGroups,
      {
        name: def.group.name,
        components: def.components.map((c) => c.component.name),
        notes: def.group.notes,
      },
    ],
  });
}
