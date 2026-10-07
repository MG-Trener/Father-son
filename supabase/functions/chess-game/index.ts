import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { Chess } from "npm:chess.js@1.4.0";
import { validateAction } from "./validate.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return reply({ error: "AUTH_REQUIRED" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(authorization.slice(7));
  if (authError || !user) return reply({ error: "AUTH_REQUIRED" }, 401);
  try {
    const body = await req.json();
    if (typeof body.family_id !== "string" || !Number.isInteger(body.version))
      return reply({ error: "INVALID_REQUEST" }, 400);
    // RLS also enforces approved owner sessions; service key is never used to establish access.
    const member = await client
      .from("family_members")
      .select("user_id")
      .eq("family_id", body.family_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (member.error || !member.data)
      return reply({ error: "FAMILY_ACCESS_DENIED" }, 403);
    const result = await client
      .from("chess_games")
      .select("*")
      .eq("family_id", body.family_id)
      .maybeSingle();
    if (result.error) return reply({ error: "READ_FAILED" }, 500);
    const game = result.data;
    let checked;
    try {
      checked = validateAction(new Chess(), game, user.id, body);
    } catch (error) {
      return reply(
        { error: error instanceof Error ? error.message : "ILLEGAL_MOVE" },
        409,
      );
    }
    const service = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const committed = await service.rpc("commit_chess_position", {
      p_family_id: body.family_id,
      p_actor: user.id,
      p_expected: body.version,
      p_fen: checked.fen,
      p_pgn: checked.pgn,
      p_turn: checked.turn,
      p_finished: checked.finished,
      p_move: checked.move,
      p_notify: body.notify === true,
      p_new: body.action === "new",
    });
    if (committed.error)
      return reply(
        {
          error: committed.error.message.includes("STALE_POSITION")
            ? "STALE_POSITION"
            : "COMMIT_FAILED",
        },
        409,
      );
    return reply(committed.data);
  } catch {
    return reply({ error: "INVALID_REQUEST" }, 400);
  }
});
