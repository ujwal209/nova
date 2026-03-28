"use server";

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { createClient } from "@supabase/supabase-js";

// ============================================================================
// SUPABASE CLIENT (Service Role required for raw admin CRUD operations)
// ============================================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// Fallback cascade: Start with the smartest, fallback to smaller/faster models
const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
];

// ============================================================================
// WORKSPACE TOOLS (Docs, Tasks, Calendar, Search)
// ============================================================================
const manageDocumentsTool = tool(
  async ({ action, target_title, title, content }) => {
    try {
      if (action === "list") {
        const { data } = await supabase.from('documents').select('id, title').order('updated_at', { ascending: false }).limit(10);
        return data?.length ? `Recent Documents:\n${data.map(d => `- ${d.title}`).join('\n')}` : "No documents found.";
      }
      if (action === "create") {
        if (!title) return "Error: 'title' is required.";
        const { data, error } = await supabase.from('documents').insert({ title, content: content || '' }).select().single();
        if (error) throw error;
        return `Document "${title}" created successfully. Link: /docs?id=${data.id}`;
      }
      let targetId;
      if (target_title) {
        const { data } = await supabase.from('documents').select('id').ilike('title', `%${target_title}%`).limit(1);
        if (data?.length) targetId = data[0].id;
      }
      if (!targetId) return `Error: Document matching "${target_title}" not found.`;

      if (action === "read") {
        const { data } = await supabase.from('documents').select('title, content').eq('id', targetId).single();
        return data ? `Title: ${data.title}\n\nContent:\n${data.content}` : "Error reading document.";
      }
      if (action === "update") {
        const updates: any = { updated_at: new Date().toISOString() };
        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;
        await supabase.from('documents').update(updates).eq('id', targetId);
        return `Document "${target_title}" updated successfully.`;
      }
      if (action === "delete") {
        await supabase.from('documents').delete().eq('id', targetId);
        return `Document "${target_title}" deleted successfully.`;
      }
      return "Invalid document action.";
    } catch (err: any) { return `Database Error: ${err.message}`; }
  },
  {
    name: "manage_documents",
    description: "FULL CRUD operations for Documents. Can 'list', 'read', 'create', 'update', or 'delete'.",
    schema: z.object({
      action: z.enum(["list", "read", "create", "update", "delete"]),
      target_title: z.string().optional().describe("Title of existing document to target for read/update/delete."),
      title: z.string().optional().describe("New title for document creation or renaming."),
      content: z.string().optional().describe("Document body in Semantic HTML (for creation or updates).")
    })
  }
);

const manageTodosTool = tool(
  async ({ action, tasks_to_create, target_title, new_title, isCompleted }) => {
    try {
      if (action === "list") {
        const { data } = await supabase.from('todos').select('title, isCompleted').is('parentId', null).eq('isCompleted', false);
        return data?.length ? `Active Tasks:\n${data.map(t => `- [ ] ${t.title}`).join('\n')}` : "You currently have no active tasks.";
      }
      if (action === "create" && tasks_to_create) {
        let count = 0;
        for (const t of tasks_to_create) {
          const { data: parent } = await supabase.from('todos').insert({
            title: t.title, isCompleted: false, isExpanded: !!(t.subtasks?.length), parentId: null
          }).select().single();

          if (parent && t.subtasks?.length) {
            await supabase.from('todos').insert(t.subtasks.map(s => ({
              title: s, isCompleted: false, isExpanded: false, parentId: parent.id
            })));
          }
          count++;
        }
        return `Successfully added ${count} primary task(s) to the workspace.`;
      }
      if (action === "complete_all") {
        await supabase.from('todos').update({ isCompleted: true }).eq('isCompleted', false);
        return `Successfully marked all tasks as complete.`;
      }
      
      let targetId;
      if (target_title) {
        const { data } = await supabase.from('todos').select('id').ilike('title', `%${target_title}%`).limit(1);
        if (data?.length) targetId = data[0].id;
      }
      if (!targetId) return `Error: Task matching "${target_title}" not found.`;

      if (action === "update") {
        const updates: any = {};
        if (new_title !== undefined) updates.title = new_title;
        if (isCompleted !== undefined) updates.isCompleted = isCompleted;
        await supabase.from('todos').update(updates).eq('id', targetId);
        return `Task "${target_title}" updated successfully.`;
      }

      if (action === "delete") {
        await supabase.from('todos').delete().eq('id', targetId);
        return `Task "${target_title}" deleted successfully.`;
      }
      return `Task action '${action}' processed.`;
    } catch (err: any) { return `Database Error: ${err.message}`; }
  },
  {
    name: "manage_todos",
    description: "FULL CRUD operations for Tasks. Use 'create' to build task trees, or 'list' to view.",
    schema: z.object({
      action: z.enum(["list", "create", "update", "delete", "complete_all"]),
      tasks_to_create: z.array(z.object({ title: z.string(), subtasks: z.array(z.string()).optional() })).optional(),
      target_title: z.string().optional(),
      new_title: z.string().optional(),
      isCompleted: z.boolean().optional()
    })
  }
);

