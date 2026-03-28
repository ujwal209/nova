"use server";

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Initialize Supabase for Server Actions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function createDocument() {
  const { data, error } = await supabase
    .from('documents')
    .insert([{ title: 'Untitled document', content: '' }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/docs'); // Flush cache so sidebar updates
  return data;
}

export async function getDocument(id: string) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function getDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) return [];
  return data;
}

export async function deleteDocument(id: string) {
  if (!id) return;
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  revalidatePath('/docs'); // Flush cache so sidebar updates
  return { success: !error };
}

export async function saveDocument(id: string, title: string, content: string) {
  if (!id) return;
  const { error } = await supabase
    .from('documents')
    .update({ 
      title, 
      content, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id);

  if (error) console.error("Failed to save:", error);
  revalidatePath('/docs'); // Flush cache
  return { success: !error };
}