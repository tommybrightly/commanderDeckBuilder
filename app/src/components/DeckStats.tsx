"use client";

import { useState, useRef, useCallback } from "react";

const CARD_TYPES = ["Creature", "Artifact", "Enchantment", "Instant", "Sorcery", "Planeswalker", "Land"] as const;

const DISPLAY_TYPE_ORDER: readonly string[] = ["Creature", "Artifact", "Enchantment", "Instant", "Sorcery", "Planeswalker", "Other"];

/** Assign a card to one display bucket by primary type (Creature > Artifact > Enchantment > Instant > Sorcery > Planeswalker). */
function getPrimaryType(typeLine?: string): string {
  const line = (typeLine ?? "").toLowerCase();
  if (line.includes("creature")) return "Creature";
  if (line.includes("artifact")) return "Artifact";
  if (line.includes("enchantment")) return "Enchantment";
  if (line.includes("instant")) return "Instant";
  if (line.includes("sorcery")) return "Sorcery";
  if (line.includes("planeswalker")) return "Planeswalker";
  return "Other";
}

type DeckCard = {
  name: string;
  quantity: number;
  typeLine?: string;
  role?: string;
  imageUrl?: string;
};

export function groupMainByType(
  main: Array<{ name: string; quantity?: number; typeLine?: string; role?: string; imageUrl?: string }>
): Record<string, DeckCard[]> {
  const groups: Record<string, DeckCard[]> = {};
  for (const label of DISPLAY_TYPE_ORDER) groups[label] = [];

  for (const c of main) {
    const type = getPrimaryType(c.typeLine);
    groups[type].push({
      name: c.name,
      quantity: c.quantity ?? 1,
      typeLine: c.typeLine,
      role: c.role,
      imageUrl: c.imageUrl,
    });
  }
  return groups;
}

function countByType(
  main: Array<{ typeLine?: string; quantity?: number }>,
  lands: Array<{ name: string; quantity?: number }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of CARD_TYPES) counts[t] = 0;

  for (const c of main) {
    const qty = c.quantity ?? 1;
    const line = (c.typeLine ?? "").toLowerCase();
    if (line.includes("creature")) counts["Creature"] += qty;
    if (line.includes("artifact")) counts["Artifact"] += qty;
    if (line.includes("enchantment")) counts["Enchantment"] += qty;
    if (line.includes("instant")) counts["Instant"] += qty;
    if (line.includes("sorcery")) counts["Sorcery"] += qty;
    if (line.includes("planeswalker")) counts["Planeswalker"] += qty;
    if (line.includes("land")) counts["Land"] += qty;
  }
  for (const c of lands) {
    counts["Land"] += c.quantity ?? 1;
  }
  return counts;
}

function getCurve(main: Array<{ cmc?: number; quantity?: number }>): { cmc: number; count: number }[] {
  const buckets: number[] = [0, 0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6, 7+

  for (const c of main) {
    const cmc = typeof c.cmc === "number" ? c.cmc : 0;
    const qty = c.quantity ?? 1;
    const key = cmc >= 7 ? 7 : Math.max(0, cmc);
    buckets[key] += qty;
  }

  return buckets.map((count, cmc) => ({ cmc: cmc === 7 ? 7 : cmc, count }));
}

function getAvgCmc(main: Array<{ cmc?: number; quantity?: number }>): number | null {
  let total = 0;
  let n = 0;
  for (const c of main) {
    const cmc = typeof c.cmc === "number" ? c.cmc : 0;
    const qty = c.quantity ?? 1;
    total += cmc * qty;
    n += qty;
  }
  return n > 0 ? Math.round((total / n) * 10) / 10 : null;
}

interface DeckStatsProps {
  main: Array<{ name: string; quantity?: number; typeLine?: string; cmc?: number }>;
  lands: Array<{ name: string; quantity?: number }>;
  totalNonlands?: number;
  totalLands?: number;
  compact?: boolean;
  /** Short explanation of how the deck is meant to be played (AI-generated when available). */
  strategyExplanation?: string | null;
}

export function DeckStats({ main, lands, totalNonlands, totalLands, compact, strategyExplanation }: DeckStatsProps) {
  const byType = countByType(main, lands);
  const curve = getCurve(main);
  const avgCmc = getAvgCmc(main);
  const maxCurve = Math.max(1, ...curve.map((b) => b.count));

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <section>
        <h3 className={compact ? "text-sm font-medium text-[var(--muted)]" : "text-base font-semibold text-[var(--foreground)]"}>
          Card types
        </h3>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
          {CARD_TYPES.filter((t) => byType[t] > 0).map((t) => (
            <span key={t} className="text-[var(--muted)]">
              {t}: <span className="font-medium text-[var(--foreground)]">{byType[t]}</span>
            </span>
          ))}
        </div>
      </section>

      {curve.some((b) => b.count > 0) && (
        <section>
          <h3 className={compact ? "text-sm font-medium text-[var(--muted)]" : "text-base font-semibold text-[var(--foreground)]"}>
            Mana curve (nonlands)
          </h3>
          <div className="mt-2 flex items-end gap-0.5">
            {curve.map((b) => (
              <div
                key={b.cmc}
                className="flex flex-col items-center gap-0.5"
                style={{ width: "2rem" }}
                title={`CMC ${b.cmc === 7 ? "7+" : b.cmc}: ${b.count} cards`}
              >
                <div
                  className="w-full min-h-[0.25rem] rounded-t bg-[var(--accent)] transition-all"
                  style={{ height: `${maxCurve > 0 ? (b.count / maxCurve) * 4 : 0}rem` }}
                />
                <span className="text-xs text-[var(--muted)]">
                  {b.cmc === 7 ? "7+" : b.cmc}
                </span>
              </div>
            ))}
          </div>
          {avgCmc != null && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Average CMC: <span className="font-medium text-[var(--foreground)]">{avgCmc}</span>
            </p>
          )}
        </section>
      )}

      {strategyExplanation && (
        <section>
          <h3 className={compact ? "text-sm font-medium text-[var(--muted)]" : "text-base font-semibold text-[var(--foreground)]"}>
            How to play this deck
          </h3>
          <div className="card mt-1 bg-[var(--background)]/80 px-3 py-2">
            <p className="text-sm text-[var(--foreground)]">{strategyExplanation}</p>
          </div>
        </section>
      )}

      {(totalNonlands != null || totalLands != null) && (
        <p className="text-sm text-[var(--muted)]">
          {totalNonlands != null && totalLands != null
            ? `${totalNonlands} nonlands, ${totalLands} lands`
            : totalNonlands != null
              ? `${totalNonlands} nonlands`
              : `${totalLands} lands`}
        </p>
      )}
    </div>
  );
}

