"use server";

// ============================================================================
// API KEY & MODEL LOAD BALANCER
// ============================================================================
const rawGroqKeys = process.env.GROQ_API_KEY || "";
const groqApiKeys = rawGroqKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
let currentKeyIndex = 0;

function getNextGroqKey(): string {
  if (groqApiKeys.length === 0) {
    console.warn("CRITICAL: No Groq API keys found in environment variables.");
    return "";
  }
  const key = groqApiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % groqApiKeys.length;
  return key;
}

// Fallback cascade: Start big, fallback to smaller/faster models if rate limited.
const MODELS = [
  "llama-3.3-70b-versatile", 
  "llama-3.1-8b-instant", 
  "gemma2-9b-it"
];

export async function scrapeAndSummarize(url: string) {
  if (!url) return null;

  let scrapedText = "";

  // ============================================================================
  // STEP 1: SCRAPE THE URL (Execute only once to save Serper credits)
  // ============================================================================
  try {
    const serperApiKey = process.env.SERPER_API_KEY;
    if (!serperApiKey) throw new Error("SERPER_API_KEY is missing.");

    console.log(`[Nova] Scraping URL: ${url}`);
    
    const scrapeRes = await fetch("https://scrape.serper.dev", {
      method: "POST",
      headers: {
        "X-API-KEY": serperApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url }),
      redirect: "follow"
    });

    if (!scrapeRes.ok) throw new Error(`Serper Scrape Failed with status ${scrapeRes.status}`);
    
    const scrapeData = await scrapeRes.json();
    scrapedText = scrapeData.text || "";

    if (!scrapedText || scrapedText.trim() === "") {
      return "Could not extract readable text from this page. It might be a protected site, a paywall, or an image-heavy page.";
    }

  } catch (error: any) {
    console.error("[Scraper Error]:", error.message);
    return "Sorry, I couldn't scrape this page. The website might be blocking AI scrapers.";
  }

  // ============================================================================
  // STEP 2: GROQ LLM SUMMARIZATION WITH LOAD BALANCING & RETRIES
  // ============================================================================
  
  // Truncating to 15k characters to stay safely within context limits
  const safeText = scrapedText.substring(0, 15000);
  
  const prompt = `You are Nova's AI reading assistant. Your job is to summarize the following webpage content extracted from a URL.
  Keep the summary detailed but concise. Use bullet points for key takeaways if necessary.

  Source URL: ${url}

  Webpage Content:
  ${safeText}
  `;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const activeKey = getNextGroqKey();
      const activeModel = MODELS[Math.min(attempts, MODELS.length - 1)];

      console.log(`[Nova] Summarizing (Attempt ${attempts + 1}) using ${activeModel}...`);

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${activeKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3, // Slightly creative but grounded for good summaries
          max_tokens: 1024  // Give it enough room to write a solid summary
        })
      });

      if (!groqRes.ok) {
        const errorData = await groqRes.json().catch(() => ({}));
        throw new Error(`Groq API Error ${groqRes.status}: ${JSON.stringify(errorData)}`);
      }

      const groqData = await groqRes.json();
      return groqData.choices[0].message.content;

    } catch (error: any) {
      console.warn(`[Summary Attempt ${attempts + 1} Failed]:`, error.message);
      attempts++;
      
      // If we've exhausted all attempts, return a graceful error
      if (attempts >= maxAttempts) {
        console.error("[Nova] All summarization attempts failed.");
        break;
      }
      
      // Wait 1.5 seconds before retrying with the next model/key
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  return "I am currently experiencing heavy network traffic and reached my processing limits. I couldn't generate the summary at this time.";
}