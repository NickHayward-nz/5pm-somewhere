// © 2026 Chromatic Productions Ltd. All rights reserved.
// Returns a short-lived signed video URL for a public live-stream moment or a
// moment owned by the signed-in user. Designed so the moments bucket can be
// private while public product viewing still works through a controlled surface.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Body = {
  momentId?: unknown;
  /** Prefer an iOS/Safari-friendly MP4 playback rendition when one exists. */
  preferPlayback?: unknown;
};

type MomentRow = {
  id: string;
  user_id: string | null;
  created_at: string;
  video_url: string | null;
  storage_path: string | null;
  playback_storage_path: string | null;
  playback_content_type: string | null;
  playback_status: string | null;
};

const LIVE_WINDOW_HOURS = 20;
const SIGNED_URL_TTL_SECONDS = 10 * 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function storagePathFromMomentsUrl(videoUrl: string | null): string | null {
  if (!videoUrl) return null;
  try {
    const url = new URL(videoUrl);
    for (
      const marker of [
        "/storage/v1/object/public/moments/",
        "/storage/v1/object/sign/moments/",
      ]
    ) {
      const i = url.pathname.indexOf(marker);
      if (i !== -1) {
        return decodeURIComponent(url.pathname.slice(i + marker.length));
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isWithinPublicLiveWindow(createdAt: string): boolean {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  const cutoffMs = Date.now() - LIVE_WINDOW_HOURS * 60 * 60 * 1000;
  return createdMs >= cutoffMs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server not configured." }, 500);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonResponse({ error: "Invalid JSON." }, 400);
  }

  if (typeof body.momentId !== "string" || !body.momentId) {
    return jsonResponse({ error: "Missing momentId." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  let callerUserId: string | null = null;
  if (jwt) {
    const { data: userData } = await admin.auth.getUser(jwt);
    callerUserId = userData.user?.id ?? null;
  }

  const { data: row, error: rowError } = await admin
    .from("moments")
    .select(
      "id, user_id, created_at, video_url, storage_path, playback_storage_path, playback_content_type, playback_status",
    )
    .eq("id", body.momentId)
    .maybeSingle<MomentRow>();

  if (rowError) {
    console.error("get-moment-video-url: moment lookup failed", rowError);
    return jsonResponse({ error: "Could not load moment." }, 500);
  }
  if (!row) return jsonResponse({ error: "Moment not found." }, 404);

  const isOwner = Boolean(callerUserId && row.user_id === callerUserId);
  const isPublicLiveMoment = isWithinPublicLiveWindow(row.created_at);
  if (!isOwner && !isPublicLiveMoment) {
    return jsonResponse({ error: "Moment is not available." }, 403);
  }

  const shouldPreferPlayback = body.preferPlayback === true;
  const hasReadyPlayback = row.playback_status === "ready" &&
    Boolean(row.playback_storage_path);
  const storagePath = shouldPreferPlayback && hasReadyPlayback
    ? row.playback_storage_path
    : row.storage_path || storagePathFromMomentsUrl(row.video_url);
  if (!storagePath) {
    return jsonResponse({ error: "Moment video path is missing." }, 500);
  }

  const usedPlaybackRendition = storagePath === row.playback_storage_path;

  const { data: signed, error: signError } = await admin.storage
    .from("moments")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error("get-moment-video-url: signed URL failed", signError, {
      momentId: row.id,
      storagePath,
    });
    return jsonResponse({ error: "Could not create video link." }, 500);
  }

  return jsonResponse({
    signedUrl: signed.signedUrl,
    expiresIn: SIGNED_URL_TTL_SECONDS,
    contentType: usedPlaybackRendition
      ? row.playback_content_type || "video/mp4"
      : null,
    usedPlaybackRendition,
  });
});
