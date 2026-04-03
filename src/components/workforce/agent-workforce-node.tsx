"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { AgentNodeData } from "./agent-types";

const AVATAR_PALETTES = [
  "from-violet-600 to-fuchsia-600",
  "from-cyan-600 to-blue-600",
  "from-emerald-600 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export const AgentWorkforceNode = memo(function AgentWorkforceNode({
  id,
  data,
  selected,
}: NodeProps<Node<AgentNodeData>>) {
  const paletteClass = useMemo(
    () => AVATAR_PALETTES[hashString(id) % AVATAR_PALETTES.length],
    [id],
  );

  const subtitle = data.description?.trim() || "Workforce agent";
  const skillCount = data.skills?.length ?? 0;

  return (
    <div
      className={[
        "relative min-w-[240px] max-w-[280px] rounded-2xl border bg-slate-900/95 p-3 shadow-lg backdrop-blur-sm transition-shadow",
        selected
          ? "border-cyan-400 shadow-cyan-500/20 ring-2 ring-cyan-400/50"
          : "border-slate-600/80 hover:border-slate-500",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-slate-900 !bg-cyan-500"
      />

      <div className="flex gap-3">
        <div className="relative shrink-0">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${paletteClass} text-lg font-bold text-white shadow-inner`}
            aria-hidden
          >
            {getInitials(data.label)}
          </div>
          {data.avatarEmoji ? (
            <span
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-base shadow-md"
              title="Agent icon"
            >
              {data.avatarEmoji}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-sm font-semibold leading-tight text-white">{data.label}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-400">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex max-w-full items-center rounded-md bg-slate-800/90 px-2 py-0.5 font-mono text-[10px] text-cyan-300/95">
              {truncate(data.model, 18)}
            </span>
            {skillCount > 0 ? (
              <span className="rounded-md bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                {skillCount} skill{skillCount === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="rounded-md border border-dashed border-slate-600 px-2 py-0.5 text-[10px] text-slate-500">
                No skills yet
              </span>
            )}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-slate-900 !bg-cyan-500"
      />
    </div>
  );
});
