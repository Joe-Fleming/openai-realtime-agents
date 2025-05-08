import { Tool } from "@/app/types";

// Full FAQ (case-insensitive matching)
export const FAQ: Record<string, string> = {
  "How is pricing structured?": "We offer flat-rate pricing tiers, designed to be predictable regardless of inference volume. No per-inference fees or hidden GPU surcharges.",
  "What's the average latency per inference?": "Latency depends on model size, but we optimize for low-latency inference and autoscale on demand. For common LLMs and vision models, typical latency is sub-second to a few seconds.",
  "How does the platform handle traffic spikes?": "Featherless.ai is serverless and auto-scales horizontally to handle traffic bursts without requiring manual provisioning.",
  "What models are supported?": "We support 4,000+ open-source models across NLP, vision, and speech. This includes popular models from Hugging Face, OpenAI-compatible models, and more.",
  "Can I deploy custom or fine-tuned models?": "Yes, you can upload and deploy your own custom or fine-tuned models onto Featherless.ai.",
  "Do you support OpenAI API compatibility?": "Yes, Featherless.ai provides OpenAI-compatible APIs so you can swap endpoints without rewriting integration code.",
  "How do I deploy a model?": "Deployment is instant—upload the model or select from the library, configure basic parameters, and get an endpoint ready to use. No infrastructure management required.",
  "Can I update a model without downtime?": "Yes, you can deploy new versions with zero-downtime swaps and optional version pinning.",
  "Is data encrypted? Where is it processed?": "Data is encrypted in transit and at rest. We currently deploy in [insert region(s)], with options for custom/private deployments for compliance needs.",
  "Do you offer private or on-prem deployment?": "Yes, we support private deployments for customers needing dedicated environments or compliance with strict data regulations.",
  "How do I integrate with existing apps?": "Integration is via simple REST APIs or OpenAI-compatible endpoints. We also offer SDKs for Python and other languages (SDK roadmap expanding).",
  "Do you offer uptime SLAs?": "We offer SLAs under enterprise plans, with high-availability guarantees and priority support.",
  "What metrics and logs are available?": "Real-time metrics include request counts, latency, error rates, and usage dashboards. Logs are accessible via API or web UI with export options.",
  "How do you handle customer data privacy?": "We do not store input or output data by default. For enterprise customers, we offer configurable retention policies, data isolation, and the option for private deployment to ensure full control over data privacy.",
  "What support options are available?": "We offer community support, business support, and enterprise support tiers, depending on response time and SLAs required.",
  "How is Featherless.ai different from AWS SageMaker, Replicate, or Hugging Face?": "Featherless.ai focuses on zero-config, instant deployment of open-source models with flat-rate, predictable pricing, OpenAI API compatibility, and multilingual inference out of the box—without vendor lock-in or complex setup."
};

export const questionAnswererTool: Tool = {
  type: "function",
  name: "questionAnswerer",
  description: "Answers prospect questions using a predefined FAQ.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question asked by the prospect."
      }
    },
    required: ["question"],
  },
  // Tool logic will be injected in the agent config
};

// Helper function to answer a question (broad, case-insensitive match)
export function answerFromFAQ(question: string): string {
  const normalized = question.trim().toLowerCase();
  for (const key in FAQ) {
    const keyNorm = key.trim().toLowerCase();
    if (
      normalized.includes(keyNorm) ||
      keyNorm.includes(normalized)
    ) {
      return FAQ[key];
    }
  }
  return "I'm sorry, I don't have an answer to that question. Please ask a sales representative for more information.";
} 