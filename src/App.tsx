import * as React from "react";
import { useState, useEffect } from "react";
import * as Agents from "./lib/gemini";
import { Paper2StartupReport, FounderMode, AgentStatus } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { 
  Upload, 
  FileText, 
  Lightbulb, 
  TrendingUp, 
  Rocket, 
  DollarSign, 
  Presentation, 
  Download, 
  Copy, 
  Check, 
  Loader2,
  ArrowRight,
  Shield,
  ShieldAlert,
  Target,
  Zap,
  BrainCircuit,
  Search,
  Coins,
  Construction,
  Megaphone,
  Sparkles,
  Settings2,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const STEPS = [
  { id: "reading", label: "Reading Paper", icon: FileText, agent: "Reader Agent" },
  { id: "innovation", label: "Extracting Innovation", icon: Lightbulb, agent: "Innovation Agent" },
  { id: "market", label: "Finding Market", icon: Search, agent: "Market Agent" },
  { id: "monetization", label: "Building Revenue Model", icon: Coins, agent: "Monetization Agent" },
  { id: "mvp", label: "Generating MVP", icon: Construction, agent: "MVP Agent" },
  { id: "pitch", label: "Preparing Pitch", icon: Megaphone, agent: "Pitch Agent" },
  { id: "synthesizing", label: "Synthesizing Report", icon: Sparkles, agent: "Synthesizer Agent" },
];

const FOUNDER_MODES: FounderMode[] = [
  "Bootstrapped SaaS",
  "VC Scale Startup",
  "Enterprise B2B",
  "Research Licensing",
  "API Product",
  "Hackathon MVP"
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [report, setReport] = useState<Paper2StartupReport | null>(null);
  const [founderMode, setFounderMode] = useState<FounderMode>("VC Scale Startup");
  const [selectedOpportunityIdx, setSelectedOpportunityIdx] = useState(0);
  const [showAuthBanner, setShowAuthBanner] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return (saved as "light" | "dark") || "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({
    reading: "pending",
    innovation: "pending",
    market: "pending",
    monetization: "pending",
    mvp: "pending",
    pitch: "pending",
    synthesizing: "pending"
  });

  const updateAgentStatus = (id: string, status: AgentStatus) => {
    setAgentStatuses(prev => ({ ...prev, [id]: status }));
  };

  useEffect(() => {
    // Verify backend health on mount
    fetch("/api/health", { credentials: "include" })
      .then(res => res.json())
      .then(data => console.log("Backend health check:", data))
      .catch(err => console.error("Backend health check failed:", err));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      toast.success("PDF uploaded successfully");
    } else {
      toast.error("Please upload a valid PDF file");
    }
  };

  const processPaper = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setReport(null);
      setSelectedOpportunityIdx(0);
      
      // Reset statuses
      setAgentStatuses({
        reading: "pending",
        innovation: "pending",
        market: "pending",
        monetization: "pending",
        mvp: "pending",
        pitch: "pending",
        synthesizing: "pending"
      });
      
      // Step 0: Extract PDF Text (Internal Backend Step)
      setCurrentStepIndex(0);
      const formData = new FormData();
      formData.append("file", file);
      
      const extractRes = await fetch("/api/extract-pdf", { 
        method: "POST", 
        body: formData,
        credentials: "include",
        headers: {
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      
      let extractData;
      const contentType = extractRes.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        extractData = await extractRes.json();
      } else {
        const textError = await extractRes.text();
        console.error("Non-JSON response received:", textError);
        
        if (textError.includes("Cookie check") || textError.includes("Action required to load your app")) {
          throw new Error("AUTHENTICATION_REQUIRED");
        }
        
        throw new Error(`Server returned non-JSON response (${extractRes.status}). The backend might be down or misconfigured.`);
      }
      
      if (!extractRes.ok) {
        throw new Error(extractData.error || "Failed to extract text from PDF");
      }
      
      const { text } = extractData;

      // Step 1: Reader Agent
      updateAgentStatus("reading", "running");
      setCurrentStepIndex(0);
      const paper = await Agents.runReaderAgent(text);
      updateAgentStatus("reading", "completed");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 2: Innovation Agent
      updateAgentStatus("innovation", "running");
      setCurrentStepIndex(1);
      const baseIdeas = await Agents.runInnovationAgent(paper, founderMode);
      updateAgentStatus("innovation", "completed");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 3: Market Agent
      updateAgentStatus("market", "running");
      setCurrentStepIndex(2);
      const marketData = await Agents.runMarketAgent(paper, baseIdeas, founderMode);
      updateAgentStatus("market", "completed");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 4: Monetization Agent
      updateAgentStatus("monetization", "running");
      setCurrentStepIndex(3);
      const monetizationData = await Agents.runMonetizationAgent(baseIdeas, founderMode);
      updateAgentStatus("monetization", "completed");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 5: MVP Agent
      updateAgentStatus("mvp", "running");
      setCurrentStepIndex(4);
      const mvpData = await Agents.runMVPAgent(baseIdeas, founderMode);
      updateAgentStatus("mvp", "completed");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 6: Pitch Agent
      updateAgentStatus("pitch", "running");
      setCurrentStepIndex(5);
      const pitchData = await Agents.runPitchAgent(baseIdeas, founderMode);
      updateAgentStatus("pitch", "completed");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 7: Synthesizer Agent
      updateAgentStatus("synthesizing", "running");
      setCurrentStepIndex(6);
      const allAgentData = {
        innovation: baseIdeas,
        market: marketData,
        monetization: monetizationData,
        mvp: mvpData,
        pitch: pitchData
      };
      const finalReport = await Agents.runSynthesizerAgent(paper, allAgentData, founderMode);
      updateAgentStatus("synthesizing", "completed");
      
      setReport(finalReport);
      setIsProcessing(false);
      setCurrentStepIndex(-1);
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#000000', '#ffffff', '#3b82f6']
      });
      toast.success(`Startup report generated in ${founderMode} mode!`);
    } catch (error: any) {
      console.error(error);
      
      if (error.message === "AUTHENTICATION_REQUIRED") {
        setShowAuthBanner(true);
        toast.error("Authentication required. Please click 'Fix Authentication' to continue.", {
          duration: 10000,
          action: {
            label: "Fix Authentication",
            onClick: () => window.open("/api/health", "_blank")
          }
        });
      } else if (error.message?.includes("429") || error.message?.toLowerCase().includes("quota")) {
        toast.error("Gemini API Rate Limit Exceeded. The agents are working hard! Please wait a minute and try again.", {
          duration: 8000
        });
      } else {
        toast.error(error.message || "An error occurred during processing");
      }
      
      setIsProcessing(false);
      setCurrentStepIndex(-1);
      // Mark current running as failed
      const currentStep = STEPS[currentStepIndex]?.id;
      if (currentStep) updateAgentStatus(currentStep, "failed");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const generateFullMarkdown = (report: Paper2StartupReport) => {
    let md = `# ${report.paper.title}\n\n`;
    md += `## Executive Summary\n`;
    md += `This report analyzes the commercial potential of the research paper titled **"${report.paper.title}"** in the domain of **${report.paper.domain}**. It identifies ${report.opportunities.length} distinct startup opportunities tailored for the **${founderMode}** mode.\n\n`;
    
    md += `## Research Evidence\n`;
    md += `### Core Research Details\n`;
    md += `- **Academic Field:** ${report.paper.academicField}\n`;
    md += `- **Domain:** ${report.paper.domain}\n`;
    md += `- **Problem Statement:** ${report.paper.problemStatement}\n`;
    md += `- **Key Findings:** ${report.paper.keyFindings}\n`;
    md += `- **Novelty:** ${report.paper.novelty}\n`;
    md += `- **Research Gap:** ${report.paper.researchGap}\n`;
    md += `- **Methods:** ${report.paper.methods}\n`;
    md += `- **Limitations:** ${report.paper.limitations}\n`;
    md += `- **Commercial Readiness Score:** ${report.paper.readinessScore}/100\n\n`;

    report.opportunities.forEach((opt, idx) => {
      md += `---\n\n`;
      md += `# Opportunity ${idx + 1}: ${opt.name}\n`;
      md += `**Success Score: ${opt.scores.overall}%**\n\n`;
      md += `> ${opt.oneLinePitch}\n\n`;
      
      md += `## 1. Overview\n`;
      md += `### The Problem\n${opt.problem}\n\n`;
      md += `### The Solution\n${opt.product}\n\n`;
      md += `### Strategic Vision\n${opt.description}\n\n`;
      
      md += `## 2. Market & ICP\n`;
      md += `### Ideal Customer Profile (ICP)\n${opt.icp}\n\n`;
      md += `### Target Segments\n`;
      opt.targetUsers.forEach(u => md += `- ${u}\n`);
      md += `\n### Market Pain Points\n`;
      opt.painPoints.forEach(p => md += `- ${p}\n`);
      md += `\n`;
      
      md += `## 3. Monetization\n`;
      opt.revenueModels.forEach(m => {
        md += `### ${m.model}\n`;
        md += `- **Pricing:** ${m.pricing}\n`;
        md += `- **Details:** ${m.details}\n\n`;
      });
      
      md += `## 4. MVP Roadmap\n`;
      md += `### 30 Days\n${opt.mvp.roadmap["30day"]}\n\n`;
      md += `### 60 Days\n${opt.mvp.roadmap["60day"]}\n\n`;
      md += `### 90 Days\n${opt.mvp.roadmap["90day"]}\n\n`;
      md += `### Tech Stack\n${opt.mvp.techStack.join(", ")}\n\n`;
      md += `### Core Features\n`;
      opt.mvp.features.forEach(f => md += `- ${f}\n`);
      md += `\n`;
      
      md += `## 5. Pitch Deck\n`;
      md += `### Deck Structure\n`;
      opt.pitch.deckStructure.forEach((s, i) => md += `${i + 1}. ${s}\n`);
      md += `\n### GTM Strategy\n${opt.pitch.gtmStrategy}\n\n`;
      
      md += `## 6. Moat & Risk\n`;
      md += `### Defensibility (The Moat)\n${opt.pitch.moat}\n\n`;
      md += `### Technical Limitations & Risks\n${report.paper.limitations}\n\n`;
      
      md += `## 7. Action Plan\n`;
      opt.actionPlan?.forEach((a, i) => md += `${i + 1}. ${a}\n`);
      md += `\n`;
      
      md += `## Final Feasibility Summary\n`;
      md += `- **Feasibility:** ${opt.scores.feasibility}/10\n`;
      md += `- **Market Size:** ${opt.scores.marketSize}/10\n`;
      md += `- **Defensibility:** ${opt.scores.defensibility}/10\n`;
      md += `- **MVP Complexity:** ${opt.scores.mvpComplexity}/10\n`;
      md += `- **Revenue Potential:** ${opt.scores.revenuePotential}/10\n\n`;
    });
    
    md += `---\n`;
    md += `*Generated by Paper2Startup Intelligence Engine*\n`;
    md += `*Powered by Gemini 3.1 Pro & Multi-Agent Orchestration*\n`;
    
    return md;
  };

  const downloadReport = async () => {
    const element = document.getElementById("report-print-content");
    if (!element || !report) {
      toast.error("Print content not found");
      return;
    }

    try {
      toast.info("Generating optimized PDF report...");
      
      // Update print content with latest data in a clean text-first format
      const fullMarkdown = generateFullMarkdown(report);
      
      // Temporarily show the element off-screen to ensure it's rendered
      element.style.display = "block";
      element.style.position = "absolute";
      element.style.left = "-9999px";
      element.style.width = "800px"; // Standard width for A4 text

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 1.5, // Reduced scale for smaller file size but still readable
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("report-print-content");
          if (clonedElement) {
            clonedElement.style.display = "block";
            clonedElement.style.position = "relative";
            clonedElement.style.left = "0";
            clonedElement.style.padding = "40px";
            clonedElement.style.background = "#ffffff";
            clonedElement.style.color = "#000000";
          }

          // Strip all modern CSS that might cause issues or bloat
          const styleTags = clonedDoc.getElementsByTagName('style');
          for (let i = styleTags.length - 1; i >= 0; i--) {
            styleTags[i].parentNode?.removeChild(styleTags[i]);
          }
          
          const links = clonedDoc.getElementsByTagName('link');
          for (let i = links.length - 1; i >= 0; i--) {
            if (links[i].rel === 'stylesheet') {
              links[i].parentNode?.removeChild(links[i]);
            }
          }

          // Inject ultra-lightweight print styles
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            #report-print-content { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #000;
              background: #fff;
              font-size: 14px;
            }
            h1 { font-size: 28px; font-weight: 800; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            h2 { font-size: 22px; font-weight: 700; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #eee; }
            h3 { font-size: 18px; font-weight: 700; margin-top: 20px; margin-bottom: 10px; color: #333; }
            h4 { font-size: 14px; font-weight: 700; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; color: #666; }
            p { margin-bottom: 15px; }
            ul { margin-bottom: 15px; padding-left: 20px; }
            li { margin-bottom: 5px; }
            blockquote { border-left: 4px solid #eee; padding-left: 15px; font-style: italic; color: #555; margin: 20px 0; }
            hr { border: 0; border-top: 1px solid #eee; margin: 40px 0; }
            .success-score { font-size: 24px; font-weight: 800; color: #000; }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      // Hide it back
      element.style.display = "none";

      const imgData = canvas.toDataURL("image/jpeg", 0.75); // Use JPEG with compression for much smaller size
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Paper2Startup_Report_${Date.now()}.pdf`);
      toast.success("Optimized PDF report downloaded");
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF.");
    }
  };

  const exportToMarkdown = () => {
    if (!report) return;
    const md = generateFullMarkdown(report);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Paper2Startup_${report.paper.title.replace(/\s+/g, '_')}.md`;
    a.click();
    toast.success("Full Markdown report downloaded");
  };

  const exportToPDF = async () => {
    await downloadReport();
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-blue-500/30 transition-colors duration-300">
      <Toaster position="top-center" theme={theme} />
      
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Paper2Startup</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
            {report && (
              <>
                <Button variant="ghost" size="sm" onClick={exportToMarkdown} className="text-muted-foreground hover:text-foreground">
                  <Download className="w-4 h-4 mr-2" />
                  Markdown
                </Button>
                <Button variant="ghost" size="sm" onClick={exportToPDF} className="text-muted-foreground hover:text-foreground">
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {showAuthBanner && (
        <div className="bg-blue-600/10 border-b border-blue-500/20 py-3">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-blue-400">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">
                Your browser is blocking required security cookies. Please authenticate to enable PDF processing.
              </p>
            </div>
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
              onClick={() => {
                window.open("/api/health", "_blank");
                setShowAuthBanner(false);
              }}
            >
              Fix Authentication
            </Button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-12">
        {!report ? (
          <div className="max-w-3xl mx-auto text-center space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-6xl font-extrabold tracking-tighter mb-6 bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
                Multi-Agent Startup Factory
              </h1>
              <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
                Our specialized AI agents collaborate to transform your research paper into a market-ready startup blueprint.
              </p>
            </motion.div>

            {!isProcessing ? (
              <div className="space-y-8">
                {/* Founder Mode Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-bold uppercase tracking-widest">
                    <Settings2 className="w-4 h-4" />
                    Select Founder Mode
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {FOUNDER_MODES.map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setFounderMode(mode)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                          founderMode === mode 
                            ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" 
                            : "bg-secondary border-border text-muted-foreground hover:border-accent"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <Card className="bg-card border-border border-dashed border-2 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden">
                  <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center space-y-6">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-500">
                      <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-semibold text-foreground">
                        {file ? file.name : "Upload Research Paper (PDF)"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Agents will analyze up to 25,000 characters of text
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <AnimatePresence>
                  {file && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <Button 
                        size="lg" 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-16 text-xl shadow-2xl shadow-blue-500/20 rounded-xl"
                        onClick={processPaper}
                      >
                        Initialize Agent Workflow
                        <BrainCircuit className="ml-3 w-6 h-6" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-12 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {STEPS.map((step, idx) => {
                    const status = agentStatuses[step.id];
                    const isActive = status === "running";
                    const isCompleted = status === "completed";
                    const isFailed = status === "failed";
                    const Icon = step.icon;

                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0.3, scale: 0.95 }}
                        animate={{ 
                          opacity: isActive || isCompleted ? 1 : 0.3,
                          scale: isActive ? 1.05 : 1,
                          borderColor: isFailed ? "rgba(239, 68, 68, 0.5)" : isActive ? "rgba(59, 130, 246, 0.5)" : isCompleted ? "rgba(34, 197, 94, 0.3)" : "rgba(39, 39, 42, 0.5)"
                        }}
                        className={`p-6 rounded-2xl border bg-card/50 flex flex-col items-center text-center space-y-4 transition-all duration-500 ${isActive ? 'ring-2 ring-primary/20 shadow-lg shadow-primary/10' : ''}`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-500 ${isFailed ? 'bg-destructive/20 text-destructive' : isActive ? 'bg-primary text-primary-foreground' : isCompleted ? 'bg-green-600/20 text-green-500' : 'bg-secondary text-muted-foreground'}`}>
                          {isCompleted ? <Check className="w-6 h-6" /> : isFailed ? <Zap className="w-6 h-6" /> : <Icon className={`w-6 h-6 ${isActive ? 'animate-pulse' : ''}`} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{step.agent}</p>
                          <p className={`text-sm font-semibold ${isFailed ? 'text-destructive' : isActive ? 'text-primary' : isCompleted ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {step.label}
                          </p>
                        </div>
                        {isActive && (
                          <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-primary"
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{ duration: 5, repeat: Infinity }}
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                
                <div className="max-w-md mx-auto space-y-4">
                  <p className="text-muted-foreground text-sm animate-pulse">
                    Orchestrating multi-agent reasoning...
                  </p>
                  <Progress value={(currentStepIndex + 1) * (100 / STEPS.length)} className="h-1.5 bg-secondary" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div id="report-content" className="space-y-12 animate-in fade-in duration-1000">
            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-4xl font-black tracking-tighter mb-2">STARTUP STUDIO</h2>
                <p className="text-muted-foreground text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Source: <span className="text-foreground italic font-medium">{report.paper.title}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1">
                  {founderMode}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadReport}
                  className="border-border hover:bg-secondary text-muted-foreground"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Blueprint
                </Button>
              </div>
            </div>

            {/* Main Idea Selection Tabs */}
            <Tabs 
              value={`idea-${selectedOpportunityIdx}`} 
              onValueChange={(val) => setSelectedOpportunityIdx(parseInt(val.split("-")[1]))}
              className="w-full"
            >
              <TabsList className="bg-secondary border border-border p-1 mb-12 w-full h-auto grid grid-cols-3 gap-2">
                {report.opportunities.map((opt, idx) => (
                  <TabsTrigger 
                    key={opt.id} 
                    value={`idea-${idx}`}
                    className="py-4 flex flex-col gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Opportunity 0{idx + 1}</span>
                    <span className="font-bold truncate w-full px-2">{opt.name}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {report.opportunities.map((opt, idx) => (
                <TabsContent key={opt.id} value={`idea-${idx}`} className="space-y-12">
                  {/* Sub-tabs for the selected idea */}
                  <Tabs defaultValue="overview" className="w-full">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                      <TabsList className="bg-secondary/50 border border-border/50 p-1 h-auto flex-wrap justify-start">
                        <TabsTrigger value="overview" className="text-xs py-2 px-4">Overview</TabsTrigger>
                        <TabsTrigger value="market" className="text-xs py-2 px-4">Market & ICP</TabsTrigger>
                        <TabsTrigger value="revenue" className="text-xs py-2 px-4">Monetization</TabsTrigger>
                        <TabsTrigger value="roadmap" className="text-xs py-2 px-4">MVP Roadmap</TabsTrigger>
                        <TabsTrigger value="pitch" className="text-xs py-2 px-4">Pitch Deck</TabsTrigger>
                        <TabsTrigger value="moat" className="text-xs py-2 px-4">Moat & Risk</TabsTrigger>
                        <TabsTrigger value="action" className="text-xs py-2 px-4">Action Plan</TabsTrigger>
                        <TabsTrigger value="evidence" className="text-xs py-2 px-4">Research Evidence</TabsTrigger>
                      </TabsList>

                      <div className="flex items-center gap-4 px-4 py-2 bg-secondary/50 rounded-xl border border-border">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Success Score</span>
                          <span className="text-xl font-black text-primary">{opt.scores.overall}%</span>
                        </div>
                        <Progress value={opt.scores.overall} className="w-24 h-2 bg-secondary" />
                      </div>
                    </div>

                    {/* Overview */}
                    <TabsContent value="overview" className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                          <Card className="bg-card/50 border-border p-8">
                            <h3 className="text-4xl font-black mb-4 text-foreground leading-tight">{opt.name}</h3>
                            <p className="text-xl text-primary font-medium mb-8">{opt.oneLinePitch}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                  <Target className="w-4 h-4" /> The Problem
                                </h4>
                                <p className="text-foreground/80 leading-relaxed">{opt.problem}</p>
                              </div>
                              <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                  <Rocket className="w-4 h-4" /> The Solution
                                </h4>
                                <p className="text-foreground/80 leading-relaxed">{opt.product}</p>
                              </div>
                            </div>
                          </Card>
                          <Card className="bg-card/50 border-border p-8">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Strategic Vision</h4>
                            <p className="text-muted-foreground leading-relaxed">{opt.description}</p>
                          </Card>
                        </div>
                        <div className="space-y-6">
                          <Card className="bg-card/80 border-border p-6">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-6">Opportunity Metrics</h4>
                            <div className="space-y-6">
                              {[
                                { label: "Feasibility", score: opt.scores.feasibility },
                                { label: "Market Size", score: opt.scores.marketSize },
                                { label: "Defensibility", score: opt.scores.defensibility },
                                { label: "Revenue Potential", score: opt.scores.revenuePotential }
                              ].map((m, i) => (
                                <div key={i} className="space-y-2">
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="text-muted-foreground">{m.label}</span>
                                    <span className="text-foreground">{m.score}/10</span>
                                  </div>
                                  <Progress value={m.score * 10} className="h-1 bg-secondary" />
                                </div>
                              ))}
                            </div>
                          </Card>
                          <Card className="bg-primary/5 border-primary/20 p-6">
                            <h4 className="text-xs font-bold text-primary uppercase mb-4">Founder Fit</h4>
                            <p className="text-sm text-muted-foreground italic">"This opportunity is optimized for {founderMode} execution, focusing on {opt.pitch.moat.toLowerCase()}."</p>
                          </Card>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Market */}
                    <TabsContent value="market" className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="bg-zinc-900/50 border-zinc-800 p-8">
                          <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <Target className="w-5 h-5 text-blue-500" />
                            Ideal Customer Profile (ICP)
                          </h4>
                          <div className="p-6 rounded-2xl bg-blue-600/5 border border-blue-500/20 mb-8">
                            <p className="text-zinc-300 leading-relaxed">{opt.icp}</p>
                          </div>
                          <div className="space-y-4">
                            <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Target Segments</h5>
                            {opt.targetUsers.map((user, i) => (
                              <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                                <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 font-bold text-xs">
                                  {i + 1}
                                </div>
                                <span className="text-zinc-300 font-medium">{user}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800 p-8">
                          <h4 className="text-lg font-bold mb-6 flex items-center gap-2 text-red-400">
                            <TrendingUp className="w-5 h-5" />
                            Market Pain Points
                          </h4>
                          <div className="space-y-4">
                            {opt.painPoints.map((point, i) => (
                              <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                                <div className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
                                <span className="text-zinc-400 text-sm">{point}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* Revenue */}
                    <TabsContent value="revenue" className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {opt.revenueModels.map((model, i) => (
                          <Card key={i} className="bg-zinc-900/50 border-zinc-800 p-8 relative overflow-hidden group hover:border-green-500/30 transition-all">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/5 rounded-full blur-2xl group-hover:bg-green-500/10 transition-all" />
                            <div className="space-y-6">
                              <div className="w-12 h-12 rounded-2xl bg-green-600/10 flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-green-500" />
                              </div>
                              <div>
                                <h4 className="text-2xl font-bold mb-2">{model.model}</h4>
                                <Badge className="bg-green-600/20 text-green-500 border-green-500/20">{model.pricing}</Badge>
                              </div>
                              <p className="text-sm text-zinc-400 leading-relaxed">{model.details}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>

                    {/* Roadmap */}
                    <TabsContent value="roadmap" className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                          <div className="relative space-y-12 before:absolute before:left-[23px] before:top-4 before:bottom-4 before:w-px before:bg-zinc-800">
                            {[
                              { day: "30", content: opt.mvp.roadmap["30day"], color: "bg-blue-600" },
                              { day: "60", content: opt.mvp.roadmap["60day"], color: "bg-indigo-600" },
                              { day: "90", content: opt.mvp.roadmap["90day"], color: "bg-purple-600" }
                            ].map((step, i) => (
                              <div key={i} className="relative pl-16">
                                <div className={`absolute left-0 top-0 w-12 h-12 rounded-2xl ${step.color} border-4 border-zinc-950 flex flex-col items-center justify-center shadow-xl`}>
                                  <span className="text-[10px] font-black leading-none">{step.day}</span>
                                  <span className="text-[8px] font-bold opacity-70">DAYS</span>
                                </div>
                                <Card className="bg-card/50 border-border p-8 hover:bg-card/80 transition-all">
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Phase 0{i + 1} Execution</h4>
                                  <p className="text-foreground/80 leading-relaxed">{step.content}</p>
                                </Card>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-6">
                          <Card className="bg-card/80 border-border p-6">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-6 flex items-center gap-2">
                              <Construction className="w-4 h-4" /> Tech Stack
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {opt.mvp.techStack.map((t, i) => (
                                <Badge key={i} variant="secondary" className="bg-secondary text-muted-foreground px-3 py-1">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </Card>
                          <Card className="bg-card/80 border-border p-6">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-6 flex items-center gap-2">
                              <Check className="w-4 h-4" /> Core MVP Features
                            </h4>
                            <ul className="space-y-4">
                              {opt.mvp.features.map((f, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-3">
                                  <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <Check className="w-3 h-3 text-primary" />
                                  </div>
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </Card>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Pitch */}
                    <TabsContent value="pitch" className="space-y-8">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {opt.pitch.deckStructure.map((slide, i) => (
                          <Card key={i} className="bg-card/80 border-border aspect-video flex flex-col items-center justify-center p-6 text-center group hover:border-primary/30 transition-all cursor-default">
                            <span className="text-[10px] font-black text-muted-foreground mb-3 tracking-widest">SLIDE 0{i + 1}</span>
                            <span className="text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors">{slide}</span>
                          </Card>
                        ))}
                      </div>
                      <Card className="bg-card/50 border-border p-8">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Megaphone className="w-4 h-4" /> Go-To-Market Strategy
                        </h4>
                        <p className="text-foreground/80 leading-relaxed text-lg">{opt.pitch.gtmStrategy}</p>
                      </Card>
                    </TabsContent>

                    {/* Moat */}
                    <TabsContent value="moat" className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card className="bg-card/80 border-border p-10 relative overflow-hidden">
                          <div className="absolute right-0 top-0 p-12 opacity-5">
                            <Shield className="w-48 h-48" />
                          </div>
                          <h4 className="text-2xl font-bold mb-8 flex items-center gap-3">
                            <Shield className="w-6 h-6 text-primary" />
                            Defensibility (The Moat)
                          </h4>
                          <p className="text-foreground/90 leading-relaxed text-xl font-medium">{opt.pitch.moat}</p>
                        </Card>
                        <Card className="bg-card/80 border-border p-10">
                          <h4 className="text-2xl font-bold mb-8 flex items-center gap-3 text-purple-500">
                            <BrainCircuit className="w-6 h-6" />
                            Technical Limitations
                          </h4>
                          <p className="text-muted-foreground leading-relaxed">{report.paper.limitations}</p>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* Action Plan */}
                    <TabsContent value="action" className="space-y-8">
                      <Card className="bg-gradient-to-br from-card to-background border-border p-10">
                        <div className="flex items-center justify-between mb-10">
                          <h4 className="text-3xl font-black flex items-center gap-4">
                            <Rocket className="w-8 h-8 text-primary" />
                            FOUNDER ACTION PLAN
                          </h4>
                          <Badge className="bg-primary text-primary-foreground px-6 py-2 rounded-full">Next 30 Days</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {opt.actionPlan?.map((action, i) => (
                            <div key={i} className="flex items-center gap-6 p-6 rounded-2xl bg-secondary/30 border border-border hover:border-primary/30 transition-all group">
                              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xs font-black text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                {i + 1}
                              </div>
                              <p className="text-foreground/80 font-medium">{action}</p>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </TabsContent>

                    {/* Evidence */}
                    <TabsContent value="evidence" className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                          <Card className="bg-card/50 border-border p-8">
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-primary border-primary/30">
                                  {report.paper.academicField}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">{report.paper.domain}</span>
                              </div>
                              <h3 className="text-3xl font-bold">{report.paper.title}</h3>
                              <p className="text-muted-foreground leading-relaxed">{report.paper.problemStatement}</p>
                              <Separator className="bg-border" />
                              <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase">Novelty</h4>
                                  <p className="text-sm text-foreground/80">{report.paper.novelty}</p>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase">Research Gap</h4>
                                  <p className="text-sm text-foreground/80">{report.paper.researchGap}</p>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                        <div className="space-y-6">
                          <Card className="bg-gradient-to-br from-primary/10 to-transparent border-border p-6">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">Commercial Readiness</h4>
                            <div className="flex items-baseline gap-2 mb-4">
                              <span className="text-6xl font-black">{report.paper.readinessScore}</span>
                              <span className="text-muted-foreground">/100</span>
                            </div>
                            <Progress value={report.paper.readinessScore} className="h-1.5 bg-secondary" />
                          </Card>
                          <Card className="bg-card/50 border-border p-6">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">Key Findings</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">{report.paper.keyFindings}</p>
                          </Card>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              ))}
            </Tabs>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-12">
              <Button 
                variant="outline" 
                size="lg" 
                onClick={downloadReport}
                className="border-border hover:bg-secondary text-muted-foreground"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF Report
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => {
                  setReport(null);
                  setFile(null);
                  setCurrentStepIndex(-1);
                }}
                className="border-border hover:bg-secondary text-muted-foreground"
              >
                Analyze Another Paper
              </Button>
            </div>

            {/* Hidden Print Content for PDF Export (Text-First Structure) */}
            <div id="report-print-content" style={{ display: 'none' }}>
              <h1>Startup Opportunity Report</h1>
              <p><strong>Based on Research:</strong> {report.paper.title}</p>
              <p><strong>Field:</strong> {report.paper.academicField} | <strong>Domain:</strong> {report.paper.domain}</p>
              <p><strong>Commercial Readiness:</strong> {report.paper.readinessScore}/100</p>
              
              <h2>Executive Summary</h2>
              <p><strong>Problem Statement:</strong> {report.paper.problemStatement}</p>
              <p><strong>Key Findings:</strong> {report.paper.keyFindings}</p>
              <p><strong>Novelty:</strong> {report.paper.novelty}</p>
              <p><strong>Research Gap:</strong> {report.paper.researchGap}</p>
              
              {report.opportunities.map((opt, idx) => (
                <div key={opt.id}>
                  <hr />
                  <h1>Opportunity {idx + 1}: {opt.name}</h1>
                  <p className="success-score">Success Score: {opt.scores.overall}%</p>
                  <blockquote>{opt.oneLinePitch}</blockquote>
                  
                  <h2>1. Overview</h2>
                  <h3>The Problem</h3>
                  <p>{opt.problem}</p>
                  <h3>The Solution</h3>
                  <p>{opt.product}</p>
                  <h3>Strategic Vision</h3>
                  <p>{opt.description}</p>
                  
                  <h2>2. Market & ICP</h2>
                  <h3>Ideal Customer Profile (ICP)</h3>
                  <p>{opt.icp}</p>
                  <h3>Target Segments</h3>
                  <ul>{opt.targetUsers.map((u, i) => <li key={i}>{u}</li>)}</ul>
                  <h3>Market Pain Points</h3>
                  <ul>{opt.painPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  
                  <h2>3. Monetization</h2>
                  {opt.revenueModels.map((m, i) => (
                    <div key={i}>
                      <h3>{m.model}</h3>
                      <p><strong>Pricing:</strong> {m.pricing}</p>
                      <p><strong>Details:</strong> {m.details}</p>
                    </div>
                  ))}
                  
                  <h2>4. MVP Roadmap</h2>
                  <h3>30 Days</h3>
                  <p>{opt.mvp.roadmap["30day"]}</p>
                  <h3>60 Days</h3>
                  <p>{opt.mvp.roadmap["60day"]}</p>
                  <h3>90 Days</h3>
                  <p>{opt.mvp.roadmap["90day"]}</p>
                  <h3>Tech Stack</h3>
                  <p>{opt.mvp.techStack.join(", ")}</p>
                  <h3>Core Features</h3>
                  <ul>{opt.mvp.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  
                  <h2>5. Pitch Deck</h2>
                  <h3>Deck Structure</h3>
                  <ul>{opt.pitch.deckStructure.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}</ul>
                  <h3>GTM Strategy</h3>
                  <p>{opt.pitch.gtmStrategy}</p>
                  
                  <h2>6. Moat & Risk</h2>
                  <h3>Defensibility (The Moat)</h3>
                  <p>{opt.pitch.moat}</p>
                  <h3>Technical Limitations & Risks</h3>
                  <p>{report.paper.limitations}</p>
                  
                  <h2>7. Action Plan</h2>
                  <ul>{opt.actionPlan?.map((a, i) => <li key={i}>{i + 1}. {a}</li>)}</ul>
                  
                  <h2>Final Feasibility Summary</h2>
                  <ul>
                    <li><strong>Feasibility:</strong> {opt.scores.feasibility}/10</li>
                    <li><strong>Market Size:</strong> {opt.scores.marketSize}/10</li>
                    <li><strong>Defensibility:</strong> {opt.scores.defensibility}/10</li>
                    <li><strong>MVP Complexity:</strong> {opt.scores.mvpComplexity}/10</li>
                    <li><strong>Revenue Potential:</strong> {opt.scores.revenuePotential}/10</li>
                  </ul>
                </div>
              ))}
              
              <hr />
              <p><em>Generated by Paper2Startup Intelligence Engine</em></p>
              <p><em>Powered by Gemini 3.1 Pro & Multi-Agent Orchestration</em></p>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800/50 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Rocket className="w-4 h-4" />
            <span className="text-sm font-bold">Paper2Startup</span>
          </div>
          <p className="text-zinc-600 text-xs text-center md:text-right">
            Powered by Gemini 3.1 Pro & Multi-Agent Orchestration. For research purposes only.
          </p>
        </div>
      </footer>
    </div>
  );
}
