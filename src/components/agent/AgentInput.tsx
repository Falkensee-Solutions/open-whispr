import { ChatInput } from "../chat/ChatInput";
import { AgentPicker } from "./AgentPicker";
import type { AgentState } from "../chat/types";

interface AgentInputProps {
  agentState: AgentState;
  partialTranscript: string;
  onTextSubmit?: (text: string) => void;
  onCancel?: () => void;
}

export function AgentInput(props: AgentInputProps) {
  return (
    <div className="flex flex-col">
      <ChatInput {...props} autoFocus />
      <div className="flex items-center px-3 pb-1.5">
        <AgentPicker />
      </div>
    </div>
  );
}