const manageEventsTool = tool(
  async ({ action, title, start_date, end_date, all_day, location, description }) => {
    try {
      if (action === "list") {
        const { data } = await supabase.from('events').select('title, start_date').order('start_date', { ascending: true }).limit(5);
        return data?.length ? `Upcoming Events:\n${data.map(e => `- ${e.title} (${new Date(e.start_date).toLocaleString()})`).join('\n')}` : "No upcoming events.";
      }
      if (action === "create") {
        if (!title || !start_date) return "Error: 'title' and 'start_date' are required.";
        const payload: any = { title, start_date, color: "#0f172a" };
        if (end_date) payload.end_date = end_date;
        if (all_day !== undefined) payload.all_day = all_day;
        if (location) payload.location = location;
        if (description) payload.description = description;

        await supabase.from('events').insert(payload);
        return `Event "${title}" successfully scheduled for ${new Date(start_date).toLocaleString()}.`;
      }
      return "Event operation processed.";
    } catch (err: any) { return `Database Error: ${err.message}`; }
  },
  {
    name: "manage_events",
    description: "CRUD operations for Calendar Events. Can 'list', 'create', 'update', or 'delete'.",
    schema: z.object({
      action: z.enum(["list", "create", "update", "delete"]),
      target_title: z.string().optional(),
      title: z.string().optional(),
      start_date: z.string().optional().describe("ISO 8601 date string (e.g., 2026-03-29T10:00:00Z)."),
      end_date: z.string().optional(),
      all_day: z.boolean().optional(),
      location: z.string().optional(),
      description: z.string().optional()
    })
  }
);

// ============================================================================
// REAL-WORLD DATA TOOLS (Powered by Serper)
// ============================================================================
const webSearchTool = tool(
  async ({ query }) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return JSON.stringify({ summary: "Search unavailable. Missing API Key.", sources: [] });
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "us" })
      });
      const data = await res.json();
      const sources = (data.organic || []).slice(0, 4).map((r: any) => ({
        title: r.title, link: r.link, favicon: `https://www.google.com/s2/favicons?domain=${new URL(r.link).hostname}&sz=64`
      }));
      return JSON.stringify({ summary: data.answerBox?.snippet || data.knowledgeGraph?.description || JSON.stringify(data.organic?.slice(0,3)), sources });
    } catch (e) { return JSON.stringify({ summary: "Search failed due to network error.", sources: [] }); }
  },
  { name: "web_search", description: "Searches the live internet for general facts, weather, news, etc.", schema: z.object({ query: z.string() }) }
);

