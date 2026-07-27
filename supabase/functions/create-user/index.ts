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

    const { email, full_name, role, company_ids, send_email } = await req.json();

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const redirectTo = `${Deno.env.get("SITE_URL") ?? "https://SEU-DOMINIO"}/login`;
    let userId: string;
    let accessLink: string | null = null;

    if (send_email) {
      // Deixa o Supabase disparar o e-mail de convite automaticamente.
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name },
        redirectTo,
      });
      if (inviteError) {
        const code = (inviteError as any).code;
        const alreadyExists = code === "email_exists" || /already been registered|already exists/i.test(inviteError.message || "");
        return new Response(
          JSON.stringify({ error: alreadyExists ? "Este e-mail já possui uma conta" : inviteError.message }),
          { status: 400, headers: corsHeaders },
        );
      }
      userId = inviteData.user.id;
    } else {
      // Gera só o link de primeiro acesso — não envia e-mail, o admin decide como
      // entregar (WhatsApp, e-mail manual, etc). O usuário define a própria senha
      // pelo link, então nunca lidamos com senha aqui.
      const { data: linkData, error: inviteError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: { data: { full_name }, redirectTo },
      });
      if (inviteError) {
        const code = (inviteError as any).code;
        const alreadyExists = code === "email_exists" || /already been registered|already exists/i.test(inviteError.message || "");
        return new Response(
          JSON.stringify({ error: alreadyExists ? "Este e-mail já possui uma conta" : inviteError.message }),
          { status: 400, headers: corsHeaders },
        );
      }
      userId = linkData.user.id;
      accessLink = linkData.properties.action_link;
    }

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

    return new Response(
      JSON.stringify(accessLink ? { user_id: userId, success: true, access_link: accessLink } : { user_id: userId, success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
