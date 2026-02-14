"use client";

import { useEffect, useMemo, useState } from "react";
import { useDemoStore } from "@/stores/useDemoStore";
import { STATUS_LABELS, AGENT_COLORS } from "@/types";
import type { AgentStatus } from "@/types";
import { Minimap } from "./Minimap";

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "#595653",
  thinking: "#c87830",
  streaming: "#d4a040",
  tool_calling: "#d4a040",
  waiting: "#74747C",
  error: "#c45050",
  done: "#548C5A",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function AgentCard({ agentId }: { agentId: string }) {
  const agent = useDemoStore((s) => s.agents.find((a) => a.id === agentId));
  const selectedId = useDemoStore((s) => s.selectedAgentId);
  const selectAgent = useDemoStore((s) => s.selectAgent);

  if (!agent) return null;

  const isSelected = selectedId === agent.id;
  const accent = AGENT_COLORS[agent.agent_type];
  const showPulse =
    agent.status === "thinking" ||
    agent.status === "streaming" ||
    agent.status === "tool_calling";

  return (
    <button
      onClick={() => selectAgent(isSelected ? null : agent.id)}
      className="hover-row"
      style={{
        width: "100%",
        borderRadius: 8,
        border: `1px solid ${isSelected ? `${accent}66` : "rgba(89,86,83,0.22)"}`,
        background: isSelected ? "rgba(89,86,83,0.16)" : "rgba(26,26,25,0.7)",
        padding: "8px 10px",
        textAlign: "left",
        cursor: "pointer",
        color: "#9A9692",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: accent,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#9A9692",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {agent.name}
        </span>
        <span
          className={showPulse ? "pulse-amber" : undefined}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: STATUS_COLOR[agent.status],
            flexShrink: 0,
          }}
        />
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#74747C",
          marginBottom: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {agent.currentTask}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 10,
          color: "#595653",
        }}
      >
        <span>{formatTokens(agent.tokens_input)} in</span>
        <span>{formatTokens(agent.tokens_output)} out</span>
        <span>{agent.files_modified} files</span>
        <span style={{ color: STATUS_COLOR[agent.status], marginLeft: "auto" }}>
          {STATUS_LABELS[agent.status]}
        </span>
      </div>
    </button>
  );
}

function TopBar({
  activeCount,
  totalTokens,
  agentCount,
}: {
  activeCount: number;
  totalTokens: number;
  agentCount: number;
}) {
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className="glass-panel"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        borderTop: "none",
        borderLeft: "none",
        borderRight: "none",
        borderBottom: "1px solid rgba(89,86,83,0.22)",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}
      >
        <span style={{ fontSize: 16, letterSpacing: 1 }}>⬢</span>
        <span style={{ color: "#9A9692", fontSize: 12, fontWeight: 500 }}>
          Live Demo
        </span>
        <span style={{ color: "#595653" }}>|</span>
        <nav className="hidden items-center gap-14 md:flex">
          <span className="nav-item" style={{ color: "#74747C", fontSize: 12 }}>
            File
          </span>
          <span className="nav-item" style={{ color: "#74747C", fontSize: 12 }}>
            Edit
          </span>
          <span className="nav-item" style={{ color: "#74747C", fontSize: 12 }}>
            View
          </span>
          <a
            className="nav-item"
            href="#features"
            style={{ color: "#74747C", fontSize: 12 }}
          >
            Docs
          </a>
        </nav>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#74747C",
          fontSize: 12,
          whiteSpace: "nowrap",
        }}
      >
        <span className="glow-amber hidden md:inline" style={{ color: "#9A9692" }}>
          agent-space
        </span>
        <span style={{ color: "#595653" }}>|</span>
        <span>
          <strong style={{ color: "#9A9692" }}>{activeCount}</strong>
          <span style={{ color: "#595653" }}>/{agentCount}</span> active
        </span>
        <span style={{ color: "#595653" }}>|</span>
        <span>
          <strong style={{ color: "#9A9692" }}>{formatTokens(totalTokens)}</strong>{" "}
          tokens
        </span>
        <span style={{ color: "#595653" }}>|</span>
        <span style={{ color: "#9A9692" }}>{timeStr}</span>
      </div>
    </header>
  );
}

function ToastStack() {
  const toasts = useDemoStore((s) => s.toasts);
  const removeToast = useDemoStore((s) => s.removeToast);

  useEffect(() => {
    const timeouts = toasts.map((toast) =>
      setTimeout(() => removeToast(toast.id), 4000)
    );
    return () => timeouts.forEach(clearTimeout);
  }, [toasts, removeToast]);

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass-panel toast-in"
          style={{
            minWidth: 220,
            borderRadius: 8,
            padding: "7px 12px",
            border:
              toast.type === "error"
                ? "1px solid rgba(196,80,80,0.4)"
                : toast.type === "success"
                  ? "1px solid rgba(84,140,90,0.4)"
                  : "1px solid rgba(212,160,64,0.4)",
            color:
              toast.type === "error"
                ? "#c45050"
                : toast.type === "success"
                  ? "#548C5A"
                  : "#d4a040",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#9A9692" }}>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export function HUD() {
  const agents = useDemoStore((s) => s.agents);

  const { activeCount, totalTokens } = useMemo(() => {
    const active = agents.filter(
      (a) => a.status !== "idle" && a.status !== "done"
    ).length;
    const tokens = agents.reduce(
      (sum, a) => sum + a.tokens_input + a.tokens_output,
      0
    );
    return { activeCount: active, totalTokens: tokens };
  }, [agents]);

  return (
    <>
      <TopBar
        activeCount={activeCount}
        totalTokens={totalTokens}
        agentCount={agents.length}
      />

      <aside className="fixed top-[50px] left-4 z-30 hidden w-[290px] md:block">
        <div
          className="glass-panel"
          style={{ borderRadius: 10, padding: 8, maxHeight: "calc(100vh - 190px)" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              padding: "0 2px",
            }}
          >
            <span
              className="pulse-dot"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#548C5A",
              }}
            />
            <span
              style={{
                color: "#74747C",
                fontSize: 10,
                letterSpacing: 1,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Active Agents
            </span>
            <span style={{ marginLeft: "auto", color: "#595653", fontSize: 10 }}>
              {agents.length}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              overflowY: "auto",
              maxHeight: "calc(100vh - 240px)",
              paddingRight: 2,
            }}
          >
            {agents.map((agent) => (
              <AgentCard key={agent.id} agentId={agent.id} />
            ))}
          </div>
        </div>
      </aside>

      <div className="fixed right-4 bottom-4 z-30 hidden md:block">
        <div className="glass-panel" style={{ borderRadius: 10, padding: 8 }}>
          <div
            style={{
              color: "#74747C",
              fontSize: 10,
              letterSpacing: 1,
              fontWeight: 600,
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            Office Map
          </div>
          <Minimap />
        </div>
      </div>

      <div className="fixed right-4 bottom-4 left-4 z-30 md:hidden">
        <div
          className="glass-panel"
          style={{
            borderRadius: 8,
            border: "1px solid rgba(89,86,83,0.28)",
            padding: "7px 10px",
            display: "flex",
            justifyContent: "space-between",
            color: "#74747C",
            fontSize: 11,
          }}
        >
          <span>
            active <strong style={{ color: "#9A9692" }}>{activeCount}</strong>
          </span>
          <span>
            tokens <strong style={{ color: "#9A9692" }}>{formatTokens(totalTokens)}</strong>
          </span>
          <a href="#features" style={{ color: "#548C5A", fontWeight: 600 }}>
            docs
          </a>
        </div>
      </div>

      <ToastStack />
    </>
  );
}
