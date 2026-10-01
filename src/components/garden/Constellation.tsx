"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { Check, Minus, Plus, Sparkles, X } from "lucide-react";
import { resolveSuggestedLink } from "@/lib/actions/memories";
import { MEMORY_KIND_LABELS, type MemoryKind, type MemoryLink } from "@/lib/types";
import { AiLabel } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";

interface NodeIn {
  id: string;
  title: string;
  kind: MemoryKind;
  tags: string[];
  date: string;
  pinned: boolean;
}
type SimNode = NodeIn & SimulationNodeDatum & { degree: number };
type Edge = SimulationLinkDatum<SimNode> & { kind: "manual" | "ai" | "suggested" | "tag"; linkId?: string; label?: string };

const W = 1000;
const H = 680;

// Tags shared by many memories would draw a hairball and imply nothing.
const MAX_TAG_GROUP = 10;

function buildGraph(nodes: NodeIn[], links: MemoryLink[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: Edge[] = [];
  for (const l of links) {
    if (!byId.has(l.from_id) || !byId.has(l.to_id)) continue;
    edges.push({
      source: l.from_id,
      target: l.to_id,
      linkId: l.id,
      label: l.note ?? undefined,
      kind: l.status === "suggested" ? "suggested" : l.origin === "ai_suggested" ? "ai" : "manual",
    });
  }
  const linked = new Set(edges.map((e) => [e.source, e.target].sort().join("|")));
  const groups = new Map<string, string[]>();
  for (const n of nodes) for (const t of n.tags) groups.set(t, [...(groups.get(t) ?? []), n.id]);
  const tagPairs = new Set<string>();
  for (const [tag, ids] of groups) {
    if (ids.length < 2 || ids.length > MAX_TAG_GROUP) continue;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join("|");
        if (linked.has(key) || tagPairs.has(key)) continue;
        tagPairs.add(key);
        edges.push({ source: ids[i]!, target: ids[j]!, kind: "tag", label: `#${tag}` });
      }
  }
  return edges;
}

