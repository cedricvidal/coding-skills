import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { assembleBeats, createTimeline } from './assemble-beats.mjs';
import {
  abortable, isMain, launchBrowser, parseFlags, requireTool, writeJson,
} from './runtime.mjs';

export { launchBrowser };
export const captureDefaults = {
  viewport: { width: 1440, height: 900 },
  screen: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
};

function supportedPlatform() {
  if (!['darwin', 'linux'].includes(process.platform)) {
    throw new Error('terminal-recording supports macOS and Linux.');
  }
}

function isolatedEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('BASH_FUNC_') || ['BASH_ENV', 'ENV', 'SHELLOPTS', 'BASHOPTS', 'PROMPT_COMMAND', 'PS4'].includes(key)) {
      delete env[key];
    }
  }
  return { ...env, INPUTRC: '/dev/null', HISTFILE: '/dev/null' };
}

export async function createTerminalSession({
  page, outDir, cwd = process.cwd(), ttydPath = 'ttyd', bashPath = 'bash',
  timeoutMs = 15_000, preparePage, signal,
}) {
  supportedPlatform();
  if (!page || page.isClosed() || page.url() !== 'about:blank') {
    throw new Error('Supply a fresh about:blank terminal page. Existing app pages will not be navigated away.');
  }
  if (!outDir) throw new Error('outDir is required for terminal diagnostics.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be positive.');
  cwd = resolve(cwd);
  if (!(await stat(cwd)).isDirectory()) throw new Error(`Not a working directory: ${cwd}`);
  requireTool(ttydPath);
  requireTool(bashPath);
  await mkdir(outDir, { recursive: true });
  const logPath = join(resolve(outDir), `ttyd-${randomUUID()}.log`);
  const child = spawn(ttydPath, [
    '-i', '127.0.0.1', '-p', '0', '-O', '-W', '-m', '1', '-o',
    '-t', 'rendererType=dom', '-t', 'fontSize=26',
    '-t', 'fontFamily=Menlo,Consolas,DejaVu Sans Mono,Liberation Mono,monospace',
    '-t', 'theme={"background":"#0b1020","foreground":"#e2e8f0"}',
    bashPath, '--noprofile', '--rcfile', fileURLToPath(new URL('./terminal.bashrc', import.meta.url)), '-i',
  ], { cwd, env: isolatedEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  let spawnError;
  let closed = false;
  let cleanup;
  const exited = new Promise(done => child.once('close', () => { closed = true; done(); }));
  child.on('error', error => { spawnError = error; });
  const collect = data => { log = (log + data.toString()).slice(-1024 * 1024); };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const connections = { opened: 0, closed: 0 };
  const sockets = new Map();
  const onSocket = socket => {
    connections.opened++;
    const listener = () => { connections.closed++; };
    sockets.set(socket, listener);
    socket.on('close', listener);
  };
  page.on('websocket', onSocket);
  function healthy() {
    signal?.throwIfAborted();
    if (spawnError || closed || child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Owned ttyd stopped unexpectedly. See ${logPath}\n${log}`, { cause: spawnError });
    }
  }
  async function close() {
    if (!cleanup) cleanup = (async () => {
      page.off('websocket', onSocket);
      for (const [socket, listener] of sockets) socket.off('close', listener);
      if (!closed && child.pid) {
        child.kill('SIGTERM');
        await Promise.race([exited, sleep(3000)]);
        if (!closed) {
          child.kill('SIGKILL');
          await exited;
          await writeFile(logPath, log);
          throw new Error(`ttyd needed forced termination (PID ${child.pid}). Inspect ${logPath} and scenario child processes.`);
        }
      }
      await writeFile(logPath, log);
    })();
    return cleanup;
  }
  async function waitForText(pattern, { timeout = timeoutMs } = {}) {
    if (typeof pattern !== 'string' && !(pattern instanceof RegExp)) {
      throw new Error('waitForText requires a string or RegExp.');
    }
    healthy();
    const spec = pattern instanceof RegExp
      ? { source: pattern.source, flags: pattern.flags.replace(/[gy]/g, '') }
      : { text: pattern };
    try {
      await abortable(page.waitForFunction(spec => {
        const rows = document.querySelector('.xterm-rows');
        const text = rows ? Array.from(rows.children, row => row.textContent).join('\n') : '';
        return spec.text !== undefined ? text.includes(spec.text) : new RegExp(spec.source, spec.flags).test(text);
      }, spec, { timeout }), signal);
    } catch (error) {
      throw new Error(`Terminal did not reach expected text ${pattern} within ${timeout}ms. See ${logPath}.`, { cause: error });
    }
    healthy();
  }
  try {
    const deadline = Date.now() + timeoutMs;
    let port;
    while (Date.now() < deadline) {
      healthy();
      const match = log.match(/Listening on port:\s*(\d+)/);
      if (match) { port = Number(match[1]); break; }
      await sleep(50, undefined, { signal });
    }
    if (!port) throw new Error(`ttyd did not report an allocated loopback port within ${timeoutMs}ms. See ${logPath}.`);
    const url = `http://127.0.0.1:${port}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`ttyd readiness HTTP ${response.status}: ${url}`);
    await response.arrayBuffer();
    healthy();
    if (preparePage) await abortable(preparePage({ page, context: page.context() }), signal);
    await abortable(page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs }), signal);
    try {
      await abortable(page.waitForFunction(() =>
        document.querySelector('.xterm-screen canvas') ||
        document.querySelector('.xterm-rows')?.textContent.trim(), undefined, { timeout: timeoutMs }), signal);
    } catch (error) {
      throw new Error('ttyd did not expose xterm.js DOM rows. Use a ttyd build supporting -t rendererType=dom.', { cause: error });
    }
    if (await page.locator('.xterm-screen canvas').count()) {
      throw new Error('ttyd selected a canvas/WebGL renderer instead of usable DOM rows. Use a ttyd build supporting -t rendererType=dom.');
    }
    await waitForText(/^demo \$\s*$/m);
    const terminal = {
      page, context: page.context(), url, pid: child.pid, logPath, connections,
      close, waitForText,
      async text() {
        healthy();
        return page.locator('.xterm-rows > div').allTextContents().then(rows => rows.join('\n'));
      },
      async type(text, { delay = 25 } = {}) {
        healthy();
        await page.locator('.xterm-helper-textarea').focus();
        await page.keyboard.type(text, { delay });
      },
      async key(key) {
        healthy();
        await page.locator('.xterm-helper-textarea').focus();
        await page.keyboard.press(key);
      },
      async command(command, { until, delay = 25, timeout = timeoutMs } = {}) {
        if (!until) throw new Error('command requires { until: stringOrRegExp } for output-based readiness.');
        if (typeof command !== 'string' || /[\r\n]/.test(command)) throw new Error('command must be a single shell input line.');
        await terminal.type(command, { delay });
        await terminal.key('Enter');
        await waitForText(until, { timeout });
      },
      async screenshot(name = 'terminal.png') {
        healthy();
        if (!/^[a-zA-Z0-9_.-]+\.png$/.test(name)) throw new Error('Screenshot name must be a simple .png filename.');
        const path = join(resolve(outDir), name);
        await page.screenshot({ path, fullPage: false });
        return path;
      },
    };
    return terminal;
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Terminal startup and cleanup failed.');
    }
    throw error;
  }
}

