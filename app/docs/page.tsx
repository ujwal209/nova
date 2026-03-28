"use client";

import { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createDocument, getDocument, saveDocument, getDocuments, deleteDocument } from "../actions/docs";
import { chatWithDocsAgent } from "../actions/docs_agent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// --- REACT QUILL (PATCHED FOR REACT 19) ---
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

import { 
  FileText, Cloud, Loader2, Download, 
  FileJson, PanelLeftClose, PanelLeftOpen, Menu, Trash2, Plus, 
  Bot, Send, X, ChevronLeft, ChevronRight, LayoutPanelLeft, Sparkles, ArrowUp 
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- FAST TYPEWRITER COMPONENT ---
const TypewriterMarkdown = memo(({ content, isTyping, onComplete }: { content: string, isTyping: boolean, onComplete: () => void }) => {
  const [displayed, setDisplayed] = useState(isTyping ? "" : content);

  useEffect(() => {
    if (!isTyping) {
      setDisplayed(content);
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      i += 8; 
      if (i >= content.length) {
        setDisplayed(content);
        clearInterval(interval);
        onComplete();
      } else {
        setDisplayed(content.slice(0, i));
      }
    }, 10);
    return () => clearInterval(interval);
  }, [content, isTyping, onComplete]);

  return (
    <div className="markdown-prose text-zinc-800 text-[15px] leading-[1.8] font-medium">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayed}</ReactMarkdown>
    </div>
  );
});
TypewriterMarkdown.displayName = "TypewriterMarkdown";

