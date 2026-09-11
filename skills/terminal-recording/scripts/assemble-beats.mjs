import { link, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  absoluteMediaPath, isMain, mediaInfo, parseFlags, requireTool, runTool, writeJson,
} from './runtime.mjs';

const isMarker = (red, green, blue) => red > 230 && green < 25 && blue > 230;

export function scanMarkers(video, ffmpeg = 'ffmpeg') {
  const pixels = runTool(ffmpeg, [
    '-v', 'error', '-i', video, '-map', '0:v:0', '-vf', 'scale=1:1:flags=area',
    '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
  ], { encoding: null });
  if (!pixels.length || pixels.length % 3) throw new Error(`Incomplete RGB frame scan: ${video}`);
  const ranges = [];
  let range;
  for (let frame = 0; frame < pixels.length / 3; frame++) {
    const marked = isMarker(...pixels.subarray(frame * 3, frame * 3 + 3));
    if (marked && !range) range = { start: frame, end: frame + 1 };
    else if (marked) range.end = frame + 1;
    else if (range) { ranges.push(range); range = undefined; }
  }
  if (range) ranges.push(range);
  return { ranges, totalFrames: pixels.length / 3 };
}

async function marker(page, screenshotPath, ffmpeg) {
  const id = `capture-sync-${randomUUID()}`;
  await page.evaluate(id => {
    const node = document.createElement('div');
    node.id = id;
    node.style.cssText = 'position:fixed;inset:0;background:rgb(255,0,255);z-index:2147483647;pointer-events:none';
    document.documentElement.appendChild(node);
  }, id);
  try {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const png = await page.screenshot({ path: screenshotPath, fullPage: false });
    const pixel = runTool(ffmpeg, [
      '-v', 'error', '-i', 'pipe:0', '-vf', 'scale=1:1:flags=area', '-frames:v', '1',
      '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
    ], { input: png, encoding: null });
    if (pixel.length !== 3 || !isMarker(...pixel)) {
      throw new Error(`Synchronization marker did not cover the painted viewport: ${screenshotPath}`);
    }
    await page.waitForTimeout(800);
  } finally {
    if (!page.isClosed()) await page.evaluate(id => document.getElementById(id)?.remove(), id);
  }
  await page.waitForTimeout(120);
}

// This tracks selected views, never browser focus. Every boundary is measured
// again in the encoded video, independently of wall clocks and other pages.
export async function createTimeline({ views, manifestPath, ffmpeg = 'ffmpeg' }) {
  requireTool(ffmpeg, '-version');
  manifestPath = resolve(manifestPath);
  const sources = Object.create(null);
  for (const [name, page] of Object.entries(views)) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name) || !page.video()) {
      throw new Error(`View ${name} needs a safe name and a page created with recordVideo.`);
    }
    if (Object.values(views).filter(candidate => candidate === page).length !== 1) {
      throw new Error('Each view must refer to a different persistent page.');
    }
    sources[name] = { path: await page.video().path(), markerCount: 0 };
  }
  if (!Object.keys(sources).length) throw new Error('At least one recorded view is required.');
  await mkdir(dirname(manifestPath), { recursive: true });
  const manifest = { version: 1, status: 'recording', fps: 25, sources, beats: [] };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  const markerDir = await mkdtemp(join(dirname(manifestPath), 'markers-'));
  const save = () => writeJson(manifestPath, manifest);
  let busy = false;
  let finished = false;
  async function boundary(view) {
    const index = sources[view].markerCount++;
    await save();
    await marker(views[view], join(markerDir, `${view}-${index}.png`), ffmpeg);
    return index;
  }
  return {
    manifestPath,
    async beat(view, action) {
      if (busy || finished || manifest.status !== 'recording') throw new Error('Beats must run sequentially on an unfinished, healthy timeline.');
      if (!Object.hasOwn(sources, view) || typeof action !== 'function') throw new Error(`Invalid beat for view ${view}`);
      busy = true;
      try {
        const startMarker = await boundary(view);
        await action();
        const endMarker = await boundary(view);
        manifest.beats.push({ view, startMarker, endMarker });
        await save();
      } catch (error) {
        manifest.status = 'failed';
        manifest.error = error.stack ?? String(error);
        await save();
        throw error;
      } finally {
        busy = false;
      }
    },
    async finish() {
      if (busy || finished || manifest.status !== 'recording' || !manifest.beats.length) {
        throw new Error('Cannot finish an active, failed, empty, or already finished timeline.');
      }
      finished = true;
      manifest.status = 'captured';
      await save();
      return manifestPath;
    },
  };
}

