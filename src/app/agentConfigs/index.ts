import { AllAgentConfigsType } from "@/app/types";
import frontDeskAuthentication from "./frontDeskAuthentication";
import customerServiceRetail from "./customerServiceRetail";
import simpleExample from "./simpleExample";
import questionSuggester from "./questionSuggester";

export const allAgentSets: AllAgentConfigsType = {
  frontDeskAuthentication,
  customerServiceRetail,
  simpleExample,
  questionSuggester: {
    startingAgent: "questionSuggester",
    agents: [questionSuggester],
  },
};

export const defaultAgentSetKey = "simpleExample";