export async function recordTerminal({
  scenarioPath, outDir, cwd = process.cwd(), playwrightPath, executablePath, channel,
  ttydPath = 'ttyd', bashPath = 'bash', ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', signal,
}) {
  supportedPlatform();
  if (!scenarioPath || !outDir) throw new Error('scenarioPath and outDir are required.');
  requireTool(ffmpeg, '-version');
  requireTool(ffprobe, '-version');
  requireTool(ttydPath);
  requireTool(bashPath);
  const scenario = await import(pathToFileURL(resolve(scenarioPath)).href);
  if (typeof scenario.run !== 'function') throw new Error('Scenario must export async function run({ terminal, page, context, beat, outDir }).');
  for (const hook of ['prepareContext', 'preparePage']) {
    if (scenario[hook] !== undefined && typeof scenario[hook] !== 'function') throw new Error(`Scenario ${hook} must be a function.`);
  }
  // A new directory prevents a failed take from being mistaken for an older success.
  outDir = resolve(outDir);
  await mkdir(outDir, { recursive: false });
  let browser;
  let context;
  let terminal;
  let result;
  const failures = [];
  const cleanupErrors = [];
  try {
    signal?.throwIfAborted();
    browser = await launchBrowser({ playwrightPath, executablePath, channel, cwd });
    signal?.throwIfAborted();
    context = await browser.newContext({
      ...captureDefaults, recordVideo: { dir: join(outDir, 'sources'), size: captureDefaults.viewport },
    });
    if (scenario.prepareContext) await abortable(scenario.prepareContext({ context, outDir }), signal);
    const page = await context.newPage();
    terminal = await createTerminalSession({
      page, outDir, cwd, ttydPath, bashPath, signal,
      preparePage: scenario.preparePage && (args => scenario.preparePage({ ...args, outDir })),
    });
    const timeline = await createTimeline({ views: { terminal: page }, manifestPath: join(outDir, 'beats.json'), ffmpeg });
    console.log(`Visual guidance: ${scenario.prepareContext || scenario.preparePage ? 'scenario preparation hooks configured; inspect rendered cues' : 'no preparation hooks configured; no built-in captions or highlights'}`);
    await abortable(scenario.run({
      terminal, page, context, outDir,
      beat: action => timeline.beat('terminal', action),
    }), signal);
    await timeline.finish();
    await context.close();
    context = undefined;
    await terminal.close();
    await browser.close();
    browser = undefined;
    signal?.throwIfAborted();
    result = await assembleBeats({
      manifestPath: timeline.manifestPath, outputPath: join(outDir, 'terminal.mp4'), ffmpeg, ffprobe,
    });
    signal?.throwIfAborted();
    await writeJson(join(outDir, 'result.json'), {
      status: 'success', output: result.outputPath, media: result.media,
      manifest: timeline.manifestPath, ttydLog: terminal.logPath,
      preparationHooks: { context: Boolean(scenario.prepareContext), page: Boolean(scenario.preparePage) },
    });
  } catch (error) {
    failures.push(error);
  } finally {
    // Closing the owned context flushes video before the terminal server stops.
    for (const release of [
      () => context?.close(), () => terminal?.close(), () => browser?.close(),
    ]) {
      try { await release(); } catch (error) { cleanupErrors.push(error); }
    }
  }
  if (failures.length || cleanupErrors.length) {
    const errors = [...failures, ...cleanupErrors];
    await writeJson(join(outDir, 'failure.json'), {
      status: 'failed', errors: errors.map(error => error.stack ?? String(error)),
      cleanupErrors: cleanupErrors.length,
    });
    throw new AggregateError(errors, `Recording failed. Sources and diagnostics retained in ${outDir}.`);
  }
  return result;
}

