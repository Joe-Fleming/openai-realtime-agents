
import { AllAgentConfigsType } from "@/app/types";
import questionSuggester from "./questionSuggester";

export const allAgentSets: AllAgentConfigsType = {
  questionSuggester: [questionSuggester],
};

export const defaultAgentSetKey = "questionSuggester";
