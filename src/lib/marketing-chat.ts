export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface KnowledgeEntry {
  id: string;
  keywords: string[];
  answer: string;
}

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "greeting",
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "help"],
    answer:
      "Hi — I’m the Nexus assistant. I can help with our services, how we work with customers, portal access, billing, or getting started. What can I help you with?",
  },
  {
    id: "services",
    keywords: [
      "service",
      "services",
      "product",
      "offer",
      "what do you do",
      "hardware",
      "software",
      "cloud",
      "managed it",
      "cyber",
      "security",
      "ai governance",
      "deployment",
      "retirement",
    ],
    answer:
      "Nexus manages technology services end to end:\n\n• Hardware Procurement & Lifecycle\n• Software & Cloud Management\n• Managed IT Support\n• Cybersecurity Monitoring\n• AI Governance\n• Deployment & Retirement\n\nYou can review each offering in the Products & services section on this page.",
  },
  {
    id: "how-it-works",
    keywords: [
      "how it works",
      "lifecycle",
      "process",
      "workflow",
      "connected",
      "how does",
    ],
    answer:
      "We connect the full technology lifecycle: understand your need, propose a solution, finalize a contract, order and deploy, manage and support day to day, then bill and renew. Your leadership, service, technician, billing, and client teams each see the information they need in one operations platform.",
  },
  {
    id: "portal",
    keywords: [
      "portal",
      "login",
      "sign in",
      "sign up",
      "manager",
      "technician",
      "client",
      "password",
      "account",
      "access",
    ],
    answer:
      "Use Portal in the top-right to enter the customer operations platform, or choose Email login if you already have an account. Once signed in, client users can open Billing to review invoices and support-hour usage, submit tickets, and track requests.",
  },
  {
    id: "billing",
    keywords: [
      "bill",
      "billing",
      "invoice",
      "payment",
      "charge",
      "balance",
      "hours",
      "included",
      "overage",
      "cost",
    ],
    answer:
      "Billing follows your support agreement. Most plans include a set number of support hours in the recurring fee. Hours beyond that limit are billed as additional work on your invoice. In the client portal you can review invoices, payment history, outstanding balances, and usage. Invoice terms and rates are managed by your Nexus account team.",
  },
  {
    id: "ai-governance",
    keywords: ["ai", "artificial", "chatbot", "governance", "llm", "copilot"],
    answer:
      "Our AI Governance service helps organizations inventory, oversee, and control AI platforms already in use — covering policy, compliance, cost visibility, and risk. Separately, I’m here on the website to answer questions about Nexus and help you find the right next step.",
  },
  {
    id: "contact",
    keywords: [
      "contact",
      "phone",
      "email",
      "address",
      "location",
      "where",
      "columbus",
      "reach",
    ],
    answer:
      "You can reach Nexus Technology Solutions at:\n\n100 Nexus Parkway, Suite 400\nColumbus, OH 43215\nhello@nexus-demo.example\n(555) 014-6280\n\nTell me what you’re looking for and I can also point you to the right service or portal option.",
  },
  {
    id: "getting-started",
    keywords: [
      "start",
      "getting started",
      "new",
      "visitor",
      "explore",
      "begin",
      "tour",
    ],
    answer:
      "Here’s a simple way to get started:\n1) Browse Products & services on this page\n2) Open Portal if you have access, or Email login for your account\n3) Contact us if you’d like to talk through a solution for your business\n\nWhat are you hoping to solve first — support, hardware, security, cloud, or AI governance?",
  },
];

const FALLBACK = `I can help with Nexus services, how we support customers, portal access, billing, and contacting our team.

You might ask:
• What services does Nexus offer?
• How does the engagement process work?
• How do I sign in to the portal?
• What are included support hours?
• How can I contact Nexus?

I’m happy to clarify anything else about our offerings.`;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function answerMarketingQuestion(question: string): string {
  const normalized = normalize(question);
  if (!normalized) {
    return "Ask me anything about Nexus — our services, portal access, billing, or how to get started.";
  }

  let best: { score: number; entry: KnowledgeEntry } | null = null;

  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) {
        score += keyword.includes(" ") ? 3 : 1;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, entry };
    }
  }

  return best ? best.entry.answer : FALLBACK;
}

export function createWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "Welcome to Nexus Technology Solutions. I can answer questions about our services, how we work with customers, portal access, billing, and how to get started. How can I help?",
  };
}
