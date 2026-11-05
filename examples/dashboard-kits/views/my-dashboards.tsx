"use client";

import { ScaledFrame } from "@/shared/ui/scaled-frame";
import type { Library } from "@openuidev/react-lang";
import {
  LiveArtifactRenderer,
  useArtifactDelete,
  useArtifactList,
  useArtifactPin,
  useArtifactUnpin,
  useArtifactUpdate,
  type ArtifactSummary,
} from "@openuidev/react-ui/cloud";
import { useEffect, useState } from "react";
import { cloudRoutes } from "./cloud";

/** Cards that draw a live thumbnail; the rest show their title only. */
const THUMBNAILS = 6;

/** "just now", "5 min ago", "3 h ago", "Oct 28". */
function when(time: string | number | undefined): string {
  if (time == null || time === "") return "";
  // A number may be in seconds or milliseconds.
  const at = new Date(typeof time === "number" && time < 1e12 ? time * 1000 : time);
  if (Number.isNaN(at.getTime())) return "";
  const minutes = Math.round((Date.now() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const PIN = "M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7";
const RENAME = "M4 20h4l10-10-4-4L4 16v4zM13.5 6.5l4 4";
const DELETE = "M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3";

function DashboardCard({
  item,
  kitId,
  library,
  thumbnail,
  onOpen,
}: {
  item: ArtifactSummary;
  kitId: string;
  library: Library;
  thumbnail: boolean;
  onOpen: (item: ArtifactSummary) => void;
}) {
  const { pin } = useArtifactPin();
  const { unpin } = useArtifactUnpin();
  const { update } = useArtifactUpdate();
  const { deleteArtifact, isPending: deleting } = useArtifactDelete();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(item.title ?? "");
  const [confirming, setConfirming] = useState(false);
  const name = item.title || "Untitled dashboard";

  return (
    <li className={`saved${item.pinned ? " saved--pinned" : ""}`}>
      <span className="saved__thumb" aria-hidden>
        {thumbnail ? (
          <ScaledFrame className="saved__frame">
            <LiveArtifactRenderer
              id={item.id}
              library={library}
              interpreter={cloudRoutes(kitId).interpreter}
              preview={false}
            />
          </ScaledFrame>
        ) : (
          <span className="saved__placeholder">
            <span className="skeleton skeleton--title" />
            <span className="skeleton-row">
              <span className="skeleton skeleton--hero" />
              <span className="skeleton skeleton--side" />
            </span>
          </span>
        )}
      </span>
      <span className="saved__foot">
        {renaming ? (
          <form
            className="saved__rename"
            onSubmit={(event) => {
              event.preventDefault();
              const next = title.trim();
              if (next && next !== item.title) void update(item.id, { title: next });
              setRenaming(false);
            }}
          >
            <label className="kit-visually-hidden" htmlFor={`rename-${item.id}`}>
              Dashboard name
            </label>
            <input
              id={`rename-${item.id}`}
              value={title}
              autoFocus
              // The whole name is selected, so typing replaces it.
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setTitle(item.title ?? "");
                  setRenaming(false);
                }
              }}
            />
            <button type="submit" className="button">
              Save
            </button>
          </form>
        ) : (
          <button type="button" className="saved__open" onClick={() => onOpen(item)}>
            <span className="saved__title">{name}</span>
            <span className="saved__meta">
              {item.pinned ? "Pinned · " : ""}
              {when(item.updatedAt)}
            </span>
          </button>
        )}
        {!renaming && (
          <span className="saved__actions">
            {confirming ? (
              <>
                <button
                  type="button"
                  className="button button--danger"
                  disabled={deleting}
                  onClick={() => void deleteArtifact(item.id)}
                >
                  Delete
                </button>
                <button type="button" className="button" onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="saved__icon"
                  aria-label={item.pinned ? `Unpin ${name}` : `Pin ${name}`}
                  title={item.pinned ? "Unpin" : "Pin"}
                  aria-pressed={Boolean(item.pinned)}
                  onClick={() => void (item.pinned ? unpin(item.id) : pin(item.id))}
                >
                  <Icon d={PIN} />
                </button>
                <button
                  type="button"
                  className="saved__icon"
                  aria-label={`Rename ${name}`}
                  title="Rename"
                  onClick={() => setRenaming(true)}
                >
                  <Icon d={RENAME} />
                </button>
                <button
                  type="button"
                  className="saved__icon"
                  aria-label={`Delete ${name}`}
                  title="Delete"
                  onClick={() => setConfirming(true)}
                >
                  <Icon d={DELETE} />
                </button>
              </>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * The visitor's saved dashboards for a kit, pinned first, from OpenUI Cloud:
 * each opens in the viewer, and can be pinned, renamed, or deleted. `refreshKey`
 * changes when a new dashboard has been saved.
 */
export function MyDashboards({
  kitId,
  library,
  onOpen,
  refreshKey,
}: {
  kitId: string;
  library: Library;
  onOpen: (item: ArtifactSummary) => void;
  refreshKey: number;
}) {
  const pinned = useArtifactList({ filter: { type: "dashboard", pinned: true } });
  const recent = useArtifactList({ filter: { type: "dashboard", pinned: false, limit: 12 } });
  const { refresh: refreshPinned } = pinned;
  const { refresh: refreshRecent } = recent;

  useEffect(() => {
    if (refreshKey === 0) return;
    refreshPinned();
    refreshRecent();
  }, [refreshKey, refreshPinned, refreshRecent]);

  const items = [...pinned.artifacts, ...recent.artifacts];
  const loading = pinned.isLoading || recent.isLoading;
  if (!loading && items.length === 0 && !pinned.error && !recent.error) return null;

  return (
    <section className="saved-list" aria-labelledby="saved-heading">
      <div className="saved-list__head">
        <h2 id="saved-heading">Your dashboards</h2>
        <p>Saved on OpenUI for this browser. Each opens with live data, with no new model call.</p>
      </div>
      {(pinned.error || recent.error) && (
        <p className="run__error">Your dashboards couldn&apos;t be loaded.</p>
      )}
      <ul className="saved-grid">
        {items.map((item, index) => (
          <DashboardCard
            key={item.id}
            item={item}
            kitId={kitId}
            library={library}
            thumbnail={index < THUMBNAILS}
            onOpen={onOpen}
          />
        ))}
      </ul>
      {recent.hasMore && (
        <button type="button" className="button" onClick={recent.loadMore}>
          Show more
        </button>
      )}
    </section>
  );
}
