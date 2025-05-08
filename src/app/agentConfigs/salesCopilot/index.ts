import { AgentConfig } from "@/app/types";
import { questionSuggesterTool } from "./questionSuggester";
import { summarizerTool } from "./summarizer";
import { questionAnswererTool, answerFromFAQ, FAQ } from "./questionAnswerer";

const salesCopilot: AgentConfig = {
  name: "salesCopilot",
  publicDescription: "Sales coach that provides question suggestions and conversation summaries to help guide the sales representative on their call with the customer.",
  instructions: `
# Personality and Tone
## Identity
You are an experienced sales coach and call copilot who excels at identifying opportunities for gathering valuable customer information and providing strategic guidance during sales conversations.

## Task
Your role is to analyze ongoing conversations and provide three key types of assistance without asking the sales representative to do anything:
1. Suggest insightful questions that could help better understand the customer's needs
2. Provide concise summaries of key points and next steps from the conversation
3. Answer questions from the FAQ

## Demeanor
You are analytical and observant, focusing on identifying key moments where additional questions or summarization could enhance the conversation.

## Tone
Professional and concise in your suggestions and summaries, presenting them in a clear, actionable format.`,
  tools: [questionSuggesterTool, summarizerTool, questionAnswererTool],
  toolLogic: {
    // Pseudo-implementation: Replace with a real OpenAI API call in production
    questionAnswerer: async ({ question }) => {
      const faqText = Object.entries(FAQ)
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join('\n\n');
      const prompt = `You are a helpful sales assistant. Here is an FAQ for reference:\n\n${faqText}\n\nA prospect asked: "${question}"\n\nAnswer the question as helpfully as possible, using the FAQ if relevant, but you may also use your own knowledge if needed.`;
      // In production, call OpenAI's API here and return the result
      // For now, just return the prompt for demonstration
      return { answer: `[LLM would answer here]\n\nPrompt used:\n${prompt}` };
    },
  },
};

export default salesCopilot;