export default function DocsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("id");

  // Multi-Page State
  const [title, setTitle] = useState("Untitled document");
  const [pages, setPages] = useState<string[]>([""]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Left Sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Right Sidebar (AI Chat)
  const [isChatOpen, setIsChatOpen] = useState(false); 
  const [chatWidth, setChatWidth] = useState(380); 
  const [isDragging, setIsDragging] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{id: string, role: string, content: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  
  // Menus
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const quillRef = useRef<any>(null);

  // Quill Toolbar Configuration
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, 4, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }, { 'indent': '-1'}, { 'indent': '+1' }],
      ['link', 'image', 'code-block'],
      ['clean']
    ],
  }), []);

  // --- AUTO-SAVE LOGIC ---
  const triggerAutoSave = useCallback((newTitle: string, newPagesArray: string[]) => {
    if (!docId) return;
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await saveDocument(docId, newTitle, JSON.stringify(newPagesArray));
        setSaveStatus(res?.success ? "saved" : "error");
      } catch (e) { setSaveStatus("error"); }
    }, 1200); 
  }, [docId]);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (window.innerWidth < 768) setIsSidebarCollapsed(true);

    async function init() {
      setIsInitializing(true);
      if (docId) {
        try {
          const doc = await getDocument(docId);
          if (doc) {
             setTitle(doc.title);
             let parsedPages = [""];
             if (doc.content) {
               try {
                 const parsed = JSON.parse(doc.content);
                 parsedPages = Array.isArray(parsed) ? parsed : [doc.content];
               } catch (e) {
                 parsedPages = [doc.content];
               }
             }
             setPages(parsedPages);
             setActivePageIndex(0);
          } else {
             router.push('/docs');
          }
        } catch (e) { 
          router.push('/docs'); 
        }
      } else {
        setTitle("Untitled document");
        setPages([""]);
        setActivePageIndex(0);
      }
      setIsInitializing(false);
    }
    init();
  }, [docId, router]);

  useEffect(() => {
    getDocuments().then(setDocuments);
  }, [docId, isSidebarCollapsed]);

  // SMART OUTSIDE CLICK HANDLER
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading, isChatOpen]);

  const handleContentChange = (newContent: string) => {
    const newPages = [...pages];
    newPages[activePageIndex] = newContent;
    setPages(newPages);
    triggerAutoSave(title, newPages);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    triggerAutoSave(val, pages);
  };

  // --- DOCUMENT ACTIONS ---
  const createNewDoc = async () => {
    const newDoc = await createDocument();
    router.push(`/docs?id=${newDoc.id}`);
  };

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDocuments(docs => docs.filter(d => d.id !== id));
    try { await deleteDocument(id); } catch(err) { console.error(err); }
    if (id === docId) router.push('/docs');
  };

  const handleAddPage = () => {
    const newPages = [...pages, ""];
    setPages(newPages);
    setActivePageIndex(newPages.length - 1);
    triggerAutoSave(title, newPages);
  };

  const handleDeletePage = () => {
    if (pages.length <= 1) return;
    
    const newPages = [...pages];
    newPages.splice(activePageIndex, 1); 
    
    const nextIndex = activePageIndex >= newPages.length ? newPages.length - 1 : activePageIndex;
    
    setPages(newPages);
    setActivePageIndex(nextIndex);
    triggerAutoSave(title, newPages);
  };

  // --- EXPORT ACTIONS ---
  const exportAsHTML = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const combinedHTML = pages.join("<hr style='page-break-after: always;' />");
    const blob = new Blob([combinedHTML], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title ? title.trim() : "Document"}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportAsText = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const combinedHTML = pages.join("\n\n---\n\n");
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = combinedHTML;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title ? title.trim() : "Document"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportAsPDF = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsExportingPDF(true);
    setShowExportMenu(false);

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Iframe generation failed");

      const printStyles = `
        <style>
          @page { size: letter; margin: 0.75in; }
          * { box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif !important; color: #000000 !important; background: #ffffff !important; line-height: 1.6 !important; margin: 0 !important; padding: 0 !important; }
          .page-container { page-break-after: always; }
          .page-container:last-child { page-break-after: auto; }
          h1 { font-size: 24pt; margin-bottom: 12pt; font-weight: bold; }
          h2 { font-size: 18pt; margin-top: 16pt; margin-bottom: 12pt; font-weight: bold; }
          p { margin-bottom: 12pt; font-size: 12pt; }
          ul, ol { margin-bottom: 12pt; padding-left: 24pt; font-size: 12pt; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
          th, td { border: 1pt solid #ccc; padding: 8pt; text-align: left; }
          img { max-width: 100%; height: auto; }
        </style>
      `;

      const pagesHTML = pages.map(p => `<div class="page-container">${p || '<p></p>'}</div>`).join('');

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html><html><head><title>${title || 'Document'}</title>${printStyles}</head><body>${pagesHTML}</body></html>`);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setIsExportingPDF(false);
        }, 1500);
      }, 1000);

    } catch (err) {
      setIsExportingPDF(false);
      alert("Failed to export PDF.");
    }
  };

  // --- CHAT AGENT ACTIONS ---
  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setIsChatLoading(true);
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: userMessage }]);

    try {
      const response = await chatWithDocsAgent(userMessage, JSON.stringify(pages), messages);
      const newMessageId = crypto.randomUUID();
      
      setMessages(prev => [...prev, { id: newMessageId, role: "assistant", content: response.content }]);
      setTypingMessageId(newMessageId);

      if (response.toolAction) {
        let newPages = [...pages];
        const action = response.toolAction.action;
        const targetIndex = response.toolAction.page_index ?? activePageIndex;

        if (action === "update_page") {
          if (newPages[targetIndex] !== undefined) {
            newPages[targetIndex] = response.toolAction.html_content || "";
            setActivePageIndex(targetIndex);
          }
        } else if (action === "add_page") {
          newPages.push(response.toolAction.html_content || "");
          setActivePageIndex(newPages.length - 1);
        } else if (action === "delete_page") {
          newPages.splice(targetIndex, 1);
          if (newPages.length === 0) newPages = [""];
          if (activePageIndex >= newPages.length) setActivePageIndex(newPages.length - 1);
        } else if (action === "replace_all") {
          newPages = response.toolAction.pages_array || [""];
          setActivePageIndex(0);
        }

        setPages(newPages);
        triggerAutoSave(title, newPages);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Error connecting to AI." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- DRAG RESIZER ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 280 && newWidth < 800) setChatWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  if (isInitializing) {
    return (
      <div className="h-[calc(100dvh-64px)] sm:h-[calc(100dvh-80px)] w-full flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-950 mb-4" />
        <p className="text-zinc-500 text-sm font-bold tracking-widest uppercase">Loading Workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-64px)] sm:h-[calc(100dvh-80px)] bg-zinc-50 transition-all overflow-hidden font-sans select-none text-zinc-900 selection:bg-zinc-200">
      
      {/* STRICT FONT ENFORCEMENT & HIGH-END MARKDOWN SCROLLBAR */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Outfit:wght@100..900&display=swap');
        * { font-family: 'Google Sans', 'Outfit', sans-serif !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d4d4d8; border-radius: 10px; }
        
        /* GORGEOUS MARKDOWN TYPOGRAPHY */
        .markdown-prose p { margin-bottom: 1em; }
        .markdown-prose strong { font-weight: 800; color: #0f172a; }
        .markdown-prose ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1.5em; }
        .markdown-prose li { margin-bottom: 0.5em; }
        
        /* STUNNING MARKDOWN LINKS */
        .markdown-prose a { 
          color: #2563eb; 
          text-decoration: none; 
          font-weight: 700; 
          border-bottom: 2px solid #bfdbfe; 
          transition: all 0.2s ease; 
        }
        .markdown-prose a:hover { 
          color: #1d4ed8; 
          border-bottom-color: #2563eb; 
          background-color: #eff6ff;
        }

        /* GORGEOUS MARKDOWN TABLES */
        .markdown-prose table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0;
          margin: 1.5em 0; 
          border: 1px solid #e2e8f0; 
          border-radius: 12px; 
          overflow: hidden; 
          display: block; 
          overflow-x: auto;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .markdown-prose th { 
          background-color: #f8fafc; 
          padding: 14px 20px; 
          text-align: left; 
          font-weight: 800; 
          border-bottom: 2px solid #e2e8f0; 
          color: #0f172a; 
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.05em;
        }
        .markdown-prose td { 
          padding: 14px 20px; 
          border-bottom: 1px solid #f1f5f9; 
          color: #334155; 
        }
        .markdown-prose tr:last-child td { border-bottom: none; }
        .markdown-prose tr:hover td { background-color: #f8fafc; }

        /* Code blocks */
        .markdown-prose pre { background-color: #0f172a; color: #f8fafc; padding: 1.25em; border-radius: 12px; overflow-x: auto; margin-bottom: 1.5em; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .markdown-prose code { font-family: monospace; background: #f1f5f9; padding: 3px 6px; border-radius: 6px; font-size: 0.9em; font-weight: 600; color: #0f172a; border: 1px solid #e2e8f0;}
        .markdown-prose pre code { background: transparent; padding: 0; border: none; color: inherit; }
        
        /* Quill Overrides */
        .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid #e4e4e7 !important;
          background-color: #ffffff;
          padding: 16px 20px !important;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .ql-container.ql-snow {
          border: none !important;
          font-family: inherit !important;
        }
        .ql-snow .ql-stroke { stroke: #52525b !important; }
        .ql-snow .ql-fill { fill: #52525b !important; }
        .ql-snow .ql-picker { color: #52525b !important; font-weight: 600 !important; }
        .ql-editor {
          min-height: 1056px !important; /* 11in */
          padding: 60px !important;
          font-size: 15px;
          line-height: 1.8;
          color: #09090b;
        }
        @media (min-width: 640px) {
          .ql-editor { padding: 96px 112px !important; }
        }
        .ql-editor h1 { font-size: 2.25em; font-weight: 900; margin-top: 1em; margin-bottom: 0.5em; letter-spacing: -0.02em; }
        .ql-editor h2 { font-size: 1.5em; font-weight: 800; margin-top: 1em; margin-bottom: 0.5em; letter-spacing: -0.01em; }
        .ql-editor h3 { font-size: 1.25em; font-weight: 700; margin-top: 1em; margin-bottom: 0.5em; }
        .ql-editor p { margin-bottom: 1em; font-weight: 500; }
        .ql-editor strong { font-weight: 800; }
        .ql-editor ul, .ql-editor ol { margin-bottom: 1em; }
        .ql-editor li { margin-bottom: 0.25em; }
      `}} />

      {/* PROFESSIONAL SIDEBAR */}
      <aside className={cn(
        "flex flex-col bg-zinc-50 border-r border-zinc-200 transition-all duration-300 absolute md:relative z-50 h-full shadow-2xl md:shadow-none",
        isSidebarCollapsed ? "-translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-none" : "translate-x-0 w-[240px]"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 h-14 sm:h-16 shrink-0 bg-white/50 backdrop-blur-md">
           <div className="flex items-center gap-2 text-zinc-950">
              <LayoutPanelLeft className="w-4 h-4" />
              <span className="font-bold text-[14px] tracking-tight">Documents</span>
           </div>
           <button onClick={() => setIsSidebarCollapsed(true)} className="p-1 hover:bg-zinc-200 rounded text-zinc-500 transition-colors"><PanelLeftClose className="w-4 h-4" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar select-none">
           <button onClick={createNewDoc} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-950 text-white hover:opacity-90 rounded-md transition-all text-[13px] font-bold shadow-sm mb-4">
              <Plus className="w-4 h-4" /> New Document
           </button>
           
           <div className="px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 mt-6">Recent Files</div>
           <div className="space-y-0.5">
             {documents.map(doc => (
               <div key={doc.id} onClick={() => { router.push(`/docs?id=${doc.id}`); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
                 className={cn(
                   "group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer border transition-all",
                   docId === doc.id ? "bg-white border-zinc-200 shadow-sm" : "border-transparent hover:bg-zinc-200/50"
                 )}
               >
                 <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className={cn("w-3.5 h-3.5 shrink-0 transition-colors", docId === doc.id ? "text-zinc-950" : "text-zinc-400")} />
                    <span className={cn("text-[13px] truncate transition-colors font-medium", docId === doc.id ? "text-zinc-950" : "text-zinc-600 group-hover:text-zinc-900")}>{doc.title}</span>
                 </div>
                 <button type="button" onClick={(e) => deleteDoc(doc.id, e)} className="p-1 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
               </div>
             ))}
           </div>
        </div>
      </aside>

      {/* TRIGGER BAR FOR LEFT SIDEBAR */}
      {isSidebarCollapsed && (
        <div className="fixed top-[80px] left-0 bottom-0 w-2 hover:bg-zinc-200 z-30 cursor-pointer group transition-colors" onClick={() => setIsSidebarCollapsed(false)}>
           <button className="absolute top-[14px] left-2 p-1 bg-white shadow-sm border border-zinc-200 rounded opacity-0 group-hover:opacity-100 transition-all"><PanelLeftOpen className="w-3.5 h-3.5 text-zinc-500" /></button>
        </div>
      )}

      {/* CORE DOCUMENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-20 select-auto">
        <header className="flex flex-col bg-white/80 backdrop-blur-xl border-b border-zinc-200/50 transition-shadow h-14 sm:h-16 shrink-0 justify-center z-20">
          <div className="flex items-center justify-between px-3 sm:px-6">
             
             <div className="flex items-center gap-2 sm:gap-3 w-full max-w-[60%]">
                {isSidebarCollapsed && (
                  <button onClick={() => setIsSidebarCollapsed(false)} className="p-1.5 hover:bg-zinc-100 rounded text-zinc-500 transition-colors shrink-0"><Menu className="w-4 h-4" /></button>
                )}
                
                {docId && (
                  <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-left-4 duration-300">
                    <input 
                      type="text" 
                      value={title} 
                      onChange={handleTitleChange} 
                      className="text-[15px] font-bold text-zinc-950 bg-transparent hover:bg-zinc-100 focus:bg-white focus:ring-2 focus:ring-zinc-950/10 border border-transparent rounded px-2 py-0.5 transition-all w-[150px] sm:w-[350px] outline-none truncate" 
                      placeholder="Untitled Document"
                    />
                    <div className="flex items-center text-zinc-400 shrink-0 ml-1">
                      {saveStatus === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <Cloud className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                )}
             </div>
             
             <div className="flex items-center gap-2 sm:gap-3 justify-end">
                {docId && (
                  <>
                    <div className="relative" ref={exportMenuRef}>
                      <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={isExportingPDF} className="px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-zinc-600 bg-white rounded-md hover:bg-zinc-50 transition-colors flex items-center gap-1.5 border border-zinc-200 shadow-sm disabled:opacity-50">
                        {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{isExportingPDF ? 'Exporting...' : 'Export'}</span>
                      </button>
                      
                      {showExportMenu && (
                         <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-zinc-200 shadow-xl rounded-xl py-1.5 z-[200] animate-in fade-in zoom-in-95 duration-100">
                            <button onClick={exportAsPDF} className="w-full text-left px-4 py-2 hover:bg-zinc-100 flex items-center gap-2 text-[13px] font-bold text-zinc-700 transition-colors"><Download className="w-3.5 h-3.5" /> Save as PDF</button>
                            <button onClick={exportAsHTML} className="w-full text-left px-4 py-2 hover:bg-zinc-100 flex items-center gap-2 text-[13px] font-bold text-zinc-700 transition-colors"><FileJson className="w-3.5 h-3.5" /> Save as HTML</button>
                            <button onClick={exportAsText} className="w-full text-left px-4 py-2 hover:bg-zinc-100 flex items-center gap-2 text-[13px] font-bold text-zinc-700 transition-colors"><FileText className="w-3.5 h-3.5" /> Save as Text</button>
                         </div>
                      )}
                    </div>
    
                    <button 
                      onClick={() => setIsChatOpen(!isChatOpen)} 
                      className={cn(
                        "h-8 px-3 inline-flex items-center justify-center whitespace-nowrap rounded-md text-[12px] font-bold uppercase tracking-wide transition-all shadow-sm gap-1.5 shrink-0 border",
                        isChatOpen 
                          ? "bg-zinc-950 text-zinc-50 border-zinc-950 shadow-inner" 
                          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                       {isChatOpen ? "Close AI" : <><Bot className="w-3.5 h-3.5" /> <span className="hidden sm:inline">AI Agent</span></>}
                    </button>
                  </>
                )}
             </div>
          </div>
        </header>

        {/* EDITOR OR BLANK STATE */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 flex flex-col items-center py-6 transition-all custom-scrollbar px-2 sm:px-8 relative selection:bg-zinc-200 overflow-x-hidden">
          
          {/* Subtle Background Elements */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>

          {!docId ? (
            <div className="flex flex-col items-center justify-center h-full w-full text-zinc-500 pb-20 animate-in fade-in zoom-in-95 duration-500 relative z-10">
              <div className="w-16 h-16 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <FileText className="w-8 h-8 text-zinc-400" />
              </div>
              <h2 className="text-2xl font-black text-zinc-950 mb-2 tracking-tight">No Document Selected</h2>
              <p className="text-[14px] font-medium text-zinc-500 mb-6 max-w-[300px] text-center leading-relaxed">
                Open a document from the sidebar or create a new one to start writing.
              </p>
              <button onClick={createNewDoc} className="px-5 py-2.5 bg-zinc-950 text-white text-[13px] font-bold rounded-lg hover:scale-105 transition-all shadow-md flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Document
              </button>
            </div>
          ) : (
            <div className="w-full max-w-[1000px] flex flex-col items-center pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300 relative z-10">
               
               {/* SLEEK PAGE NAVIGATOR */}
               <div className="w-full max-w-[850px] flex items-center justify-between mb-4 bg-white border border-zinc-200 rounded-xl p-1.5 shadow-sm animate-in fade-in">
                 <div className="flex items-center gap-1">
                   <button onClick={() => setActivePageIndex(p => p - 1)} disabled={activePageIndex === 0} className="p-1.5 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-600"><ChevronLeft className="w-4 h-4"/></button>
                   <span className="text-[12px] font-black uppercase tracking-widest text-zinc-950 px-3">Page {activePageIndex + 1} / {pages.length}</span>
                   <button onClick={() => setActivePageIndex(p => p + 1)} disabled={activePageIndex === pages.length - 1} className="p-1.5 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors text-zinc-600"><ChevronRight className="w-4 h-4"/></button>
                 </div>
                 <div className="flex items-center gap-1">
                   <button onClick={handleAddPage} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors border border-transparent"><Plus className="w-3.5 h-3.5"/> Add Page</button>
                   <button type="button" onClick={handleDeletePage} disabled={pages.length === 1} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors border border-transparent"><Trash2 className="w-4 h-4"/></button>
                 </div>
               </div>

               <div className="w-full max-w-[850px] bg-white border border-zinc-200 shadow-lg min-h-[800px] sm:min-h-[1100px] transition-all relative rounded-2xl overflow-hidden">
                  <ReactQuill 
                    key={`${activePageIndex}-${pages.length}`} 
                    ref={quillRef}
                    theme="snow"
                    value={pages[activePageIndex] || ""}
                    onChange={handleContentChange}
                    modules={quillModules}
                    placeholder="Start typing..."
                  />
               </div>
            </div>
          )}
        </main>
      </div>

      {/* DRAG RESIZER */}
      {isChatOpen && (
        <div 
          onMouseDown={handleMouseDown}
          style={{ touchAction: 'none' }}
          className={`hidden md:block w-1.5 shrink-0 cursor-col-resize hover:bg-zinc-200 transition-colors z-30 border-l border-zinc-200 ${isDragging ? 'bg-zinc-200' : 'bg-transparent'}`}
        />
      )}

      {/* PROFESSIONAL AI CHAT SIDEBAR */}
      {isChatOpen && (
        <div 
          style={{ width: window.innerWidth < 768 ? '100%' : `${chatWidth}px` }}
          className="absolute inset-0 z-50 md:relative flex flex-col bg-zinc-50 shadow-2xl md:shadow-none border-l border-zinc-200 animate-in slide-in-from-right-full md:slide-in-from-right-0 duration-300 min-h-0 shrink-0"
        >
          <div className="h-[56px] flex items-center justify-between px-4 border-b border-zinc-200 shrink-0 bg-white relative z-20">
            <div className="flex items-center gap-2 font-bold text-[14px] text-zinc-950 uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-zinc-500" />
              Intelligence Node
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-md transition-colors md:hidden">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar bg-zinc-50 min-h-0 relative z-0">
            <div className="relative z-10 flex flex-col min-h-full justify-end pb-2">
              
              {messages.length === 0 && !isChatLoading && (
                <div className="flex flex-col items-center justify-center text-center pb-10 my-auto text-zinc-500">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-zinc-400" />
                  </div>
                  <p className="text-[15px] font-black text-zinc-800 tracking-tight">Document Context Linked</p>
                  <p className="text-[13px] mt-1 font-medium text-zinc-500">I can read this document. Ask me to rewrite sections or generate new pages.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex w-full mb-6", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  {msg.role === "user" ? (
                    <div className="bg-zinc-950 text-zinc-50 px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-[14px] font-medium shadow-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="bg-transparent text-zinc-800 py-1 w-full text-[14px]">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-4 h-4 text-zinc-950" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <TypewriterMarkdown 
                            content={msg.content} 
                            isTyping={typingMessageId === msg.id} 
                            onComplete={() => setTypingMessageId(null)} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isChatLoading && (
                <div className="flex w-full animate-in fade-in duration-500 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                      <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                    </div>
                    <div className="text-zinc-500 text-[13px] font-bold uppercase tracking-widest pt-1.5">
                      Processing...
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} className="h-1 shrink-0" />
            </div>
          </div>

          <div className="p-4 border-t border-zinc-200 bg-white shrink-0">
            <form onSubmit={handleChatSubmit} className="flex items-end w-full bg-zinc-50 border border-zinc-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-zinc-950 transition-all overflow-hidden">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
                placeholder="Ask assistant..."
                disabled={isChatLoading}
                rows={1}
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[14px] font-medium placeholder:text-zinc-400 resize-none py-3.5 px-4 min-h-[50px] max-h-[150px] custom-scrollbar text-zinc-950"
              />
              <button type="submit" disabled={!chatInput.trim() || isChatLoading} className="p-2 m-1.5 rounded-xl bg-zinc-950 text-white disabled:opacity-30 transition-all flex items-center justify-center shrink-0 shadow-sm">
                <ArrowUp className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}