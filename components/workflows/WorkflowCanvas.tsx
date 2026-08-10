"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Mail, Link2, Loader2, Sparkles, Save } from "lucide-react";
import { nodeTypes } from "./nodes";
import { saveWorkflow, getWorkflow, type WorkflowCanvas as WorkflowCanvasData } from "@/lib/actions/workflows";
import { generateSequenceStepMessage } from "@/lib/actions/ai";
import type { AudienceOption } from "@/lib/actions/campaigns";

let idCounter = 1;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function defaultNodes(): Node[] {
  return [
    {
      id: nextId("source"),
      type: "source",
      position: { x: 40, y: 160 },
      data: { sourceType: "all_leads", segmentId: null, segmentLabel: null },
    },
  ];
}

export default function WorkflowCanvas({
  workflowId,
  audiences,
  onClose,
}: {
  workflowId: number | null;
  audiences: AudienceOption[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(workflowId ? [] : defaultNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(Boolean(workflowId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!workflowId) return;
    getWorkflow(workflowId)
      .then((wf) => {
        setName(wf.name);
        setNodes(wf.canvas.nodes as Node[]);
        setEdges(wf.canvas.edges as Edge[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load workflow"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  function updateSelectedData(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setNodes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }

  function addActionNode(channel: "email" | "linkedin_dm") {
    const count = nodes.length;
    const id = nextId(channel);
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: channel,
        position: { x: 320 + (count % 4) * 60, y: 40 + count * 130 },
        data: { channel, waitDays: prev.length > 1 ? 2 : 0, subject: "", body: "" },
      },
    ]);
    setSelectedId(id);
  }

  async function handleAiWrite() {
    if (!selectedNode) return;
    const channel = (selectedNode.data as { channel?: string }).channel;
    if (channel !== "email" && channel !== "linkedin_dm") return;

    const sourceNode = nodes.find((n) => n.type === "source");
    const sourceData = sourceNode?.data as { sourceType?: string; segmentId?: number | null } | undefined;
    const audience =
      sourceData?.sourceType === "segment"
        ? audiences.find((a) => a.id === sourceData.segmentId)
        : audiences.find((a) => a.id === null);

    const stepIndex = nodes.filter((n) => n.type !== "source").findIndex((n) => n.id === selectedId);

    setAiLoading(true);
    setError(null);
    try {
      const draft = await generateSequenceStepMessage({
        channel,
        stepIndex: Math.max(stepIndex, 0),
        audienceLabel: audience?.name ?? "your target audience",
        audiencePrompt: audience?.prompt ?? null,
        campaignName: name || audience?.name,
      });
      updateSelectedData(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate AI draft");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const canvas: WorkflowCanvasData = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type as "source" | "email" | "linkedin_dm",
          position: n.position,
          data: n.data as Record<string, unknown>,
        })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      };
      await saveWorkflow({ id: workflowId ?? undefined, name, canvas });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save workflow");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between gap-4 px-4 md:px-8 py-4 border-b border-white/10 flex-wrap">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workflow name"
            className="flex-1 min-w-0 bg-transparent border-b border-white/10 focus:border-white/30 text-white text-sm px-1 py-1 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {error && <p className="text-xs text-red-400 max-w-xs truncate">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              colorMode="dark"
              fitView
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
              <Panel position="top-left">
                <div className="flex flex-col gap-2 bg-[#0A0A0A] border border-white/10 rounded-xl p-2">
                  <button
                    onClick={() => addActionNode("email")}
                    className="flex items-center gap-2 text-xs text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    + Email step
                  </button>
                  <button
                    onClick={() => addActionNode("linkedin_dm")}
                    className="flex items-center gap-2 text-xs text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5 text-sky-400" />
                    + LinkedIn DM step
                  </button>
                </div>
              </Panel>
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {selectedNode && (
          <div className="w-80 shrink-0 border-l border-white/10 bg-[#0A0A0A] p-4 overflow-y-auto">
            {selectedNode.type === "source" ? (
              <SourcePanel
                data={selectedNode.data as { sourceType?: string; segmentId?: number | null }}
                audiences={audiences}
                onChange={(patch) => updateSelectedData(patch)}
              />
            ) : (
              <ActionPanel
                data={selectedNode.data as { channel?: string; waitDays?: number; subject?: string; body?: string }}
                aiLoading={aiLoading}
                onChange={(patch) => updateSelectedData(patch)}
                onAiWrite={handleAiWrite}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SourcePanel({
  data,
  audiences,
  onChange,
}: {
  data: { sourceType?: string; segmentId?: number | null };
  audiences: AudienceOption[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const segments = audiences.filter((a) => a.id !== null);
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">Source</h3>
      <p className="text-xs text-neutral-500">Who this workflow runs against when attached to a campaign.</p>

      <div className="space-y-2">
        <button
          onClick={() => onChange({ sourceType: "all_leads", segmentId: null, segmentLabel: null })}
          className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
            data.sourceType !== "segment" ? "border-blue-500/40 bg-blue-500/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"
          }`}
        >
          All qualified leads
        </button>
        {segments.map((s) => (
          <button
            key={s.id}
            onClick={() => onChange({ sourceType: "segment", segmentId: s.id, segmentLabel: s.name })}
            className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              data.sourceType === "segment" && data.segmentId === s.id
                ? "border-blue-500/40 bg-blue-500/10 text-white"
                : "border-white/10 text-neutral-300 hover:bg-white/5"
            }`}
          >
            {s.name}
            <span className="block text-xs text-neutral-500 mt-0.5">{s.leadCount.toLocaleString()} leads</span>
          </button>
        ))}
        {segments.length === 0 && (
          <p className="text-xs text-neutral-600">No saved audiences yet — build one from the Audience page.</p>
        )}
      </div>
    </div>
  );
}

function ActionPanel({
  data,
  aiLoading,
  onChange,
  onAiWrite,
}: {
  data: { channel?: string; waitDays?: number; subject?: string; body?: string };
  aiLoading: boolean;
  onChange: (patch: Record<string, unknown>) => void;
  onAiWrite: () => void;
}) {
  const isEmail = data.channel === "email";
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Step</h3>
        <select
          value={data.channel}
          onChange={(e) => onChange({ channel: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2 focus:outline-none"
        >
          <option value="email">Email</option>
          <option value="linkedin_dm">LinkedIn DM</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">Wait before sending (days)</label>
        <input
          type="number"
          min={0}
          value={data.waitDays ?? 0}
          onChange={(e) => onChange({ waitDays: Number(e.target.value) })}
          className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2 focus:outline-none"
        />
      </div>

      {isEmail && (
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Subject</label>
          <input
            value={data.subject ?? ""}
            onChange={(e) => onChange({ subject: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2 focus:outline-none"
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-neutral-500">Message</label>
          <button
            onClick={onAiWrite}
            disabled={aiLoading}
            className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI write
          </button>
        </div>
        <textarea
          value={data.body ?? ""}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={isEmail ? 6 : 4}
          placeholder={aiLoading ? "Generating with AI…" : "Write a message or click AI write"}
          className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2 focus:outline-none resize-none"
        />
      </div>
    </div>
  );
}
