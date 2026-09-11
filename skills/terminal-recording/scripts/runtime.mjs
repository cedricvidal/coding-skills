import { spawnSync } from 'node:child_process';
import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export function runTool(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120_000, ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message ?? result.stderr ?? result.signal}`, {
      cause: result.error,
    });
  }
  return result.stdout;
}

export function requireTool(command, versionFlag = '--version') {
  try {
    runTool(command, [versionFlag]);
  } catch (error) {
    throw new Error(`Cannot use ${command}. Install the missing tool explicitly (Homebrew first if available), or supply its executable path. Nothing was installed.`, { cause: error });
  }
  return command;
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, path);
}

export async function loadChromium({ playwrightPath, cwd = process.cwd() } = {}) {
  let modulePath;
  if (playwrightPath) {
    modulePath = resolve(playwrightPath);
  } else {
    const locations = [resolve(cwd, 'package.json'), import.meta.url];
    for (const location of locations) {
      try {
        modulePath = createRequire(location).resolve('playwright');
        break;
      } catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') throw error;
      }
    }
  }
  if (!modulePath) {
    throw new Error('Playwright is missing. Reuse an installed package with --playwright /absolute/path/to/playwright/index.mjs, or install it explicitly in a scratch directory.');
  }
  const module = await import(pathToFileURL(modulePath).href);
  const chromium = module.chromium ?? module.default?.chromium;
  if (!chromium?.launch) throw new Error(`No Playwright chromium export in ${modulePath}`);
  return chromium;
}

export async function launchBrowser({ playwrightPath, executablePath, channel, cwd, headless = true } = {}) {
  if (executablePath && channel) throw new Error('Choose either executablePath or channel, not both.');
  const chromium = await loadChromium({ playwrightPath, cwd });
  const options = { headless };
  if (channel) {
    options.channel = channel;
  } else {
    options.executablePath = executablePath ? resolve(executablePath) : chromium.executablePath();
    try {
      await access(options.executablePath, constants.X_OK);
    } catch (error) {
      throw new Error(`Chrome/Chromium is missing or not executable: ${options.executablePath}. Supply --browser, --channel chrome, or explicitly install the matching Playwright Chromium. No browser was downloaded.`, { cause: error });
    }
  }
  console.log(`Browser: ${options.executablePath ?? `channel ${channel}`} (headless: ${headless})`);
  const browser = await chromium.launch(options);
  console.log(`Browser version: ${browser.version()}`);
  return browser;
}

export function parseFlags(args, allowed) {
  const flags = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--help') return { help: true };
    if (!allowed.includes(key) || !args[index + 1] || args[index + 1].startsWith('--') || key in flags) {
      throw new Error(`Invalid or repeated option ${key}. Use --help.`);
    }
    flags[key] = args[++index];
  }
  return flags;
}

export function isMain(url) {
  return process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url;
}

export function mediaInfo(path, ffprobe = 'ffprobe') {
  const info = JSON.parse(runTool(ffprobe, [
    '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries',
    'stream=codec_name,pix_fmt,width,height,r_frame_rate,avg_frame_rate,nb_read_frames:format=duration',
    '-of', 'json', path,
  ]));
  if (info.streams?.length !== 1) throw new Error(`Expected one video stream: ${path}`);
  return { ...info.streams[0], duration: Number(info.format.duration) };
}

export function absoluteMediaPath(path, manifestPath) {
  return isAbsolute(path) ? path : resolve(dirname(manifestPath), path);
}

export async function abortable(promise, signal) {
  if (!signal) return promise;
  let listener;
  const interrupted = new Promise((_, reject) => {
    listener = () => reject(signal.reason);
    if (signal.aborted) listener();
    else signal.addEventListener('abort', listener, { once: true });
  });
  try {
    return await Promise.race([promise, interrupted]);
  } finally {
    signal.removeEventListener('abort', listener);
  }
}
