import React, { useState, useEffect } from "react";
import { 
  Scale, Plus, Trash2, Sparkles, RefreshCw, Sliders, CheckCircle2, 
  XCircle, HelpCircle, ChevronRight, Award, Copy, Check, Calendar, 
  BookOpen, Info, ArrowRight, Zap, Target, TrendingUp, Compass, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DecisionAnalysis, Criterion } from "./types";

const DilemmaTemplates = [
  {
    title: "Moving Dilemma",
    question: "Should I move to New York City or stay in San Francisco?",
    options: ["Move to New York City", "Stay in San Francisco"],
    context: "I am a software engineer. I love theater, night life, and walkability, but am sensitive to cold winters and high rents."
  },
  {
    title: "Career Dilemma",
    question: "Should I join an early-stage AI startup or stay at my Big Tech job?",
    options: ["Join early-stage AI startup", "Stay at Big Tech job"],
    context: "I have 3 years of experience. Big Tech is stable and pays well but feels repetitive. Startup offers high equity and high speed, but massive uncertainty."
  },
  {
    title: "Commuter Car",
    question: "Which vehicle should I purchase for my daily commute?",
    options: ["Tesla Model Y", "Honda CR-V Hybrid", "Used Toyota Prius"],
    context: "I drive 35 miles a day. I have a garage for charging. I care about budget, but also want a spacious cargo area for weekend trips."
  }
];

const LoadingMessages = [
  "Dicing the pros and cons...",
  "Consulting the binary sages...",
  "Weighing heavy trade-offs...",
  "Running 10,000 future simulations...",
  "Debating in the AI high senate...",
  "Structuring Strengths and Weaknesses...",
  "Drafting an objective SWOT analysis...",
  "Brewing the final recommendation verdict..."
];