interface DeckListByTypeProps {
  main: Array<{ name: string; quantity?: number; typeLine?: string; role?: string; imageUrl?: string; reason?: string }>;
  lands: Array<{ name: string; quantity?: number; imageUrl?: string; reason?: string }>;
  showRole?: boolean;
  showReason?: boolean;
  compact?: boolean;
}

const PREVIEW_CARD_W = 280;
const PREVIEW_CARD_H = 392;
const PREVIEW_PADDING = 24;
const PREVIEW_OFFSET = 12;

function clampPreviewPosition(clientX: number, clientY: number): { left: number; top: number } {
  const w = PREVIEW_CARD_W + PREVIEW_PADDING * 2;
  const h = PREVIEW_CARD_H + PREVIEW_PADDING * 2 + 28; // +label
  let left = clientX + PREVIEW_OFFSET;
  let top = clientY + PREVIEW_OFFSET;
  if (typeof window !== "undefined") {
    if (left + w > window.innerWidth) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;
    if (top + h > window.innerHeight) top = window.innerHeight - h - 8;
    if (top < 8) top = 8;
  }
  return { left, top };
}

/** Larger card preview shown at cursor. Standard card ratio ~2.5:3.5. */
function CardHoverPreview({
  name,
  imageUrl,
  left,
  top,
  onCancelHide,
  onRequestClose,
}: {
  name: string;
  imageUrl: string;
  left: number;
  top: number;
  onCancelHide: () => void;
  onRequestClose: () => void;
}) {
  return (
    <div
      className="fixed z-50 rounded-lg border-2 border-zinc-300 bg-zinc-100 p-3 shadow-2xl dark:border-zinc-600 dark:bg-zinc-800 pointer-events-auto"
      style={{ left, top }}
      onMouseEnter={onCancelHide}
      onMouseLeave={onRequestClose}
      role="tooltip"
      aria-label={`Preview: ${name}`}
    >
      <img
        src={imageUrl}
        alt={name}
        className="block rounded shadow-lg"
        style={{ width: `${PREVIEW_CARD_W}px`, height: `${PREVIEW_CARD_H}px`, objectFit: "cover" }}
      />
      <p className="mt-2 max-w-[280px] truncate text-center text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {name}
      </p>
    </div>
  );
}