if (isMain(import.meta.url)) {
  const controller = new AbortController();
  const interrupt = signal => controller.abort(new Error(`Recording interrupted by ${signal}`));
  const onInt = () => interrupt('SIGINT');
  const onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  try {
    const flags = parseFlags(process.argv.slice(2), [
      '--scenario', '--out', '--cwd', '--playwright', '--browser', '--channel',
      '--ttyd', '--bash', '--ffmpeg', '--ffprobe',
    ]);
    if (flags.help) {
      console.log('node record-terminal.mjs --scenario /path/scenario.mjs --out /path/new-take [--cwd DIR]\n  [--playwright /path/playwright/index.mjs] [--browser EXECUTABLE | --channel chrome]\n  [--ttyd PATH] [--bash PATH] [--ffmpeg PATH] [--ffprobe PATH]\nHeadless by default. No automatic installation. The output directory must not exist.');
    } else {
      const result = await recordTerminal({
        scenarioPath: flags['--scenario'], outDir: flags['--out'], cwd: flags['--cwd'],
        playwrightPath: flags['--playwright'], executablePath: flags['--browser'], channel: flags['--channel'],
        ttydPath: flags['--ttyd'], bashPath: flags['--bash'], ffmpeg: flags['--ffmpeg'], ffprobe: flags['--ffprobe'],
        signal: controller.signal,
      });
      console.log(`Saved ${result.outputPath}`);
    }
  } catch (error) {
    console.error(error.stack);
    for (const cause of error.errors ?? [error.cause].filter(Boolean)) console.error(cause.stack);
    process.exitCode = controller.signal.aborted ? 130 : 1;
  } finally {
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
  }
}