export default function App() {
  // Input form state
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [context, setContext] = useState("");
  
  // App state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LoadingMessages[0]);
  const [currentAnalysis, setCurrentAnalysis] = useState<DecisionAnalysis | null>(null);
  const [history, setHistory] = useState<DecisionAnalysis[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"proscons" | "swot" | "table">("proscons");
  const [swotOption, setSwotOption] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Dynamic user-customized weights
  // Key: Criterion Name, Value: weight (0 to 100)
  const [weights, setWeights] = useState<{ [key: string]: number }>({});

  // Cycle loading messages during analysis
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      let index = 0;
      interval = setInterval(() => {
        index = (index + 1) % LoadingMessages.length;
        setLoadingMessage(LoadingMessages[index]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tiebreaker_history");
      if (saved) {
        const parsed = JSON.parse(saved) as DecisionAnalysis[];
        setHistory(parsed);
        // Load first history item as active if there is any
        if (parsed.length > 0 && !currentAnalysis) {
          selectAnalysis(parsed[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load history from localStorage", e);
    }
  }, []);

  // Save history to localStorage
  const saveHistory = (newHistory: DecisionAnalysis[]) => {
    try {
      localStorage.setItem("tiebreaker_history", JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (e) {
      console.error("Failed to save history to localStorage", e);
    }
  };

  // Helper to select an analysis from history
  const selectAnalysis = (analysis: DecisionAnalysis) => {
    setCurrentAnalysis(analysis);
    setSwotOption(analysis.options[0]);
    // Load existing customized weights, or default all to 100
    const initialWeights: { [key: string]: number } = {};
    analysis.criteria.forEach(crit => {
      initialWeights[crit.name] = analysis.weights && analysis.weights[crit.name] !== undefined 
        ? analysis.weights[crit.name] 
        : 100;
    });
    setWeights(initialWeights);
    // Set form input fields for visibility/editing
    setQuestion(analysis.question);
    setOptions(analysis.options);
    setContext(analysis.context || "");
  };

  // Preset dilemma click handler
  const handleApplyPreset = (preset: typeof DilemmaTemplates[0]) => {
    setQuestion(preset.question);
    setOptions(preset.options);
    setContext(preset.context);
    setError(null);
  };

  // Add a new option input
  const handleAddOption = () => {
    if (options.length < 5) {
      setOptions([...options, ""]);
    }
  };

  // Remove an option input
  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  // Option text change handler
  const handleOptionChange = (index: number, val: string) => {
    const newOptions = [...options];
    newOptions[index] = val;
    setOptions(newOptions);
  };

  // Calculate dynamic live scores based on user weights
  const getLiveOptionScores = () => {
    if (!currentAnalysis) return [];

    const scoresMap: { [option: string]: { totalWeightedScore: number; sumOfWeights: number } } = {};
    
    // Initialize
    currentAnalysis.options.forEach(opt => {
      scoresMap[opt] = { totalWeightedScore: 0, sumOfWeights: 0 };
    });

    // Accumulate weighted scores
    currentAnalysis.criteria.forEach(crit => {
      const weight = weights[crit.name] !== undefined ? weights[crit.name] : 100;
      crit.scores.forEach(scoreItem => {
        if (scoresMap[scoreItem.option]) {
          scoresMap[scoreItem.option].totalWeightedScore += scoreItem.score * weight;
          scoresMap[scoreItem.option].sumOfWeights += weight;
        }
      });
    });

    // Compute final percentage scores out of 100
    return currentAnalysis.options.map(opt => {
      const { totalWeightedScore, sumOfWeights } = scoresMap[opt];
      const finalScore = sumOfWeights > 0 ? (totalWeightedScore / (sumOfWeights * 10)) * 100 : 0;
      return {
        name: opt,
        score: Math.round(finalScore * 10) / 10 // Rounded to 1 decimal place
      };
    }).sort((a, b) => b.score - a.score);
  };

  const liveScores = getLiveOptionScores();
  const liveWinner = liveScores.length > 0 ? liveScores[0] : null;

  // Submit dilemma for analysis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    const trimmedQuestion = question.trim();
    const filteredOptions = options.map(o => o.trim()).filter(o => o !== "");

    if (!trimmedQuestion) {
      setError("Please formulate your decision dilemma question.");
      return;
    }
    if (filteredOptions.length < 2) {
      setError("Please provide at least 2 distinct options to compare.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          options: filteredOptions,
          context: context.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || "Failed to analyze decision.");
      }

      const reportData = await response.json();

      const newAnalysis: DecisionAnalysis = {
        ...reportData,
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        question: trimmedQuestion,
        options: filteredOptions,
        context: context.trim(),
        createdAt: new Date().toISOString()
      };

      // Add to history list at the top
      const updatedHistory = [newAnalysis, ...history.filter(h => h.question !== trimmedQuestion)];
      saveHistory(updatedHistory);
      
      // Select newly generated analysis
      setCurrentAnalysis(newAnalysis);
      setSwotOption(newAnalysis.options[0]);
      
      // Initialize weights to 100
      const initialWeights: { [key: string]: number } = {};
      newAnalysis.criteria.forEach(crit => {
        initialWeights[crit.name] = 100;
      });
      setWeights(initialWeights);

    } catch (err: any) {
      setError(err?.message || "Something went wrong while consulting the oracle.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Copy report summary to clipboard
  const handleCopyReport = () => {
    if (!currentAnalysis || !liveWinner) return;

    const criteriaText = currentAnalysis.criteria.map(c => {
      const optionScores = c.scores.map(s => `${s.option}: ${s.score}/10`).join(", ");
      return `- ${c.name} (${c.description}): ${optionScores}`;
    }).join("\n");

    const reportText = `THE TIE BREAKER REPORT
====================
Decision dilemma: "${currentAnalysis.question}"

🎯 ACTIVE WINNER (Based on weighted analysis):
👉 ${liveWinner.name} (Score: ${liveWinner.score}/100)

🔮 THE TIE BREAKER'S VERDICT:
"${currentAnalysis.verdictExplanation}"

📊 EVALUATION CRITERIA:
${criteriaText}

====================
Analyzed via The Tie Breaker.`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Delete decision from history
  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    saveHistory(updated);
    if (currentAnalysis?.id === id) {
      if (updated.length > 0) {
        selectAnalysis(updated[0]);
      } else {
        setCurrentAnalysis(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-indigo-100">
      {/* Top Header Navigation */}
      <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-sm">
            <Scale className="h-4.5 w-4.5 text-white stroke-[2]" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight uppercase text-slate-900">
              The Tie Breaker
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">AI Decision Analyst</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setQuestion("");
              setOptions(["", ""]);
              setContext("");
              setError(null);
              setCurrentAnalysis(null);
              const el = document.getElementById("dilemma-form");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full shadow-sm transition-all cursor-pointer"
          >
            New Decision
          </button>
        </div>
      </nav>

      {/* Active Decision Banner */}
      {currentAnalysis && (
        <div className="px-6 md:px-8 py-6 bg-white border-b border-slate-100 transition-all">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              Active Analysis
            </div>
            <h2 className="text-xl md:text-3xl font-light text-slate-900 leading-tight">
              {currentAnalysis.question}
            </h2>
            {currentAnalysis.context && (
              <p className="text-xs text-slate-500 mt-2 italic font-sans max-w-4xl">
                Context: {currentAnalysis.context}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Decision Configurator & Templates */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Main dilemmas Form Card */}
          <div id="dilemma-form" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 relative">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Target className="h-4.5 w-4.5 text-slate-400" />
                Dilemma Planner
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setQuestion("");
                  setOptions(["", ""]);
                  setContext("");
                  setError(null);
                }}
                className="text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
                title="Reset dilemma planner"
              >
                <RefreshCw className="h-3 w-3" />
                Clear
              </button>
            </div>

            <form onSubmit={handleAnalyze} className="space-y-4">
              
              {/* Question Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  What is the dilemma?
                </label>
                <input
                  type="text"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Should I join early-stage AI startup or stay at Big Tech?"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Options Inputs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Options to compare ({options.length}/5)
                  </label>
                  {options.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Option
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {options.map((opt, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-xs font-mono text-slate-400 w-5 text-right">{idx + 1}.</span>
                        <input
                          type="text"
                          required
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400"
                        />
                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Remove option"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Context Area */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Additional Context & Preferences (Optional)
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Mention key criteria you care about (e.g., salary, work-life balance, equity). This helps customize the criteria scores."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Error Box */}
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isAnalyzing}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Analyzing Options...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-white fill-white/20" />
                    <span>Break the Tie</span>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Preset templates section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-slate-400" />
              Try a Quick Template
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {DilemmaTemplates.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => handleApplyPreset(tpl)}
                  className="text-left p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-start justify-between group cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{tpl.title}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{tpl.question}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </div>

          {/* History Manager */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-slate-400" />
                Saved Decisions ({history.length})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => selectAnalysis(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                      currentAnalysis?.id === item.id
                        ? "border-indigo-600 bg-indigo-50/20"
                        : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className={`text-xs font-semibold truncate ${
                        currentAnalysis?.id === item.id ? "text-indigo-900" : "text-slate-700"
                      }`}>
                        {item.question}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {item.options.length} options
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistory(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                      title="Delete decision"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Dynamic Report & Interactive Tuning */}
        <div className="lg:col-span-7">
          
          <AnimatePresence mode="wait">
            
            {/* 1. Loader State */}
            {isAnalyzing && (
              <motion.div
                key="loading-panel"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl border border-slate-200 p-12 min-h-[500px] flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-24 h-24 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                    <Scale className="h-8 w-8 text-indigo-600 animate-pulse" />
                  </div>
                </div>
                
                <div className="space-y-2 max-w-md">
                  <h3 className="font-display font-bold text-xl tracking-tight text-slate-800">
                    The Oracle is Cogitating
                  </h3>
                  <div className="h-6 overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={loadingMessage}
                        initial={{ y: 15, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -15, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-sm font-mono text-slate-500 tracking-wide"
                      >
                        {loadingMessage}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. No Active Dilemma State */}
            {!isAnalyzing && !currentAnalysis && (
              <motion.div
                key="empty-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-2xl border border-slate-200 p-12 min-h-[500px] flex flex-col items-center justify-center text-center shadow-sm"
              >
                <div className="bg-slate-50 p-4 rounded-full mb-4 border border-slate-100">
                  <Scale className="h-10 w-10 text-slate-400 stroke-[1.25]" />
                </div>
                <h3 className="font-display font-semibold text-base text-slate-800 mb-1">
                  The Decision Chamber is Empty
                </h3>
                <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
                  Formulate a dilemma on the left, use a standard template, or reload a past query to analyze the trade-offs and break the tie.
                </p>
                <button
                  onClick={() => {
                    const el = document.getElementById("dilemma-form");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold py-2.5 px-4 rounded-full flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  Create Dilemma
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}

            {/* 3. Detailed Report View */}
            {!isAnalyzing && currentAnalysis && liveWinner && (
              <motion.div
                key="report-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* AI Recommendation / Verdict Card */}
                <div className="bg-indigo-900 text-white rounded-2xl p-6 md:p-8 shadow-md flex flex-col justify-between space-y-4 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-800/20 rounded-full blur-3xl" />
                  
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-200 font-semibold bg-indigo-800/60 px-2.5 py-1 rounded-full border border-indigo-700/40">
                      AI RECOMMENDATION VERDICT
                    </span>
                    <div className="flex items-baseline justify-between gap-4 mt-3">
                      <h3 className="font-display font-bold text-2xl md:text-3xl tracking-tight text-white">
                        {liveWinner.name}
                      </h3>
                      <div className="text-right shrink-0 bg-indigo-950/40 border border-indigo-800/40 px-3 py-1 rounded-xl">
                        <span className="text-[9px] font-mono uppercase text-indigo-300 block">SCORE</span>
                        <span className="text-xl font-display font-bold text-amber-300">{liveWinner.score}</span>
                        <span className="text-[10px] text-indigo-300 font-mono">/100</span>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-indigo-100 font-light italic">
                      "{currentAnalysis.verdictExplanation}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-indigo-800/60 text-xs text-indigo-300">
                    <span>Based on objective trade-offs and customized weightings</span>
                    <button
                      onClick={handleCopyReport}
                      className="bg-white/10 hover:bg-white/15 text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3.5 text-green-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3.5" />
                          <span>Export Report</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Scores Graph Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-slate-400" />
                      Live Score Comparisons
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Weighted Index</span>
                  </div>

                  <div className="space-y-3.5">
                    {liveScores.map((scoreObj) => {
                      const isWinning = scoreObj.name === liveWinner.name;
                      return (
                        <div key={scoreObj.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="flex items-center gap-1.5 text-slate-700">
                              {isWinning ? (
                                <Award className="h-3.5 w-3.5 text-amber-500 fill-amber-500/10" />
                              ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1" />
                              )}
                              <span className={isWinning ? "font-semibold text-slate-900" : ""}>{scoreObj.name}</span>
                            </span>
                            <span className={`font-mono ${isWinning ? "font-bold text-indigo-600" : "text-slate-500"}`}>
                              {scoreObj.score} / 100
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${scoreObj.score}%` }}
                              transition={{ type: "spring", stiffness: 80 }}
                              className={`h-full rounded-full transition-all ${
                                isWinning 
                                  ? "bg-indigo-600" 
                                  : "bg-slate-300"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Criteria Weighing Sliders */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Sliders className="h-4 w-4 text-slate-400" />
                        Criteria Value Tuning
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Drag to specify how heavily you value each decision factor.</p>
                    </div>
                    <button
                      onClick={() => {
                        const resetWeights: { [key: string]: number } = {};
                        currentAnalysis.criteria.forEach(crit => {
                          resetWeights[crit.name] = 100;
                        });
                        setWeights(resetWeights);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reset Weights
                    </button>
                  </div>

                  <div className="space-y-4">
                    {currentAnalysis.criteria.map((crit) => {
                      const currentWeight = weights[crit.name] !== undefined ? weights[crit.name] : 100;
                      return (
                        <div key={crit.name} className="space-y-2 p-3 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h5 className="text-xs font-bold text-slate-800">{crit.name}</h5>
                              <p className="text-[11px] text-slate-500 leading-normal">{crit.description}</p>
                            </div>
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                              {currentWeight}%
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={currentWeight}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setWeights({
                                  ...weights,
                                  [crit.name]: val
                                });
                                const updatedAnalysis = {
                                  ...currentAnalysis,
                                  weights: {
                                    ...(currentAnalysis.weights || {}),
                                    [crit.name]: val
                                  }
                                };
                                const updatedHistory = history.map(h => h.id === currentAnalysis.id ? updatedAnalysis : h);
                                saveHistory(updatedHistory);
                                setCurrentAnalysis(updatedAnalysis);
                              }}
                              className="flex-1 accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Individual scores for each option under this criteria */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5 border-t border-slate-100 mt-1">
                            {crit.scores.map((s) => (
                              <div key={s.option} className="flex items-center space-x-1">
                                <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{s.option}:</span>
                                <span className="text-[10px] font-mono font-semibold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                  {s.score}/10
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Perspective Tabs (Pros/Cons, SWOT, Table) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  
                  {/* Tab Headers */}
                  <div className="flex border-b border-slate-200">
                    <button
                      onClick={() => setActiveTab("proscons")}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                        activeTab === "proscons"
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      Pros / Cons List
                    </button>
                    <button
                      onClick={() => setActiveTab("swot")}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                        activeTab === "swot"
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      SWOT Analysis
                    </button>
                    <button
                      onClick={() => setActiveTab("table")}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                        activeTab === "table"
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      Comparison Matrix
                    </button>
                  </div>

                  {/* Tab Contents */}
                  <div className="pt-2">
                    
                    {/* Perspective 1: Pros & Cons Side-by-Side */}
                    {activeTab === "proscons" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {currentAnalysis.optionDetails.map((opt) => (
                          <div key={opt.name} className="border border-slate-200 rounded-2xl p-5 bg-white flex flex-col justify-between shadow-sm">
                            <div className="space-y-4">
                              <h5 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center justify-between">
                                <span className="truncate">{opt.name}</span>
                                {opt.name === liveWinner.name && (
                                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">
                                    WINNER
                                  </span>
                                )}
                              </h5>

                              {/* Pros list */}
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">Pros</p>
                                <div className="space-y-2">
                                  {opt.pros.map((pro, i) => (
                                    <div key={i} className="p-3 bg-emerald-50 border-l-4 border-emerald-400 rounded-r-lg text-xs font-medium text-emerald-800">
                                      + {pro}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Cons list */}
                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <p className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">Cons</p>
                                <div className="space-y-2">
                                  {opt.cons.map((con, i) => (
                                    <div key={i} className="p-3 bg-rose-50 border-l-4 border-rose-400 rounded-r-lg text-xs font-medium text-rose-800">
                                      - {con}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Perspective 2: SWOT Matrix */}
                    {activeTab === "swot" && (
                      <div className="space-y-4">
                        {/* Selector for which option's SWOT to view */}
                        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
                          {currentAnalysis.options.map((optName) => (
                            <button
                              key={optName}
                              onClick={() => setSwotOption(optName)}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer truncate ${
                                swotOption === optName
                                  ? "bg-white text-slate-800 shadow-sm"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              {optName}
                            </button>
                          ))}
                        </div>

                        {/* Rendering the SWOT Matrix */}
                        {currentAnalysis.optionDetails.filter(o => o.name === swotOption).map((opt) => (
                          <div key={opt.name} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Strengths */}
                            <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-3">
                              <div className="flex justify-between items-start">
                                <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                  Strengths
                                </h5>
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">S</div>
                              </div>
                              <ul className="text-xs space-y-2 text-slate-600">
                                {opt.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                              </ul>
                            </div>

                            {/* Weaknesses */}
                            <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-3">
                              <div className="flex justify-between items-start">
                                <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                  Weaknesses
                                </h5>
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">W</div>
                              </div>
                              <ul className="text-xs space-y-2 text-slate-600">
                                {opt.weaknesses.map((w, i) => <li key={i}>• {w}</li>)}
                              </ul>
                            </div>

                            {/* Opportunities */}
                            <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-3">
                              <div className="flex justify-between items-start">
                                <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                  Opportunities
                                </h5>
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">O</div>
                              </div>
                              <ul className="text-xs space-y-2 text-slate-600">
                                {opt.opportunities.map((o, i) => <li key={i}>• {o}</li>)}
                              </ul>
                            </div>

                            {/* Threats */}
                            <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 space-y-3">
                              <div className="flex justify-between items-start">
                                <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                  Threats
                                </h5>
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">T</div>
                              </div>
                              <ul className="text-xs space-y-2 text-slate-600">
                                {opt.threats.map((t, i) => <li key={i}>• {t}</li>)}
                              </ul>
                            </div>

                          </div>
                        ))}
                      </div>
                    )}

                    {/* Perspective 3: Comparison Matrix Table */}
                    {activeTab === "table" && (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100 bg-slate-50">
                              <th className="p-4 font-semibold font-display">Criterion</th>
                              {currentAnalysis.options.map((optName) => (
                                <th key={optName} className="p-4 font-semibold font-display border-l border-slate-100">
                                  {optName}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {currentAnalysis.comparisonDimensions.map((dim) => (
                              <tr key={dim.dimension} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-medium text-slate-600">
                                  {dim.dimension}
                                </td>
                                {currentAnalysis.options.map((optName) => {
                                  const matchingVal = dim.values.find(v => v.option === optName);
                                  const isWinnerOption = optName === liveWinner.name;
                                  return (
                                    <td key={optName} className={`p-4 border-l border-slate-50 leading-normal max-w-xs ${isWinnerOption ? "font-semibold text-indigo-600 bg-indigo-50/5" : "text-slate-500"}`}>
                                      {matchingVal ? matchingVal.value : "N/A"}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  </div>

                </div>

              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </div>

      {/* Footer credits */}
      <footer className="border-t border-slate-200 mt-auto py-6 text-center text-xs text-slate-400 bg-white">
        <p>© 2026 The Tie Breaker. Made for rational humans of action.</p>
      </footer>
    </div>
  );
}
