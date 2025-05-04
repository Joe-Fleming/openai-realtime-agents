
import { AllAgentConfigsType } from "@/app/types";
import salesCopilot from "./salesCopilot";

export const allAgentSets: AllAgentConfigsType = {
  salesCopilot: [salesCopilot],
};

export const defaultAgentSetKey = "salesCopilot";
