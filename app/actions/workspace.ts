"use server";

import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// ============================================================================
// API KEY & MODEL LOAD BALANCER
// ============================================================================
const rawGroqKeys = process.env.GROQ_API_KEY || "";
const groqApiKeys = rawGroqKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
let currentKeyIndex = 0;

function getNextGroqKey(): string {
  if (groqApiKeys.length === 0) return "";
  const key = groqApiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % groqApiKeys.length;
  return key;
}

const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];

// ============================================================================
// 1. GENERATE AI OVERVIEW (For the top of the search results)
// ============================================================================
export async function generateSearchOverview(query: string) {
  if (!query) return null;

  try {
    // 1. Grab quick context from Serper
    const serperApiKey = process.env.SERPER_API_KEY;
    let context = "";
    if (serperApiKey) {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "in" })
      });
      const data = await res.json();
      if (data.organic) {
        context = data.organic.slice(0, 5).map((r: any) => `${r.title}: ${r.snippet}`).join("\n");
      }
    }

    // 2. Synthesize with Groq (WITH RETRY & FALLBACK LOOP)
    const sysMsg = new SystemMessage("You are Nova, an AI search summarizer. Provide a concise, highly accurate, markdown-formatted overview of the user's query based on the context provided. Do not use conversational filler. Focus strictly on answering the query.");
    const userMsg = new HumanMessage(`Query: ${query}\n\nContext:\n${context}`);

    let attempts = 0;
    while (attempts < 3) {
      try {
        const llm = new ChatGroq({ 
          apiKey: getNextGroqKey(), 
          model: MODELS[Math.min(attempts, MODELS.length - 1)], // Stepping down model if rate limited
          temperature: 0.2, 
          maxTokens: 500 
        });

        const response = await llm.invoke([sysMsg, userMsg]);
        return response.content as string;
      } catch (e) {
        attempts++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return "System is currently experiencing heavy traffic. Could not generate AI overview.";

  } catch (error) {
    console.error("Overview generation failed:", error);
    return "Failed to generate AI overview.";
  }
}

// ============================================================================
// 2. SCRAPE & SUMMARIZE WEBPAGE (For the Modal)
// ============================================================================
export async function scrapeAndSummarizePage(url: string) {
  if (!url) return null;

  let scrapedText = "";

  try {
    const serperApiKey = process.env.SERPER_API_KEY;
    if (!serperApiKey) throw new Error("SERPER_API_KEY missing.");

    const scrapeRes = await fetch("https://scrape.serper.dev", {
      method: "POST",
      headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      redirect: "follow"
    });

    if (!scrapeRes.ok) throw new Error("Scrape failed.");
    const scrapeData = await scrapeRes.json();
    scrapedText = scrapeData.text || "";

    if (!scrapedText.trim()) return "Could not extract readable text. The site might be protected or image-heavy.";

  } catch (error: any) {
    return "Sorry, I couldn't scrape this page. The website might be blocking AI scrapers.";
  }

  const prompt = `Summarize the following webpage content extracted from: ${url}
  Keep the summary detailed but concise. Use markdown formatting and bullet points.
  
  Content:
  ${scrapedText.substring(0, 15000)}`;

  let attempts = 0;
  while (attempts < 3) {
    try {
      const llm = new ChatGroq({ 
        apiKey: getNextGroqKey(), 
        model: MODELS[Math.min(attempts, MODELS.length - 1)], 
        temperature: 0.2, 
        maxTokens: 1024 
      });

      const response = await llm.invoke([
        new SystemMessage("You are Nova's AI reading assistant."),
        new HumanMessage(prompt)
      ]);
      
      return response.content as string;
    } catch (e) {
      attempts++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return "Rate limits reached. Could not generate summary.";
}