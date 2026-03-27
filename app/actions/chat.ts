"use server";

export async function generateNovaResponse(chatHistory: any[], newQuery: string) {
  if (!newQuery) return null;

  try {
    // 1. Fetch live search results from Serper
    const serperHeaders = new Headers();
    serperHeaders.append("X-API-KEY", process.env.SERPER_API_KEY as string);
    serperHeaders.append("Content-Type", "application/json");

    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: serperHeaders,
      body: JSON.stringify({ q: newQuery, num: 6 }), // Get top 6 results
    });

    if (!serperRes.ok) throw new Error("Serper search failed");
    const searchData = await serperRes.json();
    const organicResults = searchData.organic || [];

    // 2. Format the sources so we can send them back to the UI
    const sources = organicResults.slice(0, 6).map((r: any) => {
      let domain = "";
      try { domain = new URL(r.link).hostname; } catch (e) {}
      
      return {
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        domain: domain.replace("www.", "")
      };
    });

    // 3. Build the strict context prompt for Groq
    const contextText = sources.map((s: any, i: number) => 
      `[Source ${i + 1}] Title: ${s.title}\nURL: ${s.link}\nSnippet: ${s.snippet}`
    ).join("\n\n");

    const systemPrompt = `You are Nova, a highly intelligent, real-time AI search engine.
    Your goal is to provide a comprehensive, deeply detailed, and well-structured answer to the user's query.
    
    CRITICAL INSTRUCTIONS:
    - Base your answer heavily on the "SEARCH RESULTS" provided below.
    - CITE YOUR SOURCES inline using markdown brackets, e.g., "React is a UI library [Source 1]."
    - Use Markdown formatting (headings, bold text, bullet points) to make your response easy to read.
    - If the search results do not contain the answer, rely on your internal knowledge but state that the web results were limited.
    - Be objective, direct, and highly informative.

    SEARCH RESULTS:
    ${contextText}`;

    // Format the history for Groq
    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: newQuery }
    ];

    // 4. Hit Groq for the deep synthesis
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: formattedMessages,
        temperature: 0.3, 
        max_tokens: 1500 // Increased token limit for in-depth answers
      })
    });

    if (!groqRes.ok) throw new Error("Groq generation failed");
    const groqData = await groqRes.json();
    const answer = groqData.choices[0].message.content;

    // Return BOTH the AI answer and the raw sources to build the UI
    return { answer, sources };

  } catch (error) {
    console.error("Nova Error:", error);
    return { 
      answer: "I encountered an error trying to search the web and generate an overview. Please try asking again.", 
      sources: [] 
    };
  }
}