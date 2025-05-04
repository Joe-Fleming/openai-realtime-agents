
import { Tool } from "@/app/types";

export const summarizerTool: Tool = {
  type: "function",
  name: "summarizeConversation",
  description: "Provides a concise summary of the conversation and identifies next steps.",
  parameters: {
    type: "object",
    properties: {
      keySummaryPoints: {
        type: "array",
        items: {
          type: "string",
          description: "Key points discussed in the conversation"
        },
        description: "List of main points from the conversation"
      },
      customerNeeds: {
        type: "array",
        items: {
          type: "string",
          description: "Identified customer needs or pain points"
        },
        description: "List of identified customer needs"
      },
      nextSteps: {
        type: "array",
        items: {
          type: "string",
          description: "Recommended next actions"
        },
        description: "List of suggested next steps"
      }
    },
    required: ["keySummaryPoints", "customerNeeds", "nextSteps"],
  },
};