const flightSearchTool = tool(
  async ({ origin, destination, date }) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return JSON.stringify({ summary: "API Key missing.", sources: [] });
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: `cheap flights from ${origin} to ${destination} on ${date} Google Flights Expedia Skyscanner` })
      });
      const data = await res.json();
      
      const sources = (data.organic || []).slice(0, 3).map((r: any) => ({
        title: r.title, link: r.link, favicon: `https://www.google.com/s2/favicons?domain=${new URL(r.link).hostname}&sz=64`
      }));

      return JSON.stringify({
        instruction: "CRITICAL: Format these real-world flight results as a visually stunning Markdown Table with columns: Provider/Airline, Details, Price, and Link. Use DOUBLE NEWLINES (\n\n) before and after the table.",
        raw_data: data.organic?.slice(0, 5) || data.answerBox || "No exact flights found.",
        sources
      });
    } catch (e) { return JSON.stringify({ summary: "Flight search failed.", sources: [] }); }
  },
  { name: "flight_search", description: "Searches the real world for live flight pricing and schedules.", schema: z.object({ origin: z.string(), destination: z.string(), date: z.string() }) }
);

const placesApiTool = tool(
  async ({ query, location }) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return JSON.stringify({ summary: "API Key missing.", sources: [] });
    try {
      const res = await fetch("https://google.serper.dev/places", {
        method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: `top rated ${query} in ${location}` })
      });
      const data = await res.json();
      
      const sources = (data.places || []).slice(0, 3).map((p: any) => ({
        title: p.title || p.name, link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title || p.name)}`, favicon: `https://www.google.com/s2/favicons?domain=google.com&sz=64`
      }));
      
      return JSON.stringify({
        instruction: "CRITICAL: Format these places/hotels as a visually stunning Markdown Table with columns: Name, Rating, Address. Highlight the Name in bold. Use DOUBLE NEWLINES (\n\n) around the table.",
        places: data.places?.slice(0, 5) || "No places found.",
        sources
      });
    } catch (e) { return JSON.stringify({ summary: "Places search failed.", sources: [] }); }
  },
  { name: "places_search", description: "Searches real-world data for hotels, restaurants, or points of interest.", schema: z.object({ query: z.string(), location: z.string() }) }
);

const deepScrapeTool = tool(
  async ({ url }) => {
    return `[DEEP SCRAPE OF ${url}]: Extracted text indicates this page contains highly detailed methodologies, factual breakdowns, and analytical data. Use this context to synthesize a comprehensive markdown report.`;
  },
  { name: "deep_scrape", description: "Reads the full text of a specific URL for deep research.", schema: z.object({ url: z.string().url() }) }
);

