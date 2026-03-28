"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client'; 
import { 
  ChevronLeft, LayoutPanelLeft, Eraser, Loader2, CheckCircle2, Circle, 
  ArrowRight, Plus, ChevronRight, ChevronDown, Trash2, CornerDownRight, ListTodo
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const supabase = createClient();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
export interface Todo {
  id: string;
  created_at?: string;
  user_id?: string;
  title: string;
  isCompleted: boolean;
  isExpanded: boolean;
  parentId: string | null;
  children: Todo[];
}

// ============================================================================
// UTILITIES
// ============================================================================
const buildTodoTree = (todos: any[]): Todo[] => {
  const todoMap = new Map();
  todos.forEach(todo => todoMap.set(todo.id, { ...todo, children: [] }));
  
  const rootTodos: Todo[] = [];
  
  todos.forEach(todo => {
    if (todo.parentId) {
      const parent = todoMap.get(todo.parentId);
      if (parent) parent.children.push(todoMap.get(todo.id));
    } else {
      rootTodos.push(todoMap.get(todo.id));
    }
  });
  
  return rootTodos;
};

// ============================================================================
// COMPONENT: TODO EDITOR (Inline)
// ============================================================================
function TodoEditor({ onRefresh }: { onRefresh: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    const { error } = await supabase.from('todos').insert([
      { title: text, isCompleted: false, isExpanded: false, parentId: null }
    ]);

    if (!error) {
      setText('');
      onRefresh();
    }
    setLoading(false);
  };

  return (
    <form 
      onSubmit={handleAdd} 
      className="flex items-center gap-3 px-4 py-3 bg-zinc-50/50 dark:bg-[#09090b] border-b border-zinc-200 dark:border-zinc-800 transition-colors focus-within:bg-white dark:focus-within:bg-zinc-900/50"
    >
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" /> : <Plus className="w-4 h-4 text-zinc-400" />}
      </div>
      <input 
        value={text} 
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a new task..."
        className="flex-1 bg-transparent border-none outline-none text-[14px] font-medium placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-950 dark:text-zinc-50"
        disabled={loading}
      />
      <button 
        type="submit"
        disabled={!text.trim() || loading}
        className={cn(
          "text-xs font-bold px-3 py-1.5 rounded-md transition-all",
          text.trim() && !loading
            ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90" 
            : "bg-transparent text-transparent pointer-events-none"
        )}
      >
        Add
      </button>
    </form>
  );
}

// ============================================================================
// COMPONENT: TODO ITEM
// ============================================================================
function TodoItem({ todo, onRefresh }: { todo: Todo; onRefresh: () => void }) {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    const { error } = await supabase.from('todos').update({ isCompleted: !todo.isCompleted }).eq('id', todo.id);
    if (!error) onRefresh();
  };

  const handleToggleExpand = async () => {
    const { error } = await supabase.from('todos').update({ isExpanded: !todo.isExpanded }).eq('id', todo.id);
    if (!error) onRefresh();
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskTitle.trim() || loading) return;

    setLoading(true);
    const { error } = await supabase.from('todos').insert([
      { title: subtaskTitle, parentId: todo.id, isCompleted: false, isExpanded: false }
    ]);

    if (!error) {
      setSubtaskTitle('');
      setIsAddingSubtask(false);
      await supabase.from('todos').update({ isExpanded: true }).eq('id', todo.id);
      onRefresh();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('todos').delete().eq('id', todo.id);
    if (!error) onRefresh();
  };

  const hasChildren = todo.children && todo.children.length > 0;

  return (
    <div className="flex flex-col relative group/row border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
      <div className="flex items-center gap-2.5 py-2.5 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
        
        {/* Expansion Toggle */}
        <div className="w-5 flex justify-center shrink-0">
          {hasChildren ? (
            <button 
              onClick={handleToggleExpand}
              className="text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              {todo.isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-3.5 h-3.5" />
          )}
        </div>

        {/* Custom Monochrome Checkbox */}
        <button 
          onClick={handleToggle}
          className={cn(
            "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all duration-200",
            todo.isCompleted 
              ? "bg-zinc-950 border-zinc-950 dark:bg-white dark:border-white text-white dark:text-zinc-950" 
              : "bg-transparent border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 text-transparent"
          )}
        >
          <CheckCircle2 className="w-3 h-3" strokeWidth={3.5} />
        </button>

        {/* Title */}
        <span className={cn(
          "flex-1 text-[14px] font-medium tracking-tight transition-all duration-300 truncate",
          todo.isCompleted ? "line-through text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-100"
        )}>
          {todo.title}
        </span>

        {/* Action Buttons */}
        <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity duration-200 pr-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-950 dark:hover:text-white" onClick={() => setIsAddingSubtask(!isAddingSubtask)}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-red-600 dark:hover:text-red-400" onClick={handleDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Subtask Input Field */}
      {isAddingSubtask && (
        <div className="ml-[2.75rem] py-1 mb-2 flex items-center gap-2 animate-in fade-in duration-200">
          <CornerDownRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 shrink-0" />
          <form onSubmit={handleAddSubtask} className="flex-1 max-w-sm mr-4">
            <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2.5 py-1 focus-within:border-zinc-400 transition-colors">
              <input
                autoFocus
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                placeholder="Add subtask..."
                className="text-[13px] bg-transparent border-none outline-none w-full font-medium placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-950 dark:text-white"
                disabled={loading}
              />
              {loading && <Loader2 className="w-3 h-3 animate-spin text-zinc-400 shrink-0 ml-2" />}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT: TODO TREE
// ============================================================================
function TodoTree({ todos, level = 0, onRefresh }: { todos: Todo[]; level?: number; onRefresh: () => void }) {
  if (!todos.length && level === 0) return null;

  return (
    <div className={cn("flex flex-col", level > 0 && "ml-[1.5rem] border-l border-zinc-200 dark:border-zinc-800")}>
      {todos.map((todo) => (
        <div key={todo.id}>
          <TodoItem todo={todo} onRefresh={onRefresh} />
          {todo.isExpanded && todo.children && (
            <TodoTree todos={todo.children} level={level + 1} onRefresh={onRefresh} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function TodoPage() {
  const router = useRouter();
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(true);

  const fetchTodos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTodos(buildTodoTree(data || []));
    } catch (err) {
      console.error("Fetch Failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const stats = useMemo(() => {
    const allItems = (function flatten(arr: any[]): any[] {
      return arr.reduce((acc, item) => acc.concat(item, flatten(item.children || [])), []);
    })(todos);
    const total = allItems.length;
    const completed = allItems.filter(t => t.isCompleted).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [todos]);

  const clearAllCompleted = async () => {
    if (!confirm("Are you sure you want to permanently delete all completed tasks?")) return;
    const { error } = await supabase.from('todos').delete().eq('isCompleted', true);
    if (!error) fetchTodos();
  };

  const displayTodos = hideCompleted ? todos.filter(t => !t.isCompleted) : todos;

  return (
    <div className="absolute inset-0 flex flex-col bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 overflow-hidden selection:bg-zinc-200 dark:selection:bg-zinc-800">
      
      {/* STRICT FONT ENFORCEMENT & SCROLLBAR */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Outfit:wght@100..900&display=swap');
        * { font-family: 'Google Sans', 'Outfit', sans-serif !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d4d4d8; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #27272a; }
      `}} />

      {/* ELITE MINIMALIST HEADER */}
      <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/')}
            className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
          </Button>
          <div className="flex items-center gap-2">
            <LayoutPanelLeft className="w-4 h-4 text-zinc-950 dark:text-white" />
            <span className="text-[13px] font-bold tracking-tight text-zinc-950 dark:text-white">Workspace</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="w-7 h-7 ring-1 ring-zinc-200 dark:ring-zinc-800 bg-zinc-100 dark:bg-zinc-900">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback className="text-[10px] font-bold text-zinc-950 dark:text-white">UV</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 min-h-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12 w-full">
          
          {/* HEADER SECTION */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-zinc-50 mb-1">
                Tasks
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-[14px] font-medium">
                {stats.total - stats.completed} remaining
              </p>
            </div>

            {/* PROGRESS & FILTERS */}
            <div className="flex flex-col items-start sm:items-end gap-3">
              {/* Progress Bar */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest w-10 text-right">{stats.percent}%</span>
                <div className="w-full sm:w-32 h-[4px] bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 dark:bg-white transition-all duration-1000 ease-out" 
                    style={{ width: `${stats.percent}%` }}
                  />
                </div>
              </div>

              {/* Segmented Controls */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-900/80 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto">
                <button
                  onClick={() => setHideCompleted(true)}
                  className={cn(
                    "flex-1 sm:flex-none px-4 py-1.5 text-[12px] font-bold rounded-md transition-all",
                    hideCompleted ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                  )}
                >
                  Active
                </button>
                <button
                  onClick={() => setHideCompleted(false)}
                  className={cn(
                    "flex-1 sm:flex-none px-4 py-1.5 text-[12px] font-bold rounded-md transition-all",
                    !hideCompleted ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                  )}
                >
                  All
                </button>
                <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />
                <button
                  onClick={clearAllCompleted}
                  title="Clear Completed"
                  className="px-2 py-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* TASK LIST CONTAINER (The Core Framed Interface) */}
          <div className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <TodoEditor onRefresh={fetchTodos} />
            
            <div className="min-h-[300px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-[300px] opacity-50">
                  <Loader2 className="w-6 h-6 animate-spin mb-3 text-zinc-400" />
                  <span className="text-[12px] font-bold text-zinc-500">Syncing...</span>
                </div>
              ) : displayTodos.length > 0 ? (
                <div className="p-2 sm:p-3">
                  <TodoTree todos={displayTodos} onRefresh={fetchTodos} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mb-3">
                    <ListTodo className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">All caught up</p>
                  <p className="text-[13px] font-medium text-zinc-500 mt-1">Add a new task above to get started.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}