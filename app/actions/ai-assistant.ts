"use server";

export async function scrapeAndSummarize(url: string) {
  if (!url) return null;

  try {
    // 1. Scrape the URL using Serper
    const serperHeaders = new Headers();
    serperHeaders.append("X-API-KEY", process.env.SERPER_API_KEY as string);
    serperHeaders.append("Content-Type", "application/json");

    const scrapeRes = await fetch("https://scrape.serper.dev", {
      method: "POST",
      headers: serperHeaders,
      body: JSON.stringify({ url }),
      redirect: "follow"
    });

    if (!scrapeRes.ok) throw new Error("Failed to scrape URL");
    const scrapeData = await scrapeRes.json();
    const scrapedText = scrapeData.text;

    if (!scrapedText) {
      return "Could not extract readable text from this page. It might be a protected site or an image-heavy page.";
    }

    // 2. Pipe the scraped text to Groq for a summary
    const prompt = `You are Nova's AI reading assistant. Your job is to summarize the following webpage content extracted from a URL.
    Keep the summary detailed but concise. Use bullet points for key takeaways if necessary.

    Source URL: ${url}

    Webpage Content:
    ${scrapedText.substring(0, 15000)} // Truncating to 15k characters to stay safely within context limits
    `;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!groqRes.ok) throw new Error("Failed to summarize with Groq");
    const groqData = await groqRes.json();
    return groqData.choices[0].message.content;

  } catch (error) {
    console.error("AI Assistant Error:", error);
    return "Sorry, I couldn't scrape and summarize this page. The website might be blocking scrapers.";
  }
}