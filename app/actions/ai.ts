"use server";

export async function fetchAiOverview(query: string, searchContext: any[]) {
  if (!query || !searchContext || searchContext.length === 0) return null;

  // 1. Format the top search results into a readable context block
  const contextText = searchContext
    .map((item, index) => `[${index + 1}] Title: ${item.title}\nSnippet: ${item.snippet}`)
    .join("\n\n");

  // 2. Build the strict RAG prompt
  const prompt = `You are the AI brain of a highly advanced search engine called Nova. 
Your goal is to provide a concise, highly accurate, and direct summary answering the user's query.

CRITICAL INSTRUCTIONS:
- Base your answer STRICTLY on the "Search Results" provided below.
- Do not hallucinate or use outside knowledge. 
- Keep it to 1-2 short, readable paragraphs.
- Be objective and helpful.

User Query: ${query}

Search Results:
${contextText}`;

  try {
    // 3. Hit the Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", 
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2, // Low temp for more factual/deterministic output
        max_tokens: 250
      })
    });

    if (!response.ok) throw new Error("Failed to fetch from Groq");
    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error("Groq API Error:", error);
    return "AI Overview is currently unavailable. Please refer to the search results below.";
  }
}