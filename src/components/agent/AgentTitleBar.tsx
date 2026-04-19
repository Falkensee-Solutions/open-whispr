import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { getAgentName } from "../../utils/agentName";
import {
  useOpenTabs,
  useActiveTabId,
  switchTab,
  closeTab,
  useConversations,
} from "../../stores/chatStore";

interface AgentTitleBarProps {
  onNewChat: () => void;
  onClose: () => void;
}

export function AgentTitleBar({ onNewChat, onClose }: AgentTitleBarProps) {
  const { t } = useTranslation();
  const agentName = getAgentName();
  const openTabs = useOpenTabs();
  const activeTabId = useActiveTabId();
  const conversations = useConversations();

  const hasTabs = openTabs.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col",
        "bg-surface-1",
        "border-b border-border/20",
        "shadow-[0_1px_2px_0_oklch(0_0_0/0.04)]",
        "select-none"
      )}
    >
      {/* Top bar: agent name + controls */}
      <div
        className="flex items-center justify-between h-8 px-3"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
          {agentName}
        </span>

        <div
          className="flex items-center gap-0.5"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={onNewChat}
            className={cn(
              "p-1 rounded-sm",
              "text-muted-foreground hover:text-foreground hover:bg-foreground/10",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
            )}
            aria-label={t("agentMode.titleBar.newChat")}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onClose}
            className={cn(
              "p-1 rounded-sm",
              "text-muted-foreground hover:text-foreground hover:bg-foreground/10",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
            )}
            aria-label={t("agentMode.titleBar.close")}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      {hasTabs && (
        <div
          className="flex items-center gap-0 overflow-x-auto px-1 h-7 bg-surface-0/50"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {openTabs.map((tabId) => {
            const conv = conversations.find((c) => c.id === tabId);
            const isActive = tabId === activeTabId;
            const label = conv?.title || t("agentMode.titleBar.newChat");
            return (
              <div
                key={tabId}
                className={cn(
                  "group flex items-center gap-1 px-2 py-0.5 rounded-t-md text-[11px] cursor-pointer",
                  "max-w-[150px] min-w-[60px]",
                  "transition-colors duration-100",
                  isActive
                    ? "bg-surface-0 text-foreground border-b-2 border-primary/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                )}
                onClick={() => switchTab(tabId)}
              >
                <span className="truncate flex-1">{label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tabId);
                  }}
                  aria-label={t("agentMode.titleBar.close")}
                  className={cn(
                    "p-0.5 rounded-sm shrink-0",
                    "opacity-0 group-hover:opacity-100",
                    "text-muted-foreground hover:text-foreground hover:bg-foreground/10",
                    "transition-all duration-100"
                  )}
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
