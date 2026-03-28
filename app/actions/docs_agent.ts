"use server";

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

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

// The Requested Model Rotation Array
const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
];

// ============================================================================
// DOCUMENT WRITER TOOL (GOD MODE: Page-Level Control)
// ============================================================================
const modifyDocumentTool = tool(
  async ({ action, page_index, html_content, pages_array }) => {
    // The actual insertion happens on the client side. This just acknowledges the action to the LLM.
    return `Content action '${action}' successfully generated and staged for the client.`;
  },
  {
    name: "modify_document",
    description: "Modifies the user's active multi-page document. Use this whenever the user asks you to write, clear, add a page, or rewrite the document.",
    schema: z.object({ 
      action: z.enum(["update_page", "add_page", "delete_page", "replace_all"]).describe("Choose 'update_page' to edit an existing page, 'add_page' to append a new page, 'delete_page' to remove a page, or 'replace_all' to overwrite the entire document with a new array of pages."),
      page_index: z.number().optional().describe("The index of the page to update or delete (0-based). E.g., 0 for Page 1."),
      html_content: z.string().optional().describe("The generated content to insert, formatted in clean semantic HTML (e.g., <h2>, <p>, <ul>). Required for update_page or add_page."),
      pages_array: z.array(z.string()).optional().describe("An array of HTML strings representing the new pages. Required ONLY for replace_all.")
    })
  }
);

const tools = [modifyDocumentTool];

// ============================================================================
// MAIN AGENT ORCHESTRATION (WITH ROTATION LOOP)
// ============================================================================
export async function chatWithDocsAgent(message: string, currentContent: string, chatHistory: {role: string, content: string}[]) {
  const sanitized = message.replace(/<[^>]*>?/gm, '');

  const history = chatHistory.map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content));

  // Gatekeeper System Prompt loaded with the live document context
  const sysMsg = new SystemMessage(`You are Nova, an elite AI writing and editing assistant. 
The user is actively editing a document. The document supports MULTIPLE PAGES and is stored as a JSON array of HTML strings.

CURRENT DOCUMENT CONTENT (Array of Pages):
"""
${currentContent.substring(0, 20000)}
"""

CRITICAL DIRECTIVES:
1. CONVERSATION: Answer questions about the document, brainstorm, or provide feedback normally without using tools.
2. WRITING/EDITING: If the user explicitly asks you to WRITE, ADD A PAGE, REWRITE, REPLACE, or CLEAR the document, you MUST invoke the 'modify_document' tool.
3. PAGINATION CONTEXT: Note the array index structure above. If the user asks to edit "Page 2", you should use 'update_page' with page_index: 1.
4. FORMATTING: Your HTML output must be highly structured semantic HTML (use headings, lists, bolding).`);

  // Loop through the 4 requested models
  for (let i = 0; i < MODELS.length; i++) {
    const currentModel = MODELS[i];
    
    try {
      const llm = new ChatGroq({ 
        apiKey: getNextGroqKey(), 
        model: currentModel, 
        temperature: 0.3,
        maxTokens: 2048,
        maxRetries: 0 // We handle retries manually in this loop
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
            
            if (tc.name === "modify_document") {
              toolAction = tc.args;
            }
          }
        }
        
        const forceSummarizationMessage = new HumanMessage("Please provide a brief conversational response acknowledging the content modification you just made to the document. Do not output JSON.");
        const finalResponse = await llm.invoke([sysMsg, ...history, new HumanMessage(sanitized), response, ...toolMessages, forceSummarizationMessage]);
        finalContent = (finalResponse.content as string) || "";
      }

      if (!finalContent.trim()) {
        finalContent = toolAction ? `I have successfully applied the '${toolAction.action}' action to your document.` : "I've processed your request.";
      }

      finalContent = finalContent.replace(/<function[^>]*>.*?<\/function>/gi, '').trim();

      return { content: finalContent, toolAction };

    } catch (error: any) {
      console.warn(`[Docs Agent Failed on ${currentModel}]:`, error.message);
      const errStr = String(error.message).toLowerCase();
      
      // HARD FAIL: Document physically too large. Stop trying.
      if (errStr.includes("context_length_exceeded") || errStr.includes("too many tokens") || errStr.includes("maximum context length")) {
        return { 
          content: "⚠️ **Token limit exceeded.** The document and chat history are too large to process. Please delete some pages or start a New Chat.", 
          toolAction: null 
        };
      }

      // SOFT FAIL: Rate limit hit. Rotate to the next model in the array.
      if (i < MODELS.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      return { 
        content: "All AI models are currently overwhelmed or rate-limited. Please try again in a few seconds.", 
        toolAction: null 
      };
    }
  }
  
  return { content: "An unexpected system error occurred. Please try again.", toolAction: null };
}