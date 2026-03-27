"use server";

export async function fetchSerperResults(query: string, category: string = "search") {
  if (!query) return null;

  // Serper has specific endpoints for different categories
  const endpoint = `https://google.serper.dev/${category}`;

  const myHeaders = new Headers();
  myHeaders.append("X-API-KEY", process.env.SERPER_API_KEY as string);
  myHeaders.append("Content-Type", "application/json");

  const raw = JSON.stringify({
    q: query,
    num: 10 // Number of results to return
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow" as RequestRedirect,
  };

  try {
    const response = await fetch(endpoint, requestOptions);
    if (!response.ok) throw new Error("Failed to fetch data from Serper");
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Serper API Error:", error);
    return null;
  }
}