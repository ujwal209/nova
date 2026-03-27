"use server";

export async function fetchAutocomplete(query: string) {
  if (!query || query.length < 2) return [];

  try {
    const serperHeaders = new Headers();
    serperHeaders.append("X-API-KEY", process.env.SERPER_API_KEY as string);
    serperHeaders.append("Content-Type", "application/json");

    const response = await fetch("https://google.serper.dev/autocomplete", {
      method: "POST",
      headers: serperHeaders,
      body: JSON.stringify({ q: query }),
    });

    if (!response.ok) return [];
    
    // The API returns an array of suggestions
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Autocomplete Error:", error);
    return [];
  }
}