export function DeckListByType({ main, lands, showRole = true, showReason = false, compact }: DeckListByTypeProps) {
  const [hovered, setHovered] = useState<{ name: string; imageUrl: string; left: number; top: number } | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPreview = useCallback((name: string, imageUrl: string | undefined, clientX: number, clientY: number) => {
    if (!imageUrl) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    const { left, top } = clampPreviewPosition(clientX, clientY);
    setHovered({ name, imageUrl, left, top });
  }, []);

  const updatePreviewPosition = useCallback((clientX: number, clientY: number) => {
    setHovered((prev) => {
      if (!prev) return null;
      const { left, top } = clampPreviewPosition(clientX, clientY);
      return { ...prev, left, top };
    });
  }, []);

  const hidePreview = useCallback((delayMs = 0) => {
    if (delayMs === 0) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setHovered(null);
    } else {
      hideTimeoutRef.current = setTimeout(() => {
        hideTimeoutRef.current = null;
        setHovered(null);
      }, delayMs);
    }
  }, []);

  const byType = groupMainByType(main);
  const maxHeight = compact ? "max-h-48" : "max-h-96";
  // Always show Enchantments and Sorceries (even when 0) so we can tell the user we couldn't find any
  const typesToShow = DISPLAY_TYPE_ORDER.filter(
    (type) => byType[type].length > 0 || type === "Enchantment" || type === "Sorcery"
  );

  // Group lands by name so we show "10x Swamp" instead of ten "1x Swamp" lines
  const groupedLands = (() => {
    const byName = new Map<string, { quantity: number; imageUrl?: string; reason?: string }>();
    for (const c of lands) {
      const key = c.name;
      const existing = byName.get(key);
      const qty = c.quantity ?? 1;
      const reason = (c as { reason?: string }).reason;
      if (existing) {
        existing.quantity += qty;
        if (reason && !existing.reason) existing.reason = reason;
      } else {
        byName.set(key, { quantity: qty, imageUrl: c.imageUrl, reason });
      }
    }
    return Array.from(byName.entries(), ([name, { quantity, imageUrl, reason }]) => ({ name, quantity, imageUrl, reason }));
  })();
  const totalLandCards = groupedLands.reduce((s, c) => s + c.quantity, 0);

  const sectionLabel = (type: string) => (type === "Other" ? "Other" : `${type}s`);

  const emptySlotMessage = "Couldn't find any good ones in your collection for this commander.";

  return (
    <>
      <div className="grid min-w-0 grid-cols-2 gap-4">
        {typesToShow.map((type) => {
          const cards = byType[type];
          const isEmpty = cards.length === 0;
          return (
            <section key={type} className="card p-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {sectionLabel(type)} ({cards.length})
              </h3>
              {isEmpty ? (
                <p className="mt-2 rounded bg-[var(--background)]/80 px-3 py-4 text-sm italic text-[var(--muted)]">
                  {emptySlotMessage}
                </p>
              ) : (
                <ul className={`mt-2 overflow-auto rounded bg-[var(--background)]/80 p-3 ${maxHeight}`}>
                  {cards.map((c, i) => (
                    <li key={`${c.name}-${i}`} className="flex items-center gap-3 py-1.5 text-sm">
                      {c.imageUrl ? (
                        <span
                          className="relative inline-block cursor-pointer"
                          onMouseEnter={(e) => showPreview(c.name, c.imageUrl, e.clientX, e.clientY)}
                          onMouseMove={(e) => updatePreviewPosition(e.clientX, e.clientY)}
                          onMouseLeave={() => hidePreview(200)}
                        >
                          <img
                            src={c.imageUrl}
                            alt=""
                            className="h-16 w-[44px] shrink-0 rounded object-cover shadow-md border border-zinc-200 dark:border-zinc-600"
                            loading="lazy"
                            title={c.name}
                          />
                        </span>
                      ) : (
                        <span className="h-16 w-[44px] shrink-0 rounded bg-zinc-300 dark:bg-zinc-600" aria-hidden />
                      )}
                      <span
                        title={showReason && c.reason ? c.reason : undefined}
                        className={showReason && c.reason ? "cursor-help border-b border-dotted border-[var(--muted)]" : ""}
                      >
                        {c.quantity}x {c.name}
                        {showRole && c.role && <span className="text-zinc-500"> — {c.role}</span>}
                        {showReason && c.reason && (
                          <span className="ml-1 text-xs text-[var(--muted)]" title={c.reason}>
                            (why?)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        <section className="card p-4">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Lands ({totalLandCards})
          </h3>
          <ul className={`mt-2 overflow-auto rounded bg-[var(--background)]/80 p-3 ${maxHeight}`}>
            {groupedLands.map((c) => (
              <li key={c.name} className="flex items-center gap-3 py-1.5 text-sm">
                {c.imageUrl ? (
                  <span
                    className="relative inline-block cursor-pointer"
                    onMouseEnter={(e) => showPreview(c.name, c.imageUrl, e.clientX, e.clientY)}
                    onMouseMove={(e) => updatePreviewPosition(e.clientX, e.clientY)}
                    onMouseLeave={() => hidePreview(200)}
                  >
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="h-16 w-[44px] shrink-0 rounded object-cover shadow-md border border-zinc-200 dark:border-zinc-600"
                      loading="lazy"
                      title={c.name}
                    />
                  </span>
                ) : (
                  <span className="h-16 w-[44px] shrink-0 rounded bg-zinc-300 dark:bg-zinc-600" aria-hidden />
                )}
                <span
                  title={showReason && (c as { reason?: string }).reason ? (c as { reason?: string }).reason : undefined}
                  className={showReason && (c as { reason?: string }).reason ? "cursor-help border-b border-dotted border-[var(--muted)]" : ""}
                >
                  {c.quantity}x {c.name}
                  {showReason && (c as { reason?: string }).reason && <span className="ml-1 text-xs text-[var(--muted)]">(why?)</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {hovered && (
        <CardHoverPreview
          name={hovered.name}
          imageUrl={hovered.imageUrl}
          left={hovered.left}
          top={hovered.top}
          onCancelHide={() => {
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current);
              hideTimeoutRef.current = null;
            }
          }}
          onRequestClose={() => hidePreview(150)}
        />
      )}
    </>
  );
}
