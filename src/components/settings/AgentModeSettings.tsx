import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, Key, Cpu, Network, Bot } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { HotkeyInput } from "../ui/HotkeyInput";
import { Toggle } from "../ui/toggle";
import {
  SettingsRow,
  SettingsPanel,
  SettingsPanelRow,
  SectionHeader,
  InferenceModeSelector,
} from "../ui/SettingsSection";
import type { InferenceModeOption } from "../ui/SettingsSection";
import ReasoningModelSelector from "../ReasoningModelSelector";
import SelfHostedPanel from "../SelfHostedPanel";
import { validateHotkeyForSlot } from "../../utils/hotkeyValidation";
import type { InferenceMode } from "../../types/electron";

export default function AgentModeSettings() {
  const { t } = useTranslation();
  const {
    agentEnabled,
    setAgentEnabled,
    agentKey,
    setAgentKey,
    dictationKey,
    meetingKey,
    agentModel,
    setAgentModel,
    agentProvider,
    setAgentProvider,
    agentSystemPrompt,
    setAgentSystemPrompt,
    cloudAgentMode,
    setCloudAgentMode,
    agentInferenceMode,
    setAgentInferenceMode,
    remoteAgentUrl,
    setRemoteAgentUrl,
    isSignedIn,
    openaiApiKey,
    setOpenaiApiKey,
    anthropicApiKey,
    setAnthropicApiKey,
    geminiApiKey,
    setGeminiApiKey,
    groqApiKey,
    setGroqApiKey,
    azureApiKey,
    setAzureApiKey,
    azureEndpoint,
    setAzureEndpoint,
    azureDeploymentName,
    setAzureDeploymentName,
    azureReasoningDeploymentName,
    setAzureReasoningDeploymentName,
    customReasoningApiKey,
    setCustomReasoningApiKey,
    cloudReasoningBaseUrl,
    setCloudReasoningBaseUrl,
    azureFoundryEndpoint,
    setAzureFoundryEndpoint,
    azureFoundryApiKey,
    setAzureFoundryApiKey,
    azureFoundryEnabled,
    setAzureFoundryEnabled,
    selectedFoundryAgent,
    setSelectedFoundryAgent,
  } = useSettingsStore();

  const validateAgentHotkey = useCallback(
    (hotkey: string) =>
      validateHotkeyForSlot(
        hotkey,
        {
          "settingsPage.general.hotkey.title": dictationKey,
          "settingsPage.general.meetingHotkey.title": meetingKey,
        },
        t
      ),
    [dictationKey, meetingKey, t]
  );

  // Foundry connection test
  const [foundryAgents, setFoundryAgents] = useState<{ id: string; name: string; description: string }[]>([]);
  const [foundryTestStatus, setFoundryTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [foundryTestError, setFoundryTestError] = useState("");

  const testFoundryConnection = useCallback(async () => {
    setFoundryTestStatus("loading");
    setFoundryTestError("");
    try {
      // Pass current values directly to avoid race with env persistence
      const agents = await window.electronAPI?.listFoundryAgents?.(
        azureFoundryEndpoint,
        azureFoundryApiKey
      );
      setFoundryAgents(agents || []);
      setFoundryTestStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFoundryTestError(msg);
      setFoundryTestStatus("error");
      setFoundryAgents([]);
    }
  }, [azureFoundryEndpoint, azureFoundryApiKey]);

  const startOnboarding = useCallback(() => {
    localStorage.setItem("pendingCloudMigration", "true");
    localStorage.setItem("onboardingCurrentStep", "0");
    localStorage.removeItem("onboardingCompleted");
    window.location.reload();
  }, []);

  const agentModes: InferenceModeOption[] = [
    {
      id: "openwhispr",
      label: t("agentMode.settings.modes.openwhispr"),
      description: t("agentMode.settings.modes.openwhisprDesc"),
      icon: <Cloud className="w-4 h-4" />,
      disabled: !isSignedIn,
      badge: !isSignedIn ? t("common.freeAccountRequired") : undefined,
    },
    {
      id: "providers",
      label: t("agentMode.settings.modes.providers"),
      description: t("agentMode.settings.modes.providersDesc"),
      icon: <Key className="w-4 h-4" />,
    },
    {
      id: "local",
      label: t("agentMode.settings.modes.local"),
      description: t("agentMode.settings.modes.localDesc"),
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      id: "self-hosted",
      label: t("agentMode.settings.modes.selfHosted"),
      description: t("agentMode.settings.modes.selfHostedDesc"),
      icon: <Network className="w-4 h-4" />,
    },
  ];

  const handleAgentModeSelect = (mode: InferenceMode) => {
    if (mode === "openwhispr" && !isSignedIn) {
      startOnboarding();
      return;
    }
    if (mode === agentInferenceMode) return;
    setAgentInferenceMode(mode);
    setCloudAgentMode(mode === "openwhispr" ? "openwhispr" : "byok");
    if (mode === "openwhispr" || mode === "self-hosted") {
      window.electronAPI?.llamaServerStop?.();
    }
  };

  const renderModelSelector = (mode?: "cloud" | "local") => (
    <ReasoningModelSelector
      reasoningModel={agentModel}
      setReasoningModel={setAgentModel}
      localReasoningProvider={agentProvider}
      setLocalReasoningProvider={setAgentProvider}
      cloudReasoningBaseUrl={cloudReasoningBaseUrl}
      setCloudReasoningBaseUrl={setCloudReasoningBaseUrl}
      openaiApiKey={openaiApiKey}
      setOpenaiApiKey={setOpenaiApiKey}
      anthropicApiKey={anthropicApiKey}
      setAnthropicApiKey={setAnthropicApiKey}
      geminiApiKey={geminiApiKey}
      setGeminiApiKey={setGeminiApiKey}
      groqApiKey={groqApiKey}
      setGroqApiKey={setGroqApiKey}
      azureApiKey={azureApiKey}
      setAzureApiKey={setAzureApiKey}
      azureEndpoint={azureEndpoint}
      setAzureEndpoint={setAzureEndpoint}
      azureDeploymentName={azureDeploymentName}
      setAzureDeploymentName={setAzureDeploymentName}
      azureReasoningDeploymentName={azureReasoningDeploymentName}
      setAzureReasoningDeploymentName={setAzureReasoningDeploymentName}
      customReasoningApiKey={customReasoningApiKey}
      setCustomReasoningApiKey={setCustomReasoningApiKey}
      mode={mode}
    />
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("agentMode.settings.title")}
        description={t("agentMode.settings.description")}
      />

      <SettingsPanel>
        <SettingsPanelRow>
          <SettingsRow
            label={t("agentMode.settings.enabled")}
            description={t("agentMode.settings.enabledDescription")}
          >
            <Toggle checked={agentEnabled} onChange={setAgentEnabled} />
          </SettingsRow>
        </SettingsPanelRow>
      </SettingsPanel>

      {agentEnabled && (
        <>
          <div>
            <SectionHeader
              title={t("agentMode.settings.hotkey")}
              description={t("agentMode.settings.hotkeyDescription")}
            />
            <HotkeyInput value={agentKey} onChange={setAgentKey} validate={validateAgentHotkey} />
          </div>

          <InferenceModeSelector
            modes={agentModes}
            activeMode={agentInferenceMode}
            onSelect={handleAgentModeSelect}
          />

          {agentInferenceMode === "providers" && renderModelSelector("cloud")}
          {agentInferenceMode === "local" && renderModelSelector("local")}

          {agentInferenceMode === "self-hosted" && (
            <SelfHostedPanel
              service="reasoning"
              url={remoteAgentUrl}
              onUrlChange={setRemoteAgentUrl}
            />
          )}

          <div>
            <SectionHeader
              title={t("agentMode.settings.systemPrompt")}
              description={t("agentMode.settings.systemPromptDescription")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <textarea
                  value={agentSystemPrompt}
                  onChange={(e) => setAgentSystemPrompt(e.target.value)}
                  placeholder={t("agentMode.settings.systemPromptPlaceholder")}
                  rows={4}
                  className="w-full text-xs bg-transparent border border-border/50 rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 placeholder:text-muted-foreground/50"
                />
              </SettingsPanelRow>
            </SettingsPanel>
          </div>

          {/* Azure Foundry Agent Service */}
          <div>
            <SectionHeader
              title={t("foundry.settings.title")}
              description={t("foundry.settings.description")}
            />
            <SettingsPanel>
              <SettingsPanelRow>
                <SettingsRow
                  label={t("foundry.settings.enabled")}
                  description={t("foundry.settings.enabledDescription")}
                >
                  <Toggle checked={azureFoundryEnabled} onChange={setAzureFoundryEnabled} />
                </SettingsRow>
              </SettingsPanelRow>

              {azureFoundryEnabled && (
                <>
                  <SettingsPanelRow>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {t("foundry.settings.endpoint")}
                    </label>
                    <input
                      type="url"
                      value={azureFoundryEndpoint}
                      onChange={(e) => setAzureFoundryEndpoint(e.target.value)}
                      placeholder="https://your-resource.services.ai.azure.com/api/projects/your-project"
                      className="w-full text-xs bg-transparent border border-border/50 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 placeholder:text-muted-foreground/50"
                    />
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {t("foundry.settings.endpointHint")}
                    </p>
                  </SettingsPanelRow>

                  <SettingsPanelRow>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {t("foundry.settings.apiKey")}
                    </label>
                    <input
                      type="password"
                      value={azureFoundryApiKey}
                      onChange={(e) => setAzureFoundryApiKey(e.target.value)}
                      placeholder={t("foundry.settings.apiKeyPlaceholder")}
                      className="w-full text-xs bg-transparent border border-border/50 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 placeholder:text-muted-foreground/50"
                    />
                  </SettingsPanelRow>

                  <SettingsPanelRow>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={testFoundryConnection}
                        disabled={!azureFoundryEndpoint || !azureFoundryApiKey || foundryTestStatus === "loading"}
                        className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {foundryTestStatus === "loading"
                          ? t("foundry.settings.testing")
                          : t("foundry.settings.testConnection")}
                      </button>
                      {foundryTestStatus === "success" && (
                        <span className="text-xs text-green-500">
                          {t("foundry.settings.connected", { count: foundryAgents.length })}
                        </span>
                      )}
                      {foundryTestStatus === "error" && (
                        <span className="text-xs text-destructive">{foundryTestError}</span>
                      )}
                    </div>
                  </SettingsPanelRow>

                  {foundryAgents.length > 0 && (
                    <SettingsPanelRow>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {t("foundry.settings.defaultAgent")}
                      </label>
                      <select
                        value={selectedFoundryAgent}
                        onChange={(e) => setSelectedFoundryAgent(e.target.value)}
                        aria-label={t("foundry.settings.defaultAgent")}
                        className="w-full text-xs bg-transparent border border-border/50 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30"
                      >
                        <option value="">{t("foundry.settings.selectAgent")}</option>
                        {foundryAgents.map((agent) => (
                          <option key={agent.id || agent.name} value={agent.name}>
                            {agent.name}
                            {agent.description ? ` — ${agent.description}` : ""}
                          </option>
                        ))}
                      </select>
                    </SettingsPanelRow>
                  )}

                  <SettingsPanelRow>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {t("foundry.settings.agentName")}
                    </label>
                    <input
                      type="text"
                      value={selectedFoundryAgent}
                      onChange={(e) => setSelectedFoundryAgent(e.target.value)}
                      placeholder={t("foundry.settings.agentNamePlaceholder")}
                      className="w-full text-xs bg-transparent border border-border/50 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/30 placeholder:text-muted-foreground/50"
                    />
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {t("foundry.settings.agentNameHint")}
                    </p>
                  </SettingsPanelRow>
                </>
              )}
            </SettingsPanel>
          </div>
        </>
      )}
    </div>
  );
}
