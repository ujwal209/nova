"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, Undo, Redo, Printer, SpellCheck, 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Share, Highlighter, Type, 
  Link as LinkIcon, Image as ImageIcon, RemoveFormatting, FilePlus2, Strikethrough
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DocsPage() {
  const router = useRouter();
  const [title, setTitle] = useState("Untitled document");
  const editorRef = useRef<HTMLDivElement>(null);

  // --- NATIVE FORMATTING ENGINE ---
  const formatText = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus(); 
  };

  // --- ADVANCED FEATURES ---
  const insertLink = () => {
    const url = prompt("Enter the link URL:");
    if (url) {
      formatText('createLink', url);
    }
  };

  const insertImage = () => {
    const url = prompt("Enter the Image URL:");
    if (url) {
      formatText('insertImage', url);
    }
  };

  const insertPageBreak = () => {
    // Inserts a thick horizontal rule acting as a page break
    const hr = '<hr style="width: 100%; border-top: 4px dashed #e4e4e7; margin: 40px 0; page-break-after: always;" />';
    document.execCommand('insertHTML', false, hr);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f9fbfd] dark:bg-[#111111] font-sans overflow-hidden selection:bg-blue-200 dark:selection:bg-blue-900">
      
      {/* TOP HEADER */}
      <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-[#1a1a1a] shrink-0 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div 
            onClick={() => router.push('/')}
            className="w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            title="Nova Home"
          >
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400 fill-blue-600/20" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-[18px] text-zinc-800 dark:text-zinc-100 font-medium bg-transparent border-none focus:outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800 px-2 py-0.5 rounded-sm w-[250px] hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              />
            </div>
            <div className="flex items-center text-[13px] text-zinc-600 dark:text-zinc-400 px-1 gap-1 mt-0.5">
              {['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'].map(menu => (
                <button key={menu} className="hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-0.5 rounded transition-colors cursor-pointer">
                  {menu}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="hidden sm:flex items-center gap-2 bg-[#c2e7ff] dark:bg-blue-900/30 hover:bg-[#b3dcf6] dark:hover:bg-blue-900/50 text-[#001d35] dark:text-blue-300 px-5 py-2.5 rounded-full text-[14px] font-medium transition-colors">
            <Share className="w-4 h-4" /> Share
          </button>
          <Avatar className="w-9 h-9 cursor-pointer ring-2 ring-transparent hover:ring-blue-200 transition-all">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>UV</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* WORKING FORMATTING RIBBON */}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-[#edf2fa] dark:bg-[#1e1e1e] rounded-full mx-4 my-2 shrink-0 overflow-x-auto hide-scrollbar shadow-sm border border-zinc-200/50 dark:border-zinc-800">
        
        {/* History & Print */}
        <button onClick={() => formatText('undo')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors" title="Undo (Ctrl+Z)"><Undo className="w-4 h-4" /></button>
        <button onClick={() => formatText('redo')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors" title="Redo (Ctrl+Y)"><Redo className="w-4 h-4" /></button>
        <button onClick={() => window.print()} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors" title="Print (Ctrl+P)"><Printer className="w-4 h-4" /></button>
        <button onClick={() => formatText('removeFormat')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors" title="Clear Formatting"><RemoveFormatting className="w-4 h-4" /></button>
        
        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
        
        {/* Font Family */}
        <select 
          onChange={(e) => formatText('fontName', e.target.value)}
          className="bg-transparent border-none text-[13px] font-medium text-zinc-700 dark:text-zinc-200 focus:outline-none hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1.5 rounded-md cursor-pointer appearance-none w-[110px]"
        >
          <option value="Google Sans">Google Sans</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>
        
        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

        {/* Font Size */}
        <select 
          onChange={(e) => formatText('fontSize', e.target.value)}
          className="bg-transparent border-none text-[13px] font-medium text-zinc-700 dark:text-zinc-200 focus:outline-none hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1.5 rounded-md cursor-pointer appearance-none"
        >
          <option value="1">10 pt</option>
          <option value="2">13 pt</option>
          <option value="3">16 pt (Normal)</option>
          <option value="4">18 pt</option>
          <option value="5">24 pt (Heading)</option>
          <option value="6">32 pt</option>
          <option value="7">48 pt (Title)</option>
        </select>

        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

        {/* Text Styles */}
        <button onClick={() => formatText('bold')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors" title="Bold (Ctrl+B)"><Bold className="w-4 h-4" /></button>
        <button onClick={() => formatText('italic')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors" title="Italic (Ctrl+I)"><Italic className="w-4 h-4" /></button>
        <button onClick={() => formatText('underline')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors" title="Underline (Ctrl+U)"><Underline className="w-4 h-4" /></button>
        <button onClick={() => formatText('strikeThrough')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors" title="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
        
        {/* Text Color Picker */}
        <div className="relative flex items-center group ml-1">
          <input 
            type="color" 
            onChange={(e) => formatText('foreColor', e.target.value)}
            className="absolute opacity-0 w-8 h-8 cursor-pointer z-10" 
            title="Text Color"
          />
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 flex flex-col items-center transition-colors">
            <Type className="w-4 h-4" />
            <div className="w-3 h-1 bg-blue-600 dark:bg-blue-400 mt-[1px] rounded-full"></div>
          </button>
        </div>

        {/* Highlight Color Picker */}
        <div className="relative flex items-center group">
          <input 
            type="color" 
            onChange={(e) => formatText('hiliteColor', e.target.value)}
            className="absolute opacity-0 w-8 h-8 cursor-pointer z-10" 
            title="Highlight Color"
          />
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 flex flex-col items-center transition-colors">
            <Highlighter className="w-4 h-4" />
          </button>
        </div>
        
        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

        {/* Links & Images & Pages */}
        <button onClick={insertLink} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors" title="Insert Link"><LinkIcon className="w-4 h-4" /></button>
        <button onClick={insertImage} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors" title="Insert Image"><ImageIcon className="w-4 h-4" /></button>
        <button onClick={insertPageBreak} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors" title="Insert Page Break"><FilePlus2 className="w-4 h-4" /></button>

        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

        {/* Alignment */}
        <button onClick={() => formatText('justifyLeft')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors"><AlignLeft className="w-4 h-4" /></button>
        <button onClick={() => formatText('justifyCenter')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors"><AlignCenter className="w-4 h-4" /></button>
        <button onClick={() => formatText('justifyRight')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors"><AlignRight className="w-4 h-4" /></button>
        <button onClick={() => formatText('justifyFull')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors"><AlignJustify className="w-4 h-4" /></button>

        <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

        {/* Lists */}
        <button onClick={() => formatText('insertUnorderedList')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors"><List className="w-4 h-4" /></button>
        <button onClick={() => formatText('insertOrderedList')} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-700 dark:text-zinc-300 transition-colors"><ListOrdered className="w-4 h-4" /></button>
      </div>

      {/* PAPER CANVAS */}
      <main className="flex-1 overflow-y-auto bg-[#f9fbfd] dark:bg-[#111111] flex justify-center py-6 custom-scrollbar">
        
        {/* Style injection for the dynamic components (links, page breaks) inside contentEditable */}
        <style dangerouslySetInnerHTML={{__html: `
          .prose-editor a { color: #2563eb; text-decoration: underline; cursor: pointer; }
          .prose-editor img { max-width: 100%; border-radius: 8px; margin: 10px 0; }
          .prose-editor ul { list-style-type: disc; padding-left: 24px; margin: 8px 0; }
          .prose-editor ol { list-style-type: decimal; padding-left: 24px; margin: 8px 0; }
          .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.8); }
        `}} />

        {/* The "Paper" Container */}
        <div className="w-full max-w-[816px] bg-white dark:bg-[#1e1e1e] shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] dark:shadow-none dark:border dark:border-zinc-800 p-16 sm:p-24 cursor-text mb-20 relative">
          
          {/* NATIVE RICH TEXT EDITOR */}
          <div 
            ref={editorRef}
            contentEditable 
            className="prose-editor w-full min-h-full outline-none text-zinc-800 dark:text-zinc-200 text-[16px] leading-[1.6]"
            suppressContentEditableWarning
            style={{ minHeight: '850px' }}
          >
            <h1><font size="6">Welcome to Nova Docs</font></h1>
            <p><br /></p>
            <p>You can start typing here. Highlight text and use the ribbon above to:</p>
            <ul>
              <li>Make text <b>bold</b>, <i>italic</i>, <strike>strikethrough</strike>, or <u>underlined</u>.</li>
              <li>Change the <font color="#2563eb">font color</font> or <span style={{backgroundColor: '#fef08a'}}>highlight</span> using the color pickers.</li>
              <li>Insert <a href="https://google.com">live hyperlinks</a> or images.</li>
              <li>Click the <b>Page+</b> icon to insert a visual page break!</li>
            </ul>
            <p><br /></p>
            <p><i>Note: The "A" and Highlighter icons on the toolbar are actual color pickers. Click them to select a custom color!</i></p>
          </div>
        </div>
      </main>
    </div>
  );
}