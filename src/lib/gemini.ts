import { GoogleGenAI } from "@google/genai";
import { Paper2StartupReport, ResearchPaper, StartupOpportunity, FounderMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const modelPro = "gemini-3.1-pro-preview";
const modelFlash = "gemini-3-flash-preview";

async function withRetry<T>(fn: () => Promise<T>, retries = 7, delay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = 
      error.message?.includes("429") || 
      error.message?.includes("quota") || 
      error.status === "RESOURCE_EXHAUSTED" ||
      (error.response && error.response.status === 429);

    const isRetryableError = 
      isQuotaError ||
      error.message?.includes("Rpc failed") || 
      error.message?.includes("xhr error") || 
      error.status === "UNKNOWN";

    if (retries > 0 && isRetryableError) {
      // Add jitter to avoid synchronized retries
      const jitter = Math.random() * 1000;
      const waitTime = (isQuotaError ? delay * 3 : delay) + jitter;
      
      console.warn(`Gemini API error (${isQuotaError ? "Quota" : "RPC"}), retrying in ${Math.round(waitTime)}ms... (${retries} attempts left)`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

function extractJSON(text: string): string {
  // Find the first '{' or '[' and the last '}' or ']'
  const startBrace = text.indexOf('{');
  const startBracket = text.indexOf('[');
  
  let start = -1;
  let end = -1;
  
  if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
    start = startBrace;
    end = text.lastIndexOf('}');
  } else if (startBracket !== -1) {
    start = startBracket;
    end = text.lastIndexOf(']');
  }
  
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  
  return text;
}

export async function runReaderAgent(paperText: string): Promise<ResearchPaper> {
  const prompt = `
    AGENT: Reader Agent
    TASK: Extract core research details and commercial intelligence from the provided paper text.
    
    PAPER TEXT:
    ${paperText.substring(0, 25000)}
    
    RETURN JSON:
    {
      "title": "string",
      "domain": "string",
      "academicField": "string",
      "problemStatement": "string",
      "researchGap": "string",
      "methods": "string",
      "keyFindings": "string",
      "novelty": "string",
      "limitations": "string",
      "datasets": ["string"],
      "benchmarks": ["string"],
      "commercialSuitability": "string",
      "readinessScore": number (0-100)
    }
  `;

  const response = await withRetry(() => ai.models.generateContent({
    model: modelFlash,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  }));

  return JSON.parse(extractJSON(response.text || "{}"));
}

export async function runInnovationAgent(paper: ResearchPaper, mode: FounderMode): Promise<Partial<StartupOpportunity>[]> {
  const prompt = `
    AGENT: Innovation Agent
    TASK: Based on the research novelty and findings, generate EXACTLY 3 distinct startup or product opportunities.
    FOUNDER MODE: ${mode}
    
    RESEARCH SUMMARY:
    ${JSON.stringify(paper)}
    
    INSTRUCTIONS:
    Tailor the ideas to the "${mode}" mode. 
    - If Bootstrapped SaaS: focus on high-margin, low-burn, niche SaaS with clear cash flow.
    - If VC Scale Startup: focus on massive market disruption, hyper-growth, and billion-dollar potential.
    - If Enterprise B2B: focus on security, compliance, high-ticket sales, and complex integrations.
    - If Research Licensing: focus on IP, patents, tech transfer, and licensing to big tech/pharma.
    - If API Product: focus on developer experience, infrastructure, and usage-based scaling.
    - If Hackathon MVP: focus on fast execution, viral potential, and a single "wow" feature.

    RETURN JSON (Array of EXACTLY 3 objects):
    [
      {
        "id": "opt-1",
        "name": "string (Catchy Startup Name)",
        "oneLinePitch": "string",
        "description": "string (Detailed product vision)",
        "problem": "string (The specific market problem being solved)",
        "product": "string (The solution/product description)"
      },
      { "id": "opt-2", ... },
      { "id": "opt-3", ... }
    ]
  `;

  const response = await withRetry(() => ai.models.generateContent({
    model: modelFlash,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  }));

  return JSON.parse(extractJSON(response.text || "[]"));
}

export async function runMarketAgent(paper: ResearchPaper, ideas: Partial<StartupOpportunity>[], mode: FounderMode): Promise<Partial<StartupOpportunity>[]> {
  const prompt = `
    AGENT: Market Agent
    TASK: For each of the 3 startup ideas, map target users, industries, ICP (Ideal Customer Profile), and GTM (Go-To-Market) path.
    FOUNDER MODE: ${mode}
    
    IDEAS: ${JSON.stringify(ideas)}
    RESEARCH: ${JSON.stringify(paper)}
    
    RETURN JSON (Array of 3 objects matching IDs):
    [
      {
        "id": "string",
        "targetUsers": ["string"],
        "painPoints": ["string"],
        "icp": "string (Detailed Ideal Customer Profile)",
        "gtmStrategy": "string (Specific GTM motion for ${mode})"
      },
      ...
    ]
  `;

  const response = await withRetry(() => ai.models.generateContent({
    model: modelFlash,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  }));

  return JSON.parse(extractJSON(response.text || "[]"));
}

export async function runMonetizationAgent(ideas: Partial<StartupOpportunity>[], mode: FounderMode): Promise<Partial<StartupOpportunity>[]> {
  const prompt = `
    AGENT: Monetization Agent
    TASK: Create detailed revenue models and pricing strategies for each of the 3 startup ideas.
    FOUNDER MODE: ${mode}
    
    IDEAS: ${JSON.stringify(ideas)}
    
    INSTRUCTIONS:
    Tailor monetization to "${mode}".
    - Bootstrapped: Monthly subscriptions, clear ROI, $50-$500/mo range.
    - VC Scale: Freemium, usage-based, or aggressive land-and-expand.
    - Enterprise: Annual contracts, $10k-$100k+ range, seat-based, professional services.
    - Licensing: Royalty-based, upfront fees, per-unit licensing.
    - API: Pay-per-call, tiered usage, developer-first pricing.
    - Hackathon: Simple, maybe ad-based or single purchase, or "free for now".

    RETURN JSON (Array of 3 objects matching IDs):
    [
      {
        "id": "string",
        "revenueModels": [
          { "model": "string (e.g. SaaS, Usage, License)", "pricing": "string (e.g. $99/mo)", "details": "string" }
        ]
      },
      ...
    ]
  `;

  const response = await withRetry(() => ai.models.generateContent({
    model: modelFlash,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  }));

  return JSON.parse(extractJSON(response.text || "[]"));
}

export async function runMVPAgent(ideas: Partial<StartupOpportunity>[], mode: FounderMode): Promise<Partial<StartupOpportunity>[]> {
  const prompt = `
    AGENT: MVP Agent
    TASK: Define MVP features, tech stack, data requirements, and a 30/60/90 day roadmap for each of the 3 ideas.
    FOUNDER MODE: ${mode}
    
    IDEAS: ${JSON.stringify(ideas)}
    
    INSTRUCTIONS:
    Tailor MVP scope to "${mode}".
    - Hackathon: 24-hour build, single feature, Vercel/Supabase stack.
    - Enterprise: Focus on POC, security, SSO, and integration with legacy systems.
    - API: Focus on documentation, SDKs, and reliable endpoints.
    - VC Scale: Focus on scalability, data moats, and viral loops.

    RETURN JSON (Array of 3 objects matching IDs):
    [
      {
        "id": "string",
        "mvp": {
          "features": ["string"],
          "techStack": ["string"],
          "dataRequirements": ["string"],
          "roadmap": { "30day": "string", "60day": "string", "90day": "string" }
        }
      },
      ...
    ]
  `;

  const response = await withRetry(() => ai.models.generateContent({
    model: modelFlash,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  }));

  return JSON.parse(extractJSON(response.text || "[]"));
}

export async function runPitchAgent(ideas: Partial<StartupOpportunity>[], mode: FounderMode): Promise<Partial<StartupOpportunity>[]> {
  const prompt = `
    AGENT: Pitch Agent
    TASK: Generate investor deck structure, moat (defensibility), and founder action plan for each of the 3 ideas.
    FOUNDER MODE: ${mode}
    
    IDEAS: ${JSON.stringify(ideas)}
    
    INSTRUCTIONS:
    Tailor pitch to "${mode}".
    - VC Scale: Focus on "The Big Vision", "Market Dominance", and "Why Now".
    - Bootstrapped: Focus on "Profitability", "Unit Economics", and "Sustainability".
    - Enterprise: Focus on "Sales Cycle", "ROI for Buyer", and "Case Studies".
    - Hackathon: Focus on "Demo", "Wow Factor", and "Immediate Utility".

    RETURN JSON (Array of 3 objects matching IDs):
    [
      {
        "id": "string",
        "pitch": { "deckStructure": ["string (Slide titles)"], "moat": "string (Defensibility strategy)" },
        "actionPlan": ["string (Next 30 days steps)"],
        "scores": { 
          "feasibility": number (1-10), 
          "marketSize": number (1-10), 
          "defensibility": number (1-10), 
          "mvpComplexity": number (1-10), 
          "revenuePotential": number (1-10), 
          "overall": number (1-100)
        }
      },
      ...
    ]
  `;

  const response = await withRetry(() => ai.models.generateContent({
    model: modelFlash,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  }));

  return JSON.parse(extractJSON(response.text || "[]"));
}

export async function runSynthesizerAgent(paper: ResearchPaper, allData: any, mode: FounderMode): Promise<Paper2StartupReport> {
  const prompt = `
    AGENT: Synthesizer Agent
    TASK: Merge all agent outputs into a final, polished startup report. 
    Ensure EXACTLY 3 startup opportunities are returned.
    The output must be a "Startup Studio" report, prioritizing commercial potential over academic summary.
    FOUNDER MODE: ${mode}
    
    PAPER: ${JSON.stringify(paper)}
    DATA: ${JSON.stringify(allData)}
    
    INSTRUCTIONS:
    - Map all data points (market, monetization, mvp, pitch) to the correct startup idea by ID.
    - Ensure names are catchy and professional.
    - Ensure the "problem" and "product" fields are well-defined.
    - Ensure the "icp" and "gtmStrategy" are integrated.
    - The final JSON must be valid and complete.

    RETURN JSON:
    {
      "paper": { ... (ResearchPaper structure) },
      "opportunities": [
        {
          "id": "string",
          "name": "string",
          "oneLinePitch": "string",
          "description": "string",
          "problem": "string",
          "product": "string",
          "targetUsers": ["string"],
          "painPoints": ["string"],
          "icp": "string",
          "revenueModels": [{ "model": "string", "pricing": "string", "details": "string" }],
          "mvp": {
            "features": ["string"],
            "techStack": ["string"],
            "dataRequirements": ["string"],
            "roadmap": { "30day": "string", "60day": "string", "90day": "string" }
          },
          "pitch": { "deckStructure": ["string"], "moat": "string", "gtmStrategy": "string" },
          "actionPlan": ["string"],
          "scores": { 
            "feasibility": number, 
            "marketSize": number, 
            "defensibility": number, 
            "mvpComplexity": number, 
            "revenuePotential": number, 
            "overall": number 
          }
        },
        { ... (Idea 2) },
        { ... (Idea 3) }
      ]
    }
  `;

  const response = await withRetry(() => ai.models.generateContent({
    model: modelFlash,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  }));

  return JSON.parse(extractJSON(response.text || "{}"));
}
