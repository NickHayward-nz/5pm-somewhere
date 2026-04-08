/**
 * Premium montage worker (FFmpeg + Mux). Runs outside Vercel — too heavy for Hobby serverless.
 * Local: `npm run montage-worker` (listens on PORT, default 8787).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MONTAGE_WORKER_SECRET,
 *      MUX_TOKEN_ID, MUX_TOKEN_SECRET, MONTAGE_MAX_USERS (optional)
 */
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import http from 'http'
import { fileURLToPath } from 'url'

import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

const ffprobePath = ffprobeStatic.path

const execFileAsync = promisify(execFile)

function muxBasicAuthHeader() {
  const id = process.env.MUX_TOKEN_ID
  const secret = process.env.MUX_TOKEN_SECRET
  if (!id || !secret) return null
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
}

async function muxCreateAssetFromUrl(publicUrl) {
  const auth = muxBasicAuthHeader()
  if (!auth) throw new Error('MUX_TOKEN_ID / MUX_TOKEN_SECRET not set')
  const res = await fetch('https://api.mux.com/video/v1/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({
      inputs: [{ url: publicUrl }],
      playback_policies: ['public'],
      video_quality: 'basic',
      meta: { title: '5PM Somewhere Montage' },
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Mux create asset: ${res.status} ${text}`)
  const json = JSON.parse(text)
  return json.data
}

async function muxGetAsset(assetId) {
  const auth = muxBasicAuthHeader()
  const res = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
    headers: { Authorization: auth },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Mux get asset: ${res.status} ${text}`)
  return JSON.parse(text).data
}

async function waitForMuxReady(assetId, maxWaitMs = 240000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const data = await muxGetAsset(assetId)
    if (data.status === 'ready') return data
    if (data.status === 'errored') throw new Error(data.errors?.messages?.join?.() || 'Mux asset errored')
    await new Promise((r) => setTimeout(r, 4000))
  }
  throw new Error('Mux asset wait timeout')
}

async function probeDurationSec(filePath) {
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    filePath,
  ])
  const v = parseFloat(String(stdout).trim())
  return Number.isFinite(v) ? v : 0
}

function dominantReactionType(moments) {
  let p = 0
  let f = 0
  let c = 0
  for (const m of moments) {
    p += Number(m.pretty_count) || 0
    f += Number(m.funny_count) || 0
    c += Number(m.cheers_count) || 0
  }
  if (p >= f && p >= c) return 'pretty'
  if (f >= c) return 'funny'
  return 'cheers'
}

