"use server";

export async function fetchAutocomplete(query: string) {
  if (!query || query.length < 2) return [];

  try {
    // We use the open Firefox client endpoint for Google Suggest. 
    // It is blazing fast, perfectly formatted, and saves your paid Serper credits.
    const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`);

    if (!response.ok) return [];
    
    // Google returns format: ["query", ["suggestion1", "suggestion2", ...]]
    const data = await response.json();
    return data[1] || []; 
  } catch (error) {
    console.error("Autocomplete Error:", error);
    return [];
  }
}