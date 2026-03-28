"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * Supabase Admin Client
 */
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// --- CLASSIC AUTH (EMAIL/PASS) ---

export async function loginWithPassword(email: string, pass: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signUpWithPassword(email: string, pass: string, fullName: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: { full_name: fullName }
    }
  });

  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user };
}

// --- OTP AUTH (NODEMAILER DRIVEN) ---

export async function sendLoginOTP(email: string) {
  // Generate a random 6-digit code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  const supabase = await createClient();
  
  // Store OTP in our custom table for manual verification
  // (Assuming auth_otps table exists from schema.sql)
  const { error: dbError } = await supabaseAdmin
    .from('auth_otps')
    .insert({ email, code: otpCode });

  if (dbError) return { success: false, error: "System failed to generate security code." };

  // Send via Nodemailer
  const emailResult = await sendEmail({
    to: email,
    subject: `Your Verification Code: ${otpCode}`,
    text: `Your security code is ${otpCode}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; background: #fafafa; padding: 40px; text-align: center; border-radius: 20px;">
        <h1 style="color: #000; font-weight: 900; letter-spacing: -2px; margin-bottom: 5px;">Nova Docs</h1>
        <p style="color: #666; font-size: 14px; margin-bottom: 30px;">Security Verification Code</p>
        <div style="background: #fff; border: 1px solid #eee; display: inline-block; padding: 20px 40px; border-radius: 16px; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #000;">
          ${otpCode}
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">This code expires in 10 minutes. Don't share it with anyone.</p>
      </div>
    `,
  });

  if (!emailResult.success) return { success: false, error: "Mail delivery failed." };

  return { success: true };
}

export async function verifyManualOTP(email: string, code: string) {
  const supabase = await createClient();
  
  // 1. Verify code in custom table
  const { data, error } = await supabaseAdmin
    .from('auth_otps')
    .select('*')
    .eq('email', email)
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return { success: false, error: "Invalid or expired code." };

  // 2. Remove the used OTP
  await supabaseAdmin.from('auth_otps').delete().eq('id', data.id);

  // 3. Log user into Supabase session
  // Note: For a "Proper" Supabase session with manual verification, 
  // you typically use admin.generateLink or signInWithOtp manually.
  // We'll use signInWithOtp (native) as the final step to get a real session if 
  // we haven't created one. Alternatively, if they exist, give them a magic link.
  
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
  });

  if (authError) return { success: false, error: "Failed to finalize session." };
  
  // Return the link for the frontend to navigate to (or redirect)
  return { success: true, redirect: authData.properties?.action_link };
}

export async function finishOnboarding(formData: {
  fullName: string;
  interests: string[];
  agentMode: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Forbidden" };

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: formData.fullName,
      interests: formData.interests,
      agent_mode: formData.agentMode,
      has_onboarded: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/docs');
  return { success: true };
}

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return data;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
