// Pulls still frames out of a travel video so Claude can read on-screen text
// ("📍 Kioto") and recognise landmarks. Uses the ffmpeg binary from ffmpeg-static.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

function run(args: string[], timeoutMs = 20000): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg not available"));
    execFile(ffmpegPath as unknown as string, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(Object.assign(err, { stderr: String(stderr) }));
      else resolve({ stderr: String(stderr) });
    });
  });
}

/** Seconds from ffmpeg's banner ("Duration: 00:01:29.50"). */
export function parseDuration(stderr: string): number | null {
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** Evenly spread timestamps, skipping the very first/last moments (intros, end cards). Exported for tests. */
export function frameTimes(duration: number, count: number): number[] {
  if (!(duration > 0)) return [0];
  const n = Math.max(1, Math.min(count, Math.floor(duration / 1.5) || 1));
  if (n === 1) return [Math.min(duration * 0.3, duration)];
  return Array.from({ length: n }, (_, i) => Math.round((duration * (0.04 + (0.92 * i) / (n - 1))) * 100) / 100);
}

export interface Frame { at: number; jpeg: Buffer }

/** Extracts `count` frames, 512 px wide JPEG, from an in-memory video. */
export async function framesFromVideo(video: Buffer, count = 8, knownDuration?: number): Promise<Frame[]> {
  const dir = await mkdtemp(join(tmpdir(), "gt-"));
  try {
    const input = join(dir, "in.mp4");
    await writeFile(input, video);
    let duration = knownDuration && knownDuration > 0 ? knownDuration : null;
    if (!duration) {
      // `ffmpeg -i` with no output exits non-zero but prints the duration
      const probe = await run(["-hide_banner", "-i", input]).catch((e) => ({ stderr: e.stderr || "" }));
      duration = parseDuration(probe.stderr) ?? 30;
    }
    const times = frameTimes(duration, count);
    const frames: Frame[] = [];
    // A few at a time: each seek is fast, but serverless CPUs are small.
    for (let i = 0; i < times.length; i += 3) {
      const batch = times.slice(i, i + 3).map(async (t, j) => {
        const out = join(dir, `f${i + j}.jpg`);
        await run(["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", input, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "6", "-y", out]);
        return { at: t, jpeg: await readFile(out) };
      });
      for (const r of await Promise.allSettled(batch)) if (r.status === "fulfilled" && r.value.jpeg.length > 500) frames.push(r.value);
    }
    return frames;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Re-encodes any image (webp, heic, huge jpeg) to a 512 px JPEG. */
export async function normalizeImage(img: Buffer): Promise<Buffer | null> {
  const dir = await mkdtemp(join(tmpdir(), "gt-"));
  try {
    const input = join(dir, "in.img"), out = join(dir, "out.jpg");
    await writeFile(input, img);
    await run(["-hide_banner", "-loglevel", "error", "-i", input, "-frames:v", "1", "-vf", "scale='min(512,iw)':-2", "-q:v", "6", "-y", out]);
    return await readFile(out);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
