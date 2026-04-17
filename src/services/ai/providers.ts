import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import type { LanguageModel } from "ai";

export function getAIModel(
  provider: string,
  model: string,
  apiKey: string,
  baseURL?: string
): LanguageModel {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "groq":
      return createGroq({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "custom":
      return createOpenAI({ apiKey, baseURL })(model);
    case "azure": {
      const azureBaseURL = (baseURL || "").replace(/\/+$/, "");
      const normalizedBase = azureBaseURL.endsWith("/openai") ? azureBaseURL : `${azureBaseURL}/openai`;
      const deploymentName = model === "azure-deployment" ? (baseURL ? "" : model) : model;
      return createAzure({
        apiKey,
        baseURL: normalizedBase,
        apiVersion: "2024-10-21",
        useDeploymentBasedUrls: true,
      }).chat(deploymentName || model);
    }
    case "local":
      return createOpenAI({
        apiKey: "no-key",
        baseURL,
      }).chat(model);
    default:
      throw new Error(`Unsupported AI SDK provider: ${provider}`);
  }
}
