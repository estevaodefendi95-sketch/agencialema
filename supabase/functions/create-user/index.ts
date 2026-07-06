import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const callerId = claimsData.claims.sub;

    // Check if caller is admin using service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .single();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: only admins can create users" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { email, full_name, role, company_ids } = await req.json();

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Create the user and get back a first-access link — this does NOT send an email,
    // so the admin decides how to deliver it (WhatsApp, e-mail, etc). The user sets
    // their own password via the link, so we never handle/store a password here.
    const { data: linkData, error: inviteError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { full_name },
        redirectTo: `${Deno.env.get("SITE_URL") ?? "https://SEU-DOMINIO"}/login`,
      },
    });

    if (inviteError) {
      const code = (inviteError as any).code;
      const alreadyExists = code === "email_exists" || /already been registered|already exists/i.test(inviteError.message || "");
      if (alreadyExists) {
        return new Response(JSON.stringify({ error: "Este e-mail já possui uma conta" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const userId = linkData.user.id;
    const accessLink = linkData.properties.action_link;

    // Set status to approved
    await adminClient.from("profiles").update({ status: "aprovado" }).eq("id", userId);

    // Set role
    await adminClient.from("user_roles").insert({ user_id: userId, role });

    // Set company access
    if (company_ids && company_ids.length > 0) {
      await adminClient.from("user_company_access").insert(
        company_ids.map((cid: string) => ({ user_id: userId, company_id: cid }))
      );
    }

    return new Response(JSON.stringify({ user_id: userId, success: true, access_link: accessLink }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