export function Constellation({ nodes, links }: { nodes: NodeIn[]; links: MemoryLink[] }) {
  const router = useRouter();
  const [show, setShow] = useState({ manual: true, tag: true, suggested: true });
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const { simNodes, edges } = useMemo(() => {
    const edges = buildGraph(nodes, links);
    const degree = new Map<string, number>();
    for (const e of edges) {
      if (e.kind === "tag") continue;
      degree.set(e.source as string, (degree.get(e.source as string) ?? 0) + 1);
      degree.set(e.target as string, (degree.get(e.target as string) ?? 0) + 1);
    }
    // Seeded starting positions so the same garden always draws the same sky.
    const simNodes: SimNode[] = nodes.map((n, i) => ({
      ...n,
      degree: degree.get(n.id) ?? 0,
      x: W / 2 + Math.cos(i * 2.399) * (40 + i * 3),
      y: H / 2 + Math.sin(i * 2.399) * (40 + i * 3),
    }));
    const sim = forceSimulation(simNodes)
      .force(
        "link",
        forceLink<SimNode, Edge>(edges.map((e) => ({ ...e })))
          .id((d) => d.id)
          .distance((e) => (e.kind === "tag" ? 120 : 70))
          .strength((e) => (e.kind === "tag" ? 0.08 : 0.5)),
      )
      .force("charge", forceManyBody().strength(-90))
      .force("x", forceX(W / 2).strength(0.04))
      .force("y", forceY(H / 2).strength(0.06))
      .force("collide", forceCollide(18))
      .stop();
    sim.tick(320);
    // Fit the drawing to the frame, so a small garden isn't a speck in the middle.
    const xs = simNodes.map((n) => n.x!);
    const ys = simNodes.map((n) => n.y!);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 90;
    const scale = Math.min(2.6, (W - pad * 2) / Math.max(maxX - minX, 1), (H - pad * 2) / Math.max(maxY - minY, 1));
    for (const n of simNodes) {
      n.x = W / 2 + (n.x! - (minX + maxX) / 2) * scale;
      n.y = H / 2 + (n.y! - (minY + maxY) / 2) * scale;
    }
    return { simNodes, edges };
  }, [nodes, links]);

  const pos = useMemo(() => new Map(simNodes.map((n) => [n.id, n])), [simNodes]);
  const focus = hover ?? selected;
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const e of edges) {
      if (e.kind === "tag" && !show.tag) continue;
      if (e.source === focus) s.add(e.target as string);
      if (e.target === focus) s.add(e.source as string);
    }
    return s;
  }, [focus, edges, show.tag]);

  const visibleEdges = edges.filter((e) =>
    e.kind === "tag" ? show.tag : e.kind === "suggested" ? show.suggested : show.manual,
  );
  const sel = selected ? pos.get(selected) : null;
  const suggestions = edges.filter((e) => e.kind === "suggested");

  async function suggest() {
    setSuggesting(true);
    setSuggestNote(null);
    const res = await fetch("/api/garden/suggest-links", { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as { created?: number; error?: string };
    setSuggesting(false);
    if (!res.ok) setSuggestNote(json.error ?? "Could not suggest connections right now.");
    else {
      setSuggestNote(json.created ? `${json.created} possible connection${json.created === 1 ? "" : "s"} to review.` : "No new connections stood out.");
      router.refresh();
    }
  }

  if (nodes.length < 2) {
    return <p className="py-20 text-center font-serif text-[17px] text-ink-faint">The constellation appears once there are a few memories to connect.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-sunken/60">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[62vh] min-h-[420px] w-full touch-none select-none"
          role="group"
          aria-label="Constellation of your memories"
          onPointerDown={(e) => {
            if ((e.target as Element).closest("[data-node],[data-edge]")) return;
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const scale = W / rect.width / zoom;
            setPan({ x: drag.current.px + (e.clientX - drag.current.x) * scale, y: drag.current.py + (e.clientY - drag.current.y) * scale });
          }}
          onPointerUp={() => (drag.current = null)}
          onClick={(e) => {
            if (!(e.target as Element).closest("[data-node],[data-edge]")) {
              setSelected(null);
              setSelectedEdge(null);
            }
          }}
        >
          <g transform={`translate(${W / 2} ${H / 2}) scale(${zoom}) translate(${-W / 2 + pan.x} ${-H / 2 + pan.y})`}>
            {visibleEdges.map((e, i) => {
              const a = pos.get(e.source as string)!;
              const b = pos.get(e.target as string)!;
              const lit = neighbours ? neighbours.has(a.id) && neighbours.has(b.id) : false;
              const dim = neighbours && !lit;
              return (
                <g key={i} data-edge={e.kind === "suggested" ? "1" : undefined}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={e.kind === "tag" ? "var(--ink)" : e.kind === "manual" ? "var(--accent)" : "var(--accent-2)"}
                    strokeOpacity={dim ? 0.04 : e.kind === "tag" ? (lit ? 0.35 : 0.1) : lit ? 0.9 : 0.45}
                    strokeWidth={e.kind === "tag" ? 0.8 : 1.3}
                    strokeDasharray={e.kind === "tag" ? "2 5" : e.kind === "suggested" ? "6 5" : undefined}
                  />
                  {e.kind === "suggested" && (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={14}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedEdge(e);
                        setSelected(null);
                      }}
                    >
                      <title>Suggested connection: click to review</title>
                    </line>
                  )}
                </g>
              );
            })}
            {simNodes.map((n) => {
              const r = 4 + Math.min(n.degree, 6) * 1.4 + (n.pinned ? 1.5 : 0);
              const dim = neighbours && !neighbours.has(n.id);
              const active = n.id === focus;
              return (
                <g
                  key={n.id}
                  data-node
                  transform={`translate(${n.x} ${n.y})`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.title}, ${MEMORY_KIND_LABELS[n.kind]}`}
                  className="cursor-pointer outline-none"
                  opacity={dim ? 0.25 : 1}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover(null)}
                  onClick={() => {
                    setSelected(n.id);
                    setSelectedEdge(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/garden/${n.id}`);
                    if (e.key === " ") {
                      e.preventDefault();
                      setSelected(n.id);
                    }
                  }}
                >
                  <circle r={r + 7} fill="var(--accent)" opacity={active ? 0.18 : n.degree ? 0.06 : 0} />
                  <circle r={r} fill={n.kind === "goal" ? "var(--accent)" : n.kind === "relationship" ? "var(--accent-2)" : "var(--ink)"} fillOpacity={n.degree ? 0.95 : 0.6} />
                  {(active || n.degree >= 3 || simNodes.length <= 24) && (
                    <text y={-r - 8} textAnchor="middle" fill="var(--ink-soft)" fontSize={12} fontFamily="var(--font-sans)" style={{ pointerEvents: "none" }}>
                      {n.title.length > 30 ? `${n.title.slice(0, 28)}…` : n.title}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="absolute bottom-3 right-3 flex gap-1">
          <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} className="rounded-full border border-line bg-bg/80 p-2 text-ink-soft hover:text-ink">
            <Minus size={14} />
          </button>
          <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z * 1.25))} className="rounded-full border border-line bg-bg/80 p-2 text-ink-soft hover:text-ink">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <aside className="space-y-8">
        {sel ? (
          <div>
            <p className="eyebrow">{MEMORY_KIND_LABELS[sel.kind]}</p>
            <h3 className="display mt-2 text-[28px] leading-tight">{sel.title}</h3>
            <p className="mt-1 text-[12.5px] text-ink-faint">
              {sel.date} · {sel.degree} connection{sel.degree === 1 ? "" : "s"}
            </p>
            <Link href={`/garden/${sel.id}`} className="mt-4 inline-block text-[14px] text-accent hover:underline">
              Open this memory →
            </Link>
          </div>
        ) : selectedEdge ? (
          <div className="rounded-2xl border border-dashed border-accent-2/40 p-5">
            <AiLabel label="suggestion" />
            <p className="mt-3 text-[14px] text-ink-soft">
              <span className="text-ink">{pos.get(selectedEdge.source as string)?.title}</span> and{" "}
              <span className="text-ink">{pos.get(selectedEdge.target as string)?.title}</span> may be related.
            </p>
            {selectedEdge.label && <p className="mt-2 text-[13px] italic text-ink-faint">Why: {selectedEdge.label}</p>}
            <div className="mt-4 flex gap-2">
              <button
                disabled={pending}
                onClick={() => start(async () => { await resolveSuggestedLink(selectedEdge.linkId!, true); setSelectedEdge(null); router.refresh(); })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] text-accent-ink"
              >
                <Check size={14} /> Connect
              </button>
              <button
                disabled={pending}
                onClick={() => start(async () => { await resolveSuggestedLink(selectedEdge.linkId!, false); setSelectedEdge(null); router.refresh(); })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-faint hover:text-ink-soft"
              >
                <X size={14} /> Not related
              </button>
            </div>
          </div>
        ) : (
          <p className="font-serif text-[15.5px] leading-relaxed text-ink-soft">
            Each point is a memory. Solid lines are connections you made or approved; dotted lines mean two memories share a tag. Where a point
            sits on the map means nothing by itself; only the lines do.
          </p>
        )}

        <fieldset className="space-y-2 text-[13.5px]">
          <legend className="eyebrow mb-2">Show</legend>
          {(
            [
              ["manual", "Your connections", "bg-accent"],
              ["tag", "Shared tags", "bg-ink-faint"],
              ["suggested", `AI suggestions${suggestions.length ? ` (${suggestions.length})` : ""}`, "bg-accent-2"],
            ] as const
          ).map(([key, label, dot]) => (
            <label key={key} className="flex cursor-pointer items-center gap-3 text-ink-soft">
              <input type="checkbox" checked={show[key]} onChange={(e) => setShow({ ...show, [key]: e.target.checked })} className="accent-[var(--accent)]" />
              <span className={cn("h-1.5 w-4 rounded-full", dot)} /> {label}
            </label>
          ))}
        </fieldset>

        <div className="border-t border-line pt-6">
          <button
            onClick={suggest}
            disabled={suggesting}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-accent-2/50 px-4 py-2 text-[13px] text-accent-2 transition-colors hover:bg-accent-2/10 disabled:opacity-50"
          >
            <Sparkles size={14} /> {suggesting ? "Looking…" : "Ask the AI for possible connections"}
          </button>
          <p className="mt-2 text-[12px] leading-snug text-ink-faint">
            Uses only memories available to the AI. Suggestions appear as dashed lines and are never added without your approval.
          </p>
          {suggestNote && <p className="mt-2 text-[12.5px] text-ink-soft">{suggestNote}</p>}
        </div>
      </aside>
    </div>
  );
}
