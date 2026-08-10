"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Users2, Mail, Link2 } from "lucide-react";

const CARD = "rounded-xl border bg-[#0A0A0A] px-4 py-3 w-[240px] text-left shadow-lg";

export function SourceNode({ data, selected }: NodeProps) {
  const d = data as { sourceType?: string; segmentLabel?: string };
  return (
    <div className={`${CARD} ${selected ? "border-blue-500/60" : "border-white/15"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Users2 className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Source</span>
      </div>
      <p className="text-sm text-white truncate">
        {d.sourceType === "segment" ? d.segmentLabel || "Pick a Lead List" : "All qualified leads"}
      </p>
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2.5 !h-2.5" />
    </div>
  );
}

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as { channel?: string; waitDays?: number; subject?: string; body?: string };
  const isEmail = d.channel === "email";
  const Icon = isEmail ? Mail : Link2;
  return (
    <div className={`${CARD} ${selected ? "border-blue-500/60" : "border-white/15"}`}>
      <Handle type="target" position={Position.Left} className="!bg-white/40 !w-2.5 !h-2.5" />
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 shrink-0 ${isEmail ? "text-purple-400" : "text-sky-400"}`} />
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
          {isEmail ? "Email" : "LinkedIn DM"}
        </span>
        <span className="text-[10px] text-neutral-500 ml-auto shrink-0">
          {d.waitDays ? `wait ${d.waitDays}d` : "immediately"}
        </span>
      </div>
      {isEmail && d.subject ? <p className="text-xs text-neutral-400 truncate mb-0.5">{d.subject}</p> : null}
      <p className="text-xs text-neutral-500 line-clamp-2">{d.body?.trim() || "No message yet — click to write"}</p>
      <Handle type="source" position={Position.Right} className="!bg-white/40 !w-2.5 !h-2.5" />
    </div>
  );
}

export const nodeTypes = {
  source: SourceNode,
  email: ActionNode,
  linkedin_dm: ActionNode,
};
