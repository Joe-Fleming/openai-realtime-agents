
import { Tool } from "@/app/types";

export const questionSuggesterTool: Tool = {
  type: "function",
  name: "suggestQuestions",
  description: "Suggests relevant questions based on the current conversation context.",
  parameters: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            suggestedQuestion: {
              type: "string",
              description: "The proposed question to ask the customer.",
            },
            rationale: {
              type: "string",
              description: "Brief explanation of why this question would be valuable.",
            },
            priority: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "The urgency/importance of asking this question.",
            }
          },
          required: ["suggestedQuestion", "rationale", "priority"]
        },
        minItems: 3,
        maxItems: 3,
        description: "Array of three suggested questions with their rationales and priorities"
      }
    },
    required: ["questions"],
  },
};
