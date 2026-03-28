"use server";

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

const rawGroqKeys = process.env.GROQ_API_KEY || "";
const groqApiKeys = rawGroqKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
let currentKeyIndex = 0;

function getNextGroqKey(): string {
  if (groqApiKeys.length === 0) return "";
  const key = groqApiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % groqApiKeys.length;
  return key;
}

const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it"
];

const modifyCalendarTool = tool(
  async ({ action, events }) => {
    return `Action '${action}' successfully generated and staged for the client calendar UI.`;
  },
  {
    name: "modify_calendar",
    description: "Modifies the user's calendar. Use this whenever the user asks to schedule, delete, move, or update an event.",
    schema: z.object({ 
      action: z.enum(["add_events", "delete_events", "update_events"]).describe("The calendar operation to perform."),
      events: z.array(z.object({
        id: z.string().optional().describe("Required ONLY for update_events or delete_events. The exact ID of the existing event."),
        title: z.string().optional().describe("The title of the event."),
        start_date: z.string().optional().describe("Start date/time in strict ISO 8601 format (e.g. '2026-03-28T10:00:00')."),
        end_date: z.string().optional().describe("End date/time in strict ISO 8601 format."),
        all_day: z.boolean().optional().describe("Set to true if the event has no specific time or lasts the whole day."),
        location: z.string().optional(),
        description: z.string().optional()
      })).describe("The array of events to process.")
    })
  }
);

const tools = [modifyCalendarTool];

export async function chatWithCalendarAgent(message: string, currentEventsJson: string, chatHistory: {role: string, content: string}[]) {
  const sanitized = message.replace(/<[^>]*>?/gm, '');
  const history = chatHistory.map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content));

  const now = new Date();
  const readableDate = now.toLocaleString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short' 
  });

  const sysMsg = new SystemMessage(`You are Nova, an elite AI Calendar Assistant. 
The user is managing their schedule. 

>>> CRITICAL TIME CONTEXT <<<
Today's Date & Time: ${readableDate}
Current ISO Timestamp: ${now.toISOString()}
Always calculate "tomorrow", "next week", etc., relative to EXACTLY this time.

CURRENT CALENDAR EVENTS (JSON):
"""
${currentEventsJson.substring(0, 15000)}
"""

CRITICAL DIRECTIVES:
1. CONVERSATION & FORMATTING: Answer questions about their schedule conversationally. WHEN LISTING EVENTS, NEVER output raw ISO 8601 strings. You MUST format dates naturally, e.g., "Friday, March 27th at 10:00 AM". Use Markdown lists for readability.
2. SCHEDULING: If asked to add, delete, or modify an event, you MUST use the 'modify_calendar' tool.
3. DATES FOR TOOLS: When calling the tool, pass valid ISO 8601 strings to the tool arguments based on the CRITICAL TIME CONTEXT above.`);

  for (let i = 0; i < MODELS.length; i++) {
    const currentModel = MODELS[i];
    
    try {
      const llm = new ChatGroq({ 
        apiKey: getNextGroqKey(), 
        model: currentModel, 
        temperature: 0.1,
        maxTokens: 2048,
        maxRetries: 0 
      }).bindTools(tools);

      const response = await llm.invoke([sysMsg, ...history, new HumanMessage(sanitized)]);
      let finalContent = (response.content as string) || "";
      let toolAction: any = null;
      let toolMessages: ToolMessage[] = [];

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const tc of response.tool_calls) {
          const t = tools.find(tool => tool.name === tc.name);
          if (t) {
            const res = await t.invoke(tc.args);
            toolMessages.push(new ToolMessage({ tool_call_id: tc.id!, name: tc.name, content: res }));
            if (tc.name === "modify_calendar") {
              toolAction = tc.args;
            }
          }
        }
        
        const followUp = new HumanMessage("Please provide a brief, professional conversational response confirming the calendar changes you made. Do not output JSON. Remember to format any dates naturally (e.g. Monday, March 28th).");
        const finalResponse = await llm.invoke([sysMsg, ...history, new HumanMessage(sanitized), response, ...toolMessages, followUp]);
        finalContent = (finalResponse.content as string) || "";
      }

      if (!finalContent.trim()) {
        finalContent = toolAction ? `I have successfully staged the '${toolAction.action}' action for your calendar.` : "I've processed your request.";
      }

      finalContent = finalContent.replace(/<function[^>]*>.*?<\/function>/gi, '').trim();

      return { content: finalContent, toolAction };

    } catch (error: any) {
      const errStr = String(error.message).toLowerCase();
      if (errStr.includes("context_length_exceeded") || errStr.includes("too many tokens")) {
        return { content: "⚠️ **Token limit exceeded.** Your calendar has too many events for my current context window.", toolAction: null };
      }
      if (i < MODELS.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return { content: "All AI models are currently overwhelmed or rate-limited. Please try again in a few seconds.", toolAction: null };
    }
  }
  return { content: "An unexpected system error occurred. Please try again.", toolAction: null };
}