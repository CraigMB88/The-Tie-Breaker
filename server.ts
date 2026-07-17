import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazy/safely
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper function to generate content with automatic retries and model fallbacks
async function generateContentWithFallback(
  ai: GoogleGenAI,
  config: {
    contents: any;
    config: any;
  },
  models: string[] = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"]
): Promise<any> {
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API] Attempting generation with model: ${model} (attempt ${attempt}/2)`);
        const response = await ai.models.generateContent({
          model,
          contents: config.contents,
          config: config.config,
        });
        console.log(`[Gemini API] Success using model: ${model}`);
        return response;
      } catch (error: any) {
        lastError = error;
        const errorStr = String(error?.message || error?.statusText || error);
        const statusCode = error?.status || error?.code || (error?.response && error.response.status);

        console.warn(`[Gemini API] Error with model ${model} (attempt ${attempt}):`, errorStr);

        const isModelUnavailable =
          statusCode === 404 ||
          errorStr.includes("404") ||
          errorStr.includes("NOT_FOUND") ||
          errorStr.includes("not available") ||
          errorStr.includes("no longer available") ||
          errorStr.includes("not found");

        if (isModelUnavailable) {
          console.warn(`[Gemini API] Model ${model} is not available (404/NOT_FOUND). Trying next model...`);
          break; // Break the attempt loop to move to the next model
        }

        const isTransient =
          statusCode === 503 ||
          statusCode === 429 ||
          errorStr.includes("503") ||
          errorStr.includes("429") ||
          errorStr.includes("UNAVAILABLE") ||
          errorStr.includes("ResourceExhausted") ||
          errorStr.includes("high demand") ||
          errorStr.includes("overloaded");

        if (!isTransient) {
          // If it is a hard/non-transient error (like schema or API key missing), throw immediately
          throw error;
        }

        if (attempt < 2) {
          const delay = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.warn(`[Gemini API] Model ${model} failed. Falling back to the next model...`);
  }

  throw lastError || new Error("All fallback models failed.");
}

// API endpoint for analyzing a decision
app.post("/api/analyze", async (req, res) => {
  try {
    const { question, options, context } = req.body;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: "Please provide a valid question and at least 2 options." });
    }

    const ai = getAiClient();

    const systemInstruction = `You are "The Tie Breaker", a legendary, witty, and highly rational decision-making mentor.
Your job is to take a difficult decision, weigh the options objectively, create clear comparison matrices, perform a SWOT analysis, and break the tie with a decisive final verdict.
Be witty, concise, highly logical, and authoritative. Refuse to be indecisive—always choose a clear winner.
Make sure the evaluation criteria are highly tailored to the specific context of the decision. For example, if the decision is about job offers, use criteria like Salary, Work-life Balance, Career Growth, and Commute. If the decision is about purchasing a car, use Cost, Reliability, Eco-friendliness, and Tech features.
For each criterion, assign an objective score (1 to 10) for each option. These will be the baseline scores before the user customizes the weights.`;

    const prompt = `Decision Question: "${question}"
Options to compare:
${options.map((opt, idx) => `- ${opt}`).join("\n")}

Additional context or personal preferences:
"${context || "None provided. Use general best-judgment."}"

Analyze this decision thoroughly. Provide detailed pros and cons, evaluation criteria with initial scores, comparison dimensions, and a definitive verdict with explanation. Make sure the 'option' fields in the JSON match EXACTLY the options provided in the input list.`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: {
              type: Type.STRING,
              description: "A clear, decisive final option recommended based on initial scoring (must match one of the exact option names provided)."
            },
            verdictExplanation: {
              type: Type.STRING,
              description: "A brief, witty, yet highly rational explanation of why this option is recommended over the others, weighing the main trade-offs."
            },
            criteria: {
              type: Type.ARRAY,
              description: "List of 4-6 key evaluation criteria customized to this specific decision (e.g., Cost, Convenience, Career Impact, Fun Factor).",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Name of the criterion, e.g., 'Financial Impact'." },
                  description: { type: Type.STRING, description: "A sentence explaining how this criterion applies." },
                  scores: {
                    type: Type.ARRAY,
                    description: "Scores for each of the options. Must contain exactly one score item per option.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        option: { type: Type.STRING, description: "The exact name of the option." },
                        score: { type: Type.INTEGER, description: "A score from 1 to 10 (10 being best)." }
                      },
                      required: ["option", "score"]
                    }
                  }
                },
                required: ["name", "description", "scores"]
              }
            },
            optionDetails: {
              type: Type.ARRAY,
              description: "Detailed analysis for each option, including pros/cons and SWOT matrix fields.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "The exact option name." },
                  pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 compelling pros for this option." },
                  cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 compelling cons for this option." },
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 strengths for SWOT analysis." },
                  weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 weaknesses for SWOT analysis." },
                  opportunities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 opportunities for SWOT analysis." },
                  threats: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 threats for SWOT analysis." }
                },
                required: ["name", "pros", "cons", "strengths", "weaknesses", "opportunities", "threats"]
              }
            },
            comparisonDimensions: {
              type: Type.ARRAY,
              description: "Side-by-side comparisons of all options across 3-4 specific dimensions.",
              items: {
                type: Type.OBJECT,
                properties: {
                  dimension: { type: Type.STRING, description: "The dimension of comparison (e.g., 'Timeline', 'Effort Required', 'Long-term Growth')." },
                  values: {
                    type: Type.ARRAY,
                    description: "Value descriptions for each of the options. Must contain exactly one item per option.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        option: { type: Type.STRING, description: "The exact name of the option." },
                        value: { type: Type.STRING, description: "A short text comparison or value for this option." }
                      },
                      required: ["option", "value"]
                    }
                  }
                },
                required: ["dimension", "values"]
              }
            }
          },
          required: ["verdict", "verdictExplanation", "criteria", "optionDetails", "comparisonDimensions"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text content returned from Gemini model.");
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (error: any) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: error?.message || "Failed to analyze decision." });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`The Tie Breaker server is running on http://localhost:${PORT}`);
  });
}

startServer();