export async function assembleBeats({ manifestPath, outputPath, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' }) {
  requireTool(ffmpeg, '-version');
  requireTool(ffprobe, '-version');
  manifestPath = resolve(manifestPath);
  outputPath = resolve(outputPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.version !== 1 || manifest.status !== 'captured' || manifest.fps !== 25 ||
      !manifest.sources || !Array.isArray(manifest.beats) || !manifest.beats.length) {
    throw new Error('Expected a captured version-1, 25fps beat manifest. Finish capture and close its context before assembly.');
  }
  const names = Object.keys(manifest.sources);
  const inputs = [];
  const measured = Object.create(null);
  let shape;
  for (const [index, name] of names.entries()) {
    const source = manifest.sources[name];
    if (typeof source.path !== 'string' || !Number.isInteger(source.markerCount) || source.markerCount < 0) {
      throw new Error(`Invalid source ${name}`);
    }
    const path = absoluteMediaPath(source.path, manifestPath);
    const info = mediaInfo(path, ffprobe);
    if (info.r_frame_rate !== '25/1' || info.avg_frame_rate !== '25/1' ||
        !info.width || !info.height || info.width % 2 || info.height % 2) {
      throw new Error(`Source ${name} must have constant 25fps and even dimensions: ${JSON.stringify(info)}`);
    }
    const dimensions = `${info.width}x${info.height}`;
    if (shape && dimensions !== shape) throw new Error(`Source dimensions differ: ${shape} vs ${dimensions}`);
    shape = dimensions;
    const scan = scanMarkers(path, ffmpeg);
    if (scan.totalFrames !== Number(info.nb_read_frames) || scan.ranges.length !== source.markerCount ||
        scan.ranges.some(range => range.end - range.start < 8)) {
      throw new Error(`Missing or ambiguous synchronization markers for ${name}: expected ${source.markerCount}, measured ${JSON.stringify(scan)}`);
    }
    measured[name] = { index, path, info, ...scan };
    inputs.push('-i', path);
  }
  const used = new Set();
  const previous = Object.create(null);
  let totalFrames = 0;
  const beats = manifest.beats.map(beat => {
    const source = measured[beat.view];
    if (!source || !Number.isInteger(beat.startMarker) || !Number.isInteger(beat.endMarker) ||
        beat.endMarker !== beat.startMarker + 1 || beat.startMarker <= (previous[beat.view] ?? -1)) {
      throw new Error(`Invalid or overlapping beat: ${JSON.stringify(beat)}`);
    }
    const start = source.ranges[beat.startMarker]?.end;
    const end = source.ranges[beat.endMarker]?.start;
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
      throw new Error(`No clean frames in beat: ${JSON.stringify(beat)}`);
    }
    previous[beat.view] = beat.endMarker;
    used.add(`${beat.view}:${beat.startMarker}`);
    used.add(`${beat.view}:${beat.endMarker}`);
    const result = { ...beat, startFrame: start, endFrame: end, frames: end - start, outputStartFrame: totalFrames };
    totalFrames += result.frames;
    return result;
  });
  if (used.size !== names.reduce((count, name) => count + manifest.sources[name].markerCount, 0)) {
    throw new Error('Manifest has unpaired or unselected synchronization boundaries.');
  }
  await mkdir(dirname(outputPath), { recursive: true });
  const workDir = await mkdtemp(join(dirname(outputPath), 'assembly-'));
  const candidate = join(workDir, 'candidate.mp4');
  const report = { manifestPath, outputPath, fps: 25, totalFrames, measured, beats };
  await writeJson(join(workDir, 'alignment.json'), report);
  const filters = beats.map((beat, index) =>
    `[${measured[beat.view].index}:v]trim=start_frame=${beat.startFrame}:end_frame=${beat.endFrame},setpts=N/(25*TB)[b${index}]`
  ).join(';') + `;${beats.map((_, index) => `[b${index}]`).join('')}concat=n=${beats.length}:v=1:a=0[v]`;
  try {
    runTool(ffmpeg, [
      '-n', '-v', 'error', ...inputs, '-filter_complex', filters, '-map', '[v]', '-an',
      '-r', '25', '-frames:v', String(totalFrames), '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', candidate,
    ]);
    const media = mediaInfo(candidate, ffprobe);
    const scan = scanMarkers(candidate, ffmpeg);
    if (media.codec_name !== 'h264' || media.pix_fmt !== 'yuv420p' ||
        `${media.width}x${media.height}` !== shape || media.r_frame_rate !== '25/1' ||
        Number(media.nb_read_frames) !== totalFrames || scan.totalFrames !== totalFrames ||
        Math.abs(media.duration - totalFrames / 25) > 0.001 || scan.ranges.length) {
      throw new Error(`Assembled media failed frame/format/marker validation: ${JSON.stringify({ media, scan })}`);
    }
    await writeJson(join(workDir, 'alignment.json'), { ...report, media });
    // Hard links publish complete artifacts without overwriting any existing file.
    await link(join(workDir, 'alignment.json'), `${outputPath}.json`);
    try {
      await link(candidate, outputPath);
    } catch (error) {
      await unlink(`${outputPath}.json`);
      throw error;
    }
    await rm(workDir, { recursive: true });
    return { ...report, media };
  } catch (error) {
    throw new Error(`Assembly failed; sources and manifest are unchanged. Diagnostics: ${workDir}. ${error.message}`, { cause: error });
  }
}

if (isMain(import.meta.url)) {
  try {
    const flags = parseFlags(process.argv.slice(2), ['--manifest', '--out', '--ffmpeg', '--ffprobe']);
    if (flags.help) {
      console.log('node assemble-beats.mjs --manifest /path/beats.json --out /path/demo.mp4 [--ffmpeg PATH] [--ffprobe PATH]\nClose the capture context first. Existing outputs are never overwritten.');
    } else {
      if (!flags['--manifest'] || !flags['--out']) throw new Error('--manifest and --out are required. Use --help.');
      const result = await assembleBeats({
        manifestPath: flags['--manifest'], outputPath: flags['--out'],
        ffmpeg: flags['--ffmpeg'], ffprobe: flags['--ffprobe'],
      });
      console.log(`${result.outputPath}: ${result.totalFrames} frames at 25fps`);
    }
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  }
}
