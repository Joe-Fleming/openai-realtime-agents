
import { AllAgentConfigsType } from "@/app/types";
import questionSuggester from "./questionSuggester";

export const allAgentSets: AllAgentConfigsType = {
  questionSuggester: {
    startingAgent: "questionSuggester",
    agents: [questionSuggester],
  },
};

export const defaultAgentSetKey = "questionSuggester";
