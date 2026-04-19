import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, Bot, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { useSettingsStore } from "../../stores/settingsStore";

interface FoundryAgent {
  id: string;
  name: string;
  description: string;
  model?: string;
}

interface AgentPickerProps {
  className?: string;
}

export function AgentPicker({ className }: AgentPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<FoundryAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const azureFoundryEnabled = useSettingsStore((s) => s.azureFoundryEnabled);
  const selectedFoundryAgent = useSettingsStore((s) => s.selectedFoundryAgent);
  const setSelectedFoundryAgent = useSettingsStore((s) => s.setSelectedFoundryAgent);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI?.listFoundryAgents?.();
      setAgents(result || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch agents when popover opens
  useEffect(() => {
    if (open) {
      fetchAgents();
    }
  }, [open, fetchAgents]);

  if (!azureFoundryEnabled) return null;

  const selectedAgent = agents.find((a) => a.name === selectedFoundryAgent);
  const displayName = selectedAgent?.name || selectedFoundryAgent || t("foundry.picker.selectAgent");

  return (
    <div className={cn("flex items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md",
              "text-xs text-muted-foreground hover:text-foreground",
              "hover:bg-foreground/5 transition-colors duration-150",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30",
              "max-w-[200px]"
            )}
          >
            <Bot size={12} className="shrink-0" />
            <span className="truncate">{displayName}</span>
            <ChevronUp
              size={10}
              className={cn("shrink-0 transition-transform", open && "rotate-180")}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="start"
          className="w-[280px] max-h-[300px] overflow-y-auto p-1"
        >
          {loading && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 size={14} className="animate-spin mr-2" />
              <span className="text-xs">{t("foundry.picker.loading")}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-2 text-xs text-destructive">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && agents.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4">
              {t("foundry.picker.noAgents")}
            </div>
          )}

          {!loading &&
            agents.map((agent) => (
              <button
                key={agent.id || agent.name}
                onClick={() => {
                  setSelectedFoundryAgent(agent.name);
                  setOpen(false);
                }}
                className={cn(
                  "flex flex-col w-full text-left px-2 py-1.5 rounded-md",
                  "hover:bg-foreground/5 transition-colors duration-150",
                  "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30",
                  selectedFoundryAgent === agent.name && "bg-foreground/8"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Bot size={12} className="shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate">{agent.name}</span>
                </div>
                {agent.description && (
                  <span className="text-[10px] text-muted-foreground mt-0.5 ml-[18px] line-clamp-2">
                    {agent.description}
                  </span>
                )}
              </button>
            ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
