export type FounderMode = 
  | "Bootstrapped SaaS" 
  | "VC Scale Startup" 
  | "Enterprise B2B" 
  | "Research Licensing" 
  | "API Product" 
  | "Hackathon MVP";

export type AgentStatus = "pending" | "running" | "completed" | "failed";

export interface ResearchPaper {
  title: string;
  domain: string;
  academicField: string;
  problemStatement: string;
  researchGap: string;
  methods: string;
  keyFindings: string;
  novelty: string;
  limitations: string;
  datasets: string[];
  benchmarks: string[];
  commercialSuitability: string;
  readinessScore: number;
}

export interface StartupOpportunity {
  id: string;
  name: string;
  oneLinePitch: string;
  description: string;
  problem: string;
  product: string;
  targetUsers: string[];
  painPoints: string[];
  icp: string;
  revenueModels: {
    model: string;
    pricing: string;
    details: string;
  }[];
  mvp: {
    features: string[];
    techStack: string[];
    dataRequirements: string[];
    roadmap: {
      "30day": string;
      "60day": string;
      "90day": string;
    };
  };
  pitch: {
    deckStructure: string[];
    moat: string;
    gtmStrategy: string;
  };
  actionPlan: string[];
  scores: {
    feasibility: number;
    marketSize: number;
    defensibility: number;
    mvpComplexity: number;
    revenuePotential: number;
    overall: number;
  };
}

export interface Paper2StartupReport {
  paper: ResearchPaper;
  opportunities: StartupOpportunity[];
}
