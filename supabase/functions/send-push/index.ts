import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Chamada pelo mecanismo de disparo (Database Webhook ou trigger com pg_net)
// a cada INSERT em public.notifications. Aceita tanto o payload padrão de
// Database Webhook do Supabase ({ record: {...} }) quanto o registro puro,
// pra funcionar com qualquer um dos dois sem mudar o código depois.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get("SEND_PUSH_SECRET");
    if (expectedSecret && req.headers.get("x-webhook-secret") !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const record = body.record ?? body;
    const { user_id: userId, title, message, link } = record ?? {};

    if (!userId || !title) {
      return new Response(JSON.stringify({ error: "Missing user_id or title" }), { status: 400, headers: corsHeaders });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      return new Response(JSON.stringify({ error: "VAPID secrets not configured" }), { status: 500, headers: corsHeaders });
    }
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: subscriptions, error: subsError } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (subsError) {
      return new Response(JSON.stringify({ error: subsError.message }), { status: 500, headers: corsHeaders });
    }

    const payload = JSON.stringify({ title, message: message ?? "", link: link ?? "/" });

    let sent = 0;
    let removed = 0;
    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        } else {
          console.error(`send-push: falha ao enviar para subscription ${sub.id}`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, removed, total: (subscriptions ?? []).length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