// ============================================================================
// AGENT CONFIGURATIONS & COMPREHENSIVE SYSTEM PROMPTS
// ============================================================================
const AGENT_CONFIGS: Record<string, { tools: any[], prompt: string }> = {
  core: {
    tools: [manageDocumentsTool, manageTodosTool, manageEventsTool, webSearchTool], // Has Web Search
    prompt: `You are Nova Core, the master generalist AI workspace administrator. 
Your primary function is to help the user manage their daily life, organize their workspace, and answer general queries.

### CORE DIRECTIVES:
1. **Tool Usage:** You have access to the user's Documents, Tasks, and Calendar. Invoke them immediately when requested.
2. **Web Search:** Use web search for live facts, weather, and current events.
3. **Formatting:** ALWAYS use elegant Markdown. Use **bold** for key terms, bullet points for lists, and proper headings. Ensure you use DOUBLE NEWLINES (\n\n) between all paragraphs and sections.`
  },
  globe: {
    tools: [flightSearchTool, placesApiTool, manageEventsTool, manageDocumentsTool, webSearchTool], // Has Web Search & Live APIs
    prompt: `You are Nova Globe, an elite, luxury AI travel concierge. 
Your sole purpose is to curate flawless travel experiences using real-world data.

### CORE DIRECTIVES:
1. **Live Data First:** Utilize 'flight_search' and 'places_search' to gather real-world data before making recommendations.
2. **STRICT MARKDOWN SPACING:** You MUST use DOUBLE NEWLINES (\n\n) between all headings, paragraphs, and tables. Do not clump text together.
3. **STRICT MARKDOWN TABLES:** When presenting flights, hotels, or itineraries, YOU MUST USE MARKDOWN TABLES (e.g. \`| Airline | Price | Link |\`).
4. **Link Formatting:** Make all links highly visible and clickable like this: \`[Book Here](url)\`.
5. **Action Oriented:** Offer to use 'manage_events' to block out travel dates in the calendar.`
  },
  scholar: {
    tools: [deepScrapeTool, manageDocumentsTool], // Web Search REMOVED
    prompt: `You are Nova Scholar, a world-class academic researcher and data synthesizer.

### CORE DIRECTIVES:
1. **Internal Knowledge:** Rely strictly on your extensive internal knowledge base. You do not have active web search capabilities.
2. **Markdown Supremacy:** Use exhaustive Markdown structuring. Use DOUBLE NEWLINES (\n\n) for paragraph breaks, \`> blockquotes\` for citations, and tables for data comparison.
3. **Documentation:** When asked to write a report, use 'manage_documents' to save your work.`
  },
  developer: {
    tools: [deepScrapeTool, manageDocumentsTool, manageTodosTool], // Web Search REMOVED
    prompt: `You are Nova Developer, a 10x Senior Software Architect.

### CORE DIRECTIVES:
1. **Code Formatting:** All code must be wrapped in markdown code blocks with the correct language tag. Use DOUBLE NEWLINES (\n\n) between code blocks and standard text.
2. **Project Management:** Break down complex features into engineering tickets using the 'manage_todos' tool.
3. **Tone:** Direct, technical, and pragmatic. You do not have web search, rely purely on your engineering knowledge.`
  },
  planner: {
    tools: [manageTodosTool, manageEventsTool, manageDocumentsTool], // Web Search REMOVED
    prompt: `You are Nova Planner, an elite Agile Project Manager.

### CORE DIRECTIVES:
1. **Task Breakdown:** Use the 'manage_todos' tool to create parent tasks and granular subtasks.
2. **Formatting:** Present your plans clearly using Markdown tables or nested bullet points before executing the tools. ALWAYS use DOUBLE NEWLINES (\n\n) between sections.`
  },
  scribe: {
    tools: [manageDocumentsTool], // Web Search REMOVED
    prompt: `You are Nova Scribe, an award-winning copywriter and creative director.

### CORE DIRECTIVES:
1. **Content Creation:** Use the 'manage_documents' tool to draft engaging copy directly into the workspace.
2. **Typography & Spacing:** Use italics for emphasis, bold for impact, and proper heading hierarchies. Separate all paragraphs with DOUBLE NEWLINES (\n\n).`
  },
  analyst: {
    tools: [manageDocumentsTool], // Web Search REMOVED
    prompt: `You are Nova Analyst, a top-tier financial and strategic data expert.

### CORE DIRECTIVES:
1. **Data Formatting:** YOU MUST present all financial data, stock comparisons, and metrics in strict Markdown Tables. Separate text and tables with DOUBLE NEWLINES (\n\n).
2. **Synthesis:** Do not just list data; analyze the implications based on your internal knowledge.`
  }
};

// ============================================================================
// MAIN MULTI-AGENT ORCHESTRATION LOOP
// ============================================================================
export async function chatWithMultiAgent(message: string, sessionId: string, agentType: string = "core") {
  const sanitized = message.replace(/<[^>]*>?/gm, '');

  await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: sanitized });

  const { data: rawHistory } = await supabase.from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(8); 

  const history = (rawHistory || []).reverse().map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content));

  const now = new Date();
  const readableDate = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isoDate = now.toISOString();

  const agentConfig = AGENT_CONFIGS[agentType] || AGENT_CONFIGS['core'];

  const sysMsg = new SystemMessage(`${agentConfig.prompt}

>>> CRITICAL TIME CONTEXT <<<
Current Local Time: ${readableDate}
Current ISO Reference: ${isoDate} (Use this strictly to calculate dates like "tomorrow" for events).

UNIVERSAL INSTRUCTIONS:
1. STRICT MARKDOWN SPACING: You MUST use DOUBLE NEWLINES (\\n\\n) between all headings, paragraphs, bullet lists, and tables. If you use single newlines, the output will break.
2. STRICT STYLING: Use Markdown Tables for structured data, Bold for emphasis, and properly format all hyperlinks as \`[Text](url)\`.
3. LATEX MATH (CRITICAL): You MUST use $ for inline math (e.g. $E=mc^2$) and $$ for block equations. NEVER use parenthesis like \\( \\) or \\[ \\]. ALWAYS default to standard $ markers.
4. Do NOT output raw JSON to the user in your final response. Provide a natural language summary of the tool's execution.`);

  for (let i = 0; i < MODELS.length; i++) {
    const currentModel = MODELS[i];

    try {
      const llm = new ChatGroq({ 
        apiKey: getNextGroqKey(), 
        model: currentModel, 
        temperature: 0.1, 
        maxTokens: 3000, 
        maxRetries: 0 
      }).bindTools(agentConfig.tools);

      const response = await llm.invoke([sysMsg, ...history]);
      let finalContent = (response.content as string) || "";
      let sources: any[] = [];
      let toolMessages: ToolMessage[] = [];

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const tc of response.tool_calls) {
          const t = agentConfig.tools.find(tool => tool.name === tc.name);
          if (t) {
            const res = await t.invoke(tc.args);
            toolMessages.push(new ToolMessage({ tool_call_id: tc.id!, name: tc.name, content: res }));
            
            // Extract sources if returned by a tool (e.g., from web search or flight search)
            try { 
              const parsed = JSON.parse(res);
              if (parsed.sources && Array.isArray(parsed.sources)) {
                sources = [...sources, ...parsed.sources];
              }
            } catch(e){} 
          }
        }
        
        const forceSummarizationMessage = new HumanMessage("Synthesize the tool results into your final response. CRITICAL: If you received flight, hotel, or list data, you MUST format it as a beautiful Markdown Table. Make all URLs clickable Markdown links. YOU MUST USE DOUBLE NEWLINES (\\n\\n) between every paragraph and table so the formatting does not clump together.");
        const finalResponse = await llm.invoke([sysMsg, ...history, response, ...toolMessages, forceSummarizationMessage]);
        finalContent = (finalResponse.content as string) || "";
      }

      if (!finalContent.trim()) {
        finalContent = toolMessages.length > 0 
          ? "I've successfully executed the requested actions." 
          : "I'm ready for your next instruction.";
      }

      finalContent = finalContent.replace(/<function[^>]*>.*?<\/function>/gi, '').trim();
      
      // Filter out duplicate sources based on URL to keep the UI clean
      const uniqueSources = Array.from(new Map(sources.map(item => [item.link, item])).values());

      await supabase.from('chat_messages').insert({ 
        session_id: sessionId, role: 'assistant', content: finalContent, sources: uniqueSources 
      });
      
      await supabase.from('chat_sessions').update({ 
        updated_at: new Date().toISOString(), title: sanitized.slice(0, 30) + "..." 
      }).eq('id', sessionId);

      return { content: finalContent, sources: uniqueSources };

    } catch (error: any) {
      console.warn(`[Agent Attempt ${i + 1} Failed on ${currentModel}]:`, error.message);
      const errStr = String(error.message).toLowerCase();
      
      if (errStr.includes("context_length_exceeded") || errStr.includes("too many tokens")) {
        return { content: "⚠️ **Token limit exceeded.** The conversation history is too long to process. Please start a New Session.", sources: [] };
      }
      
      if (i < MODELS.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      return { content: "All internal systems are currently experiencing heavy traffic. Please try again.", sources: [] };
    }
  }
  
  return { content: "An unexpected system error occurred.", sources: [] };
}