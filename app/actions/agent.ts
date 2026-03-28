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

// The Ultimate Fallback Array (Text Models Only)
const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
];

// ============================================================================
// TOOL 1: MANAGE DOCUMENTS (FULL CRUD)
// ============================================================================
const manageDocumentsTool = tool(
  async ({ action, target_title, title, content }) => {
    try {
      if (action === "list") {
        const { data } = await supabase.from('documents').select('id, title').order('updated_at', { ascending: false }).limit(10);
        return data?.length ? `Recent Documents:\n${data.map(d => `- ${d.title}`).join('\n')}` : "No documents found.";
      }
      
      if (action === "create") {
        if (!title) return "Error: 'title' is required to create a document.";
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
    description: "FULL CRUD operations for Documents. Can 'list', 'read', 'create', 'update', or 'delete' documents.",
    schema: z.object({
      action: z.enum(["list", "read", "create", "update", "delete"]),
      target_title: z.string().optional().describe("Title of existing document to target for read/update/delete."),
      title: z.string().optional().describe("New title for document creation or renaming."),
      content: z.string().optional().describe("Document body in Semantic HTML (for creation or updates).")
    })
  }
);

// ============================================================================
// TOOL 2: MANAGE TODOS (FULL CRUD + BULK ACTIONS)
// ============================================================================
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
        return `Successfully added ${count} task(s).`;
      }

      if (action === "complete_all") {
        const { data, error } = await supabase.from('todos').update({ isCompleted: true }).eq('isCompleted', false).select('id');
        if (error) throw error;
        return `Successfully marked all ${data?.length || 0} active tasks as complete.`;
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

      return "Invalid task action.";
    } catch (err: any) { return `Database Error: ${err.message}`; }
  },
  {
    name: "manage_todos",
    description: "FULL CRUD operations for Tasks. Use 'complete_all' to mark everything done at once to save time.",
    schema: z.object({
      action: z.enum(["list", "create", "update", "delete", "complete_all"]),
      tasks_to_create: z.array(z.object({ title: z.string(), subtasks: z.array(z.string()).optional() })).optional(),
      target_title: z.string().optional().describe("Title of the specific task to update or delete."),
      new_title: z.string().optional().describe("Rename task title."),
      isCompleted: z.boolean().optional().describe("Set to true to complete a specific task, false to un-complete.")
    })
  }
);

// ============================================================================
// TOOL 3: MANAGE EVENTS (FULL CALENDAR CRUD)
// ============================================================================
const manageEventsTool = tool(
  async ({ action, target_title, title, start_date, end_date, all_day, location, description }) => {
    try {
      if (action === "list") {
        const { data } = await supabase.from('events').select('title, start_date').order('start_date', { ascending: true }).limit(5);
        return data?.length ? `Upcoming Events:\n${data.map(e => `- ${e.title} (${new Date(e.start_date).toLocaleString()})`).join('\n')}` : "No upcoming events found.";
      }
      
      if (action === "create") {
        if (!title || !start_date) return "Error: 'title' and 'start_date' are absolutely required to create an event.";
        
        const payload: any = { title, start_date };
        if (end_date) payload.end_date = end_date;
        if (all_day !== undefined) payload.all_day = all_day;
        if (location) payload.location = location;
        if (description) payload.description = description;

        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
        return `Event "${title}" successfully scheduled for ${new Date(start_date).toLocaleString()}.`;
      }

      let targetId;
      if (target_title) {
        const { data } = await supabase.from('events').select('id').ilike('title', `%${target_title}%`).limit(1);
        if (data?.length) targetId = data[0].id;
      }
      if (!targetId) return `Error: Event matching "${target_title}" not found in database.`;

      if (action === "update") {
        const updates: any = {};
        if (title !== undefined) updates.title = title;
        if (start_date !== undefined) updates.start_date = start_date;
        if (end_date !== undefined) updates.end_date = end_date;
        if (all_day !== undefined) updates.all_day = all_day;
        if (location !== undefined) updates.location = location;
        if (description !== undefined) updates.description = description;
        await supabase.from('events').update(updates).eq('id', targetId);
        return `Event "${target_title}" updated successfully.`;
      }

      if (action === "delete") {
        await supabase.from('events').delete().eq('id', targetId);
        return `Event "${target_title}" deleted successfully.`;
      }

      return "Invalid event action.";
    } catch (err: any) { return `Database Error: ${err.message}`; }
  },
  {
    name: "manage_events",
    description: "FULL CRUD operations for Calendar Events. Can 'list', 'create', 'update', or 'delete'.",
    schema: z.object({
      action: z.enum(["list", "create", "update", "delete"]),
      target_title: z.string().optional().describe("Title of event to update or delete."),
      title: z.string().optional().describe("Event title for creation or rename."),
      start_date: z.string().optional().describe("CRITICAL: Must be a valid ISO 8601 date string (e.g., 2026-03-29T10:00:00Z)."),
      end_date: z.string().optional().describe("ISO 8601 date string."),
      all_day: z.boolean().optional(),
      location: z.string().optional(),
      description: z.string().optional()
    })
  }
);

// ============================================================================
// TOOL 4: BULLETPROOF WEB SEARCH (SERPER)
// ============================================================================
const webSearchTool = tool(
  async ({ query }) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return JSON.stringify({ summary: "Search unavailable. Missing API Key.", sources: [] });

    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "in" })
      });
      const data = await res.json();
      
      const sources = (data.organic || []).slice(0, 4).map((r: any) => ({
        title: r.title, 
        link: r.link, 
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(r.link).hostname}&sz=64`
      }));
      
      return JSON.stringify({ 
        summary: data.answerBox?.snippet || data.knowledgeGraph?.description || "Top results gathered.", 
        sources 
      });
    } catch (e) { return JSON.stringify({ summary: "Search failed due to network error.", sources: [] }); }
  },
  { name: "web_search", description: "Searches the live internet. Use this for flights, weather, news, or fact-checking.", schema: z.object({ query: z.string() }) }
);

// --- TOOLS BUNDLE ---
const tools = [manageDocumentsTool, manageTodosTool, manageEventsTool, webSearchTool];

// ============================================================================
// MAIN AGENT ORCHESTRATION LOOP (WITH FALLBACK ROTATION)
// ============================================================================
export async function chatWithAgent(message: string, sessionId: string) {
  const sanitized = message.replace(/<[^>]*>?/gm, '');

  await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: sanitized });

  const { data: rawHistory } = await supabase.from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(8); // Grab enough history for context

  const history = (rawHistory || []).reverse().map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content));

  const now = new Date();
  const readableDate = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isoDate = now.toISOString();

  const sysMsg = new SystemMessage(`You are Nova, an elite AI workspace administrator. 
Current Local Time: ${readableDate}
Current ISO Reference: ${isoDate} (Use this strictly to calculate dates like "tomorrow" for calendar events).

CRITICAL DIRECTIVES:
1. NORMAL CONVERSATION: If the user says "hello", asks a general question, or makes a statement that doesn't require action, simply reply conversationally using your internal knowledge. DO NOT invoke tools for casual chat.
2. TOOL USAGE: ONLY use tools if the user EXPLICITLY asks to:
   - Create, read, update, delete, or complete Tasks/Todos.
   - Create, read, update, or delete Calendar Events (USE 'manage_events').
   - Create, read, update, or delete Documents.
   - Search the web for live facts, current events, or links.
3. ALWAYS provide a detailed, markdown-formatted natural language response.
4. DO NOT output raw JSON in the final response.`);

  // Iterate through the model array to ensure bulletproof execution
  for (let i = 0; i < MODELS.length; i++) {
    const currentModel = MODELS[i];

    try {
      const llm = new ChatGroq({ 
        apiKey: getNextGroqKey(), 
        model: currentModel, 
        temperature: 0.2, 
        maxTokens: 2048,
        maxRetries: 0 // Handled by our loop
      }).bindTools(tools);

      const response = await llm.invoke([sysMsg, ...history]);
      let finalContent = (response.content as string) || "";
      let sources: any[] = [];
      let toolMessages: ToolMessage[] = [];

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const tc of response.tool_calls) {
          const t = tools.find(tool => tool.name === tc.name);
          if (t) {
            // Safely execute tool so it won't crash the server
            const res = await t.invoke(tc.args);
            toolMessages.push(new ToolMessage({ tool_call_id: tc.id!, name: tc.name, content: res }));
            
            if (tc.name === "web_search") {
              try { sources = JSON.parse(res).sources; } catch(e){}
            }
          }
        }
        
        const forceSummarizationMessage = new HumanMessage("Please summarize the tool results above in a natural, conversational response to the user. Do not output JSON.");
        const finalResponse = await llm.invoke([sysMsg, ...history, response, ...toolMessages, forceSummarizationMessage]);
        finalContent = (finalResponse.content as string) || "";
      }

      if (!finalContent.trim()) {
        if (toolMessages.length > 0) {
          finalContent = toolMessages.map(t => t.content).join('\n\n');
        } else {
          finalContent = "I've successfully processed your request. Is there anything else you need?";
        }
      }

      finalContent = finalContent.replace(/<function[^>]*>.*?<\/function>/gi, '').trim();
      
      await supabase.from('chat_messages').insert({ 
        session_id: sessionId, role: 'assistant', content: finalContent, sources 
      });

      await supabase.from('chat_sessions').update({ 
        updated_at: new Date().toISOString(), title: sanitized.slice(0, 30) + "..."
      }).eq('id', sessionId);

      return { content: finalContent, sources };

    } catch (error: any) {
      console.warn(`[Agent Attempt ${i + 1} Failed on ${currentModel}]:`, error.message);
      
      const errStr = String(error.message).toLowerCase();
      
      // Explicit Token / Context Limit Failsafe
      if (errStr.includes("context_length_exceeded") || errStr.includes("too many tokens") || errStr.includes("maximum context length")) {
        return { 
          content: "⚠️ **Token limit exceeded.** The conversation history is too long for me to process. Please click **New Chat** to start a fresh session.", 
          sources: [] 
        };
      }

      // If we still have models left to try, continue the loop
      if (i < MODELS.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      // If we've exhausted all models
      return { 
        content: "All my systems are currently experiencing heavy traffic or rate limits. Please try again in a moment.", 
        sources: [] 
      };
    }
  }

  // Fallback return if loop unexpectedly exits
  return { content: "An unexpected system error occurred. Please try your request again.", sources: [] };
}