async function pickMusicPath(sb, folder) {
  const { data: files, error } = await sb.storage.from('music').list(folder, {
    limit: 200,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) throw error
  const tracks = (files ?? []).filter((f) => f.name && !f.name.endsWith('/'))
  if (tracks.length === 0) throw new Error(`No audio files in music/${folder}/`)

  const { data: rotRow } = await sb
    .from('montage_music_rotation')
    .select('next_index')
    .eq('folder', folder)
    .maybeSingle()
  let idx = rotRow?.next_index ?? 0
  idx = idx % tracks.length
  const name = tracks[idx].name
  const next = (idx + 1) % tracks.length
  await sb.from('montage_music_rotation').upsert({ folder, next_index: next }, { onConflict: 'folder' })

  return `${folder}/${name}`
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url.slice(0, 80)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(destPath, buf)
}

/**
 * Smart trim: aim for clipLenSec in [4,8], centered; fallback middle if duration unknown.
 */
async function trimSegment(ffmpeg, inputPath, outPath, clipLenSec) {
  const dur = await probeDurationSec(inputPath)
  const len = Math.min(clipLenSec, Math.max(4, Math.min(8, dur > 0 ? dur : clipLenSec)))
  let ss = 0
  if (dur > len + 0.5) {
    ss = Math.max(0, (dur - len) / 2)
  }
  await execFileAsync(ffmpeg, [
    '-y',
    '-ss',
    String(ss),
    '-i',
    inputPath,
    '-t',
    String(len),
    '-vf',
    'scale=1280:-2:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-ac',
    '2',
    outPath,
  ])
}

async function concatSegments(ffmpeg, segmentPaths, outPath) {
  const n = segmentPaths.length
  if (n === 0) throw new Error('No segments')
  if (n === 1) {
    await fs.copyFile(segmentPaths[0], outPath)
    return
  }
  let fc = ''
  for (let i = 0; i < n; i++) {
    fc += `[${i}:v][${i}:a]`
  }
  fc += `concat=n=${n}:v=1:a=1[vout][aout]`
  const args = ['-y']
  for (const p of segmentPaths) {
    args.push('-i', p)
  }
  args.push('-filter_complex', fc, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', outPath)
  await execFileAsync(ffmpeg, args)
}

async function addMusicTitle(ffmpeg, videoIn, audioStoragePath, sb, titleLine, outPath) {
  const { data: musicBlob, error: dlErr } = await sb.storage.from('music').download(audioStoragePath)
  if (dlErr) throw dlErr
  const dir = path.dirname(outPath)
  const musicTmp = path.join(dir, 'music-audio.bin')
  await fs.writeFile(musicTmp, Buffer.from(await musicBlob.arrayBuffer()))

  const titleFile = path.join(dir, 'title.txt')
  await fs.writeFile(titleFile, titleLine, 'utf8')
  const titlePathForFfmpeg = titleFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")

  const fc = [
    `[0:v]drawtext=textfile='${titlePathForFfmpeg}':fontsize=26:fontcolor=white:box=1:boxcolor=black@0.45:boxborderw=8:x=(w-text_w)/2:y=36[v]`,
    `[1:a]volume=0.92[m]`,
    `[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
  ].join(';')

  await execFileAsync(ffmpeg, [
    '-y',
    '-i',
    videoIn,
    '-stream_loop',
    '-1',
    '-i',
    musicTmp,
    '-filter_complex',
    fc,
    '-map',
    '[v]',
    '-map',
    '[aout]',
    '-t',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-shortest',
    outPath,
  ])
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const secret = process.env.MONTAGE_WORKER_SECRET
  const authHeader = req.headers.authorization ?? req.headers.Authorization
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body =
    typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(typeof req.body === 'string' ? req.body : '{}')

  const type = body.type === 'monthly' ? 'monthly' : body.type === 'both' ? 'both' : 'weekly'
  const maxUsers = Math.min(100, Math.max(1, parseInt(process.env.MONTAGE_MAX_USERS || '25', 10) || 25))

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  if (!ffmpegPath) {
    return res.status(500).json({ error: 'ffmpeg-static binary not available on this platform' })
  }

  const sb = createClient(supabaseUrl, serviceKey)
  const now = new Date()
  const results = { weekly: [], monthly: [], errors: [] }

  const runWeekly = type === 'weekly' || type === 'both'
  const runMonthly = type === 'monthly' || type === 'both'

  const { data: premiumRows, error: premErr } = await sb.from('profiles').select('id').eq('is_premium', true)
  if (premErr) {
    return res.status(500).json({ error: premErr.message })
  }
  const userIds = (premiumRows ?? []).map((r) => r.id).slice(0, maxUsers)

  const periodEnd = now
  const weeklyStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthlyStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000)

  for (const userId of userIds) {
    if (runWeekly) {
      try {
        const r = await processOneUser(sb, {
          kind: 'weekly',
          userId,
          periodStart: weeklyStart,
          periodEnd,
          titleFormatter: (s, e) =>
            `5PM Somewhere • Weekly Montage ${s.toISOString().slice(0, 10)}–${e.toISOString().slice(0, 10)}`,
          pickMoments: async () => {
            const { data, error } = await sb
              .from('moments')
              .select('id, video_url, created_at, pretty_count, funny_count, cheers_count, duration')
              .eq('user_id', userId)
              .gte('created_at', weeklyStart.toISOString())
              .lt('created_at', periodEnd.toISOString())
              .order('created_at', { ascending: true })
            if (error) throw error
            return data ?? []
          },
        })
        results.weekly.push(r)
      } catch (e) {
        results.errors.push({ userId, kind: 'weekly', message: String(e?.message || e) })
      }
    }
    if (runMonthly) {
      try {
        const r = await processOneUser(sb, {
          kind: 'monthly',
          userId,
          periodStart: monthlyStart,
          periodEnd,
          titleFormatter: (s, _e) =>
            `5PM Somewhere • Monthly Highlights ${s.toISOString().slice(0, 7)}`,
          pickMoments: async () => {
            const { data, error } = await sb
              .from('moments')
              .select('id, video_url, created_at, pretty_count, funny_count, cheers_count, duration')
              .eq('user_id', userId)
              .gte('created_at', monthlyStart.toISOString())
              .lt('created_at', periodEnd.toISOString())
            if (error) throw error
            const rows = data ?? []
            rows.sort(
              (a, b) =>
                (Number(b.pretty_count) + Number(b.funny_count) + Number(b.cheers_count)) -
                (Number(a.pretty_count) + Number(a.funny_count) + Number(a.cheers_count)),
            )
            return rows.slice(0, 6)
          },
        })
        results.monthly.push(r)
      } catch (e) {
        results.errors.push({ userId, kind: 'monthly', message: String(e?.message || e) })
      }
    }
  }

  return res.status(200).json({ ok: true, type, processedUsers: userIds.length, ...results })
}

async function processOneUser(sb, opts) {
  const { kind, userId, periodStart, periodEnd, titleFormatter, pickMoments } = opts
  let moments = await pickMoments()
  moments = moments.filter((m) => m.video_url)
  if (moments.length < 3) {
    return { userId, skipped: true, reason: 'fewer_than_3_clips', count: moments.length }
  }

  const { data: existing } = await sb
    .from('user_montages')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('period_start', periodStart.toISOString())
    .maybeSingle()
  if (existing) {
    return { userId, skipped: true, reason: 'already_exists' }
  }

  const dom = dominantReactionType(moments)
  const musicPath = await pickMusicPath(sb, dom)

  const { data: ins, error: insErr } = await sb
    .from('user_montages')
    .insert({
      user_id: userId,
      kind,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      title: titleFormatter(periodStart, periodEnd),
      dominant_reaction: dom,
      music_track_path: musicPath,
      status: 'processing',
    })
    .select('id')
    .single()
  if (insErr) throw insErr
  const montageId = ins.id

  const tmp = path.join(os.tmpdir(), `montage-${montageId}-${crypto.randomBytes(4).toString('hex')}`)
  await fs.mkdir(tmp, { recursive: true })

  try {
    const n = moments.length
    const clipTarget = Math.min(8, Math.max(4, 30 / n))
    const segments = []
    for (let i = 0; i < moments.length; i++) {
      const raw = path.join(tmp, `raw-${i}.bin`)
      const seg = path.join(tmp, `seg-${i}.mp4`)
      await downloadToFile(moments[i].video_url, raw)
      await trimSegment(ffmpegPath, raw, seg, clipTarget)
      segments.push(seg)
    }

    const concatPath = path.join(tmp, 'concat.mp4')
    await concatSegments(ffmpegPath, segments, concatPath)

    const titledPath = path.join(tmp, 'final.mp4')
    const titleLine = titleFormatter(periodStart, periodEnd)
    await addMusicTitle(ffmpegPath, concatPath, musicPath, sb, titleLine, titledPath)

    const stat = await fs.stat(titledPath)
    const objectPath = `${userId}/${kind}-${periodStart.toISOString().slice(0, 10)}-${montageId.slice(0, 8)}.mp4`
    const fileBuf = await fs.readFile(titledPath)
    const { error: upErr } = await sb.storage.from('montages').upload(objectPath, fileBuf, {
      contentType: 'video/mp4',
      upsert: true,
    })
    if (upErr) throw upErr

    const { data: signed, error: signErr } = await sb.storage
      .from('montages')
      .createSignedUrl(objectPath, 3600)
    if (signErr || !signed?.signedUrl) throw signErr || new Error('signed URL failed')

    const asset = await muxCreateAssetFromUrl(signed.signedUrl)
    const assetId = asset.id
    const ready = await waitForMuxReady(assetId)
    const playbackId = ready.playback_ids?.find((p) => p.policy === 'public')?.id
    const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null

    await sb
      .from('user_montages')
      .update({
        status: 'ready',
        mux_asset_id: assetId,
        mux_playback_id: playbackId ?? null,
        playback_url: playbackUrl,
        duration_sec: 30,
        error_message: null,
      })
      .eq('id', montageId)

    return {
      userId,
      montageId,
      playback_url: playbackUrl,
      bytes: stat.size,
    }
  } catch (e) {
    await sb
      .from('user_montages')
      .update({
        status: 'failed',
        error_message: String(e?.message || e).slice(0, 2000),
      })
      .eq('id', montageId)
    throw e
  } finally {
    try {
      await fs.rm(tmp, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

function isMainModule() {
  try {
    const a = process.argv[1]
    if (!a) return false
    return path.normalize(path.resolve(a)) === path.normalize(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMainModule()) {
  const port = Number(process.env.PORT || 8787)
  http
    .createServer((req, res) => {
      const authHeader = req.headers.authorization
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Method not allowed' }))
        return
      }
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        void (async () => {
          try {
            let body = {}
            const raw = Buffer.concat(chunks).toString('utf8')
            if (raw) {
              try {
                body = JSON.parse(raw)
              } catch {
                body = {}
              }
            }
            const vercelRes = {
              _code: 200,
              status(c) {
                this._code = c
                return this
              },
              json(o) {
                if (!res.headersSent) {
                  res.writeHead(this._code, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify(o))
                }
              },
            }
            await handler(
              { method: 'POST', headers: { authorization: authHeader, Authorization: authHeader }, body },
              vercelRes,
            )
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'No response from handler' }))
            }
          } catch (e) {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: String(e?.message || e) }))
            }
          }
        })()
      })
    })
    .listen(port, () => {
      console.error(`[montage-worker] http://127.0.0.1:${port} POST {"type":"weekly"}`)
    })
}
