"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Table, Undo, Redo, Printer, PaintBucket, 
  Bold, Italic, Strikethrough, AlignLeft, Search, Share, Link2, FunctionSquare
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SheetsPage() {
  const router = useRouter();
  const [title, setTitle] = useState("Untitled spreadsheet");
  
  // Create arrays for A-Z columns and 1-50 rows
  const cols = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const rows = Array.from({ length: 50 }, (_, i) => i + 1);

  // Local state for cells (e.g. { "A1": "Hello", "B2": "World" })
  const [cells, setCells] = useState<Record<string, string>>({});
  const [activeCell, setActiveCell] = useState("A1");
  const [formulaValue, setFormulaValue] = useState("");

  const handleCellChange = (col: string, row: number, val: string) => {
    const key = `${col}${row}`;
    setCells(prev => ({ ...prev, [key]: val }));
    setFormulaValue(val);
  };

  const handleFormulaBarChange = (val: string) => {
    setFormulaValue(val);
    setCells(prev => ({ ...prev, [activeCell]: val }));
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#111111] font-sans overflow-hidden">
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156, 163, 175, 0.8); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* TOP HEADER */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-[#161616]">
        <div className="flex items-center gap-2">
          <div 
            onClick={() => router.push('/')}
            className="w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            title="Nova Home"
          >
            <Table className="w-6 h-6 text-green-600 dark:text-green-500 fill-green-600/20" />
          </div>
          <div className="flex flex-col">
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-[18px] text-zinc-800 dark:text-zinc-100 font-medium bg-transparent border-none focus:outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800 px-2 py-0.5 rounded-sm w-[250px] hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            />
            <div className="flex items-center text-[13px] text-zinc-600 dark:text-zinc-400 px-1 gap-1 mt-0.5">
              {['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Extensions', 'Help'].map(menu => (
                <button key={menu} className="hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-0.5 rounded transition-colors cursor-pointer">
                  {menu}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="hidden sm:flex items-center gap-2 bg-[#c2e7ff] dark:bg-green-900/30 hover:bg-[#b3dcf6] dark:hover:bg-green-900/50 text-[#001d35] dark:text-green-300 px-5 py-2.5 rounded-full text-[14px] font-medium transition-colors">
            <Share className="w-4 h-4" /> Share
          </button>
          <Avatar className="w-9 h-9 cursor-pointer ring-2 ring-transparent hover:ring-green-200 transition-all">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>UV</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* RIBBON & FORMULA BAR */}
      <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 bg-[#f9fbfd] dark:bg-[#1a1a1a]">
        
        {/* Ribbon */}
        <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto hide-scrollbar">
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors"><Undo className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors"><Redo className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors"><Printer className="w-4 h-4" /></button>
          
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
          
          <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 px-2 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 py-1 rounded">$</span>
          <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 px-2 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 py-1 rounded">%</span>
          <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 px-2 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 py-1 rounded">.00</span>
          
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
          
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors"><Bold className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors"><Italic className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors"><Strikethrough className="w-4 h-4" /></button>
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors"><PaintBucket className="w-4 h-4" /></button>
          
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
          
          <button className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-zinc-600 dark:text-zinc-300 transition-colors"><AlignLeft className="w-4 h-4" /></button>
        </div>
        
        {/* Formula Bar */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-t border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-[#161616]">
          <div className="w-12 text-center text-[12px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-[#202020] py-1 rounded border border-zinc-200 dark:border-zinc-700 select-none">
            {activeCell}
          </div>
          <FunctionSquare className="w-4 h-4 text-zinc-400 shrink-0" />
          <input 
            type="text" 
            value={formulaValue}
            onChange={(e) => handleFormulaBarChange(e.target.value)}
            className="flex-1 outline-none text-[14px] font-medium bg-transparent text-zinc-800 dark:text-zinc-200 py-1 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
            placeholder="Enter formula or value..."
          />
        </div>
      </div>

      {/* SPREADSHEET GRID */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-[#111111] relative">
        <div className="inline-block min-w-full">
          
          {/* Header Row (A, B, C...) */}
          <div className="flex sticky top-0 z-20 bg-zinc-50 dark:bg-[#1a1a1a]">
            <div className="w-12 h-8 border-b border-r border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#1a1a1a] shrink-0 sticky left-0 z-30"></div>
            {cols.map(col => (
              <div key={col} className="w-28 h-8 flex items-center justify-center border-b border-r border-zinc-300 dark:border-zinc-700 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 shrink-0 select-none hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                {col}
              </div>
            ))}
          </div>

          {/* Rows (1, 2, 3...) */}
          {rows.map(row => (
            <div key={row} className="flex group">
              {/* Row Header */}
              <div className="w-12 h-[25px] flex items-center justify-center border-b border-r border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#1a1a1a] text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 shrink-0 sticky left-0 z-10 select-none group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800 transition-colors cursor-pointer">
                {row}
              </div>
              
              {/* Individual Cells */}
              {cols.map(col => {
                const cellId = `${col}${row}`;
                const isActive = activeCell === cellId;
                
                return (
                  <div key={col} className="relative shrink-0">
                    <input
                      value={cells[cellId] || ""}
                      onChange={(e) => handleCellChange(col, row, e.target.value)}
                      onFocus={() => { 
                        setActiveCell(cellId); 
                        setFormulaValue(cells[cellId] || ""); 
                      }}
                      className={`w-28 h-[25px] px-1.5 border-b border-r border-zinc-200 dark:border-zinc-800 text-[13px] font-medium outline-none bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-transparent ${
                        isActive 
                          ? 'ring-2 ring-blue-500 border-transparent z-10 relative bg-white dark:bg-[#1e1e1e] shadow-sm' 
                          : 'hover:border-zinc-400 dark:hover:border-zinc-600'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}