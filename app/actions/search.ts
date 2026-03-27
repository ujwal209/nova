"use server";

export async function fetchSerperResults(query: string, category: string = "search", page: number = 1) {
  if (!query) return null;

  const endpoint = `https://google.serper.dev/${category}`;

  const myHeaders = new Headers();
  myHeaders.append("X-API-KEY", process.env.SERPER_API_KEY as string);
  myHeaders.append("Content-Type", "application/json");

  const raw = JSON.stringify({
    q: query,
    page: page, // Send the page number to Serper
    num: 10 
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow" as RequestRedirect,
  };

  try {
    const response = await fetch(endpoint, requestOptions);
    if (!response.ok) throw new Error(`Failed to fetch data from Serper`);
    return await response.json();
  } catch (error) {
    console.error("Serper API Error:", error);
    return null;
  }
}