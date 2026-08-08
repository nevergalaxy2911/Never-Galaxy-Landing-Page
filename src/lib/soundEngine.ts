/* -----------------------------------------------------------------------------
 * soundEngine — tiny synthesised audio layer (no audio files, no network).
 *
 * WHY SYNTHESISED: three mp3s would be ~150-400KB of extra download for
 * decoration. Every sound here is generated with the Web Audio API at runtime,
 * so the whole feature costs a few hundred bytes of JS and zero requests.
 *
 * BROWSER RULE: an AudioContext cannot start until the user interacts with the
 * page. `ensureContext()` is therefore only ever called from a real gesture
 * (a click, or the toggle itself), and `unlockOnFirstGesture()` resumes a
 * suspended context the first time the visitor touches the page.
 *
 * SOUNDS
 *   playClick()      → 18ms sine blip, very quiet. Fired on button/link presses.
 *   cursor wind      → ONE looping noise voice whose loudness + brightness
 *                      follow cursor speed. Never re-triggered, so it can never
 *                      click or cut: every change is a smooth parameter ramp.
 *   ambience         → wide, airy "space pad": pure sines in a soft chord,
 *                      slowly drifting detune + a breath of filtered noise.
 *                      No triangle/saw waves — those are what sounded machiney.
 *
 * HOW TO MODIFY
 *   • Volume         → MASTER_GAIN, and the per-sound gain values below.
 *   • Click tone     → CLICK_FREQ / CLICK_MS.
 *   • Wind character → WIND_GAIN_MAX, WIND_FREQ_MIN/MAX, WIND_RAMP_S.
 *   • Ambient track  → src/assets/ambient-space.mp3.asset.json, AMBIENCE_GAIN_MUSIC.
 * --------------------------------------------------------------------------- */

const MASTER_GAIN = 0.5;
const CLICK_FREQ = 880;
const CLICK_MS = 18;

// --- cursor wind -------------------------------------------------------------
const WIND_GAIN_MAX = 0.062; // loudness at full motion speed (2026-07-29: softened,
// the previous 0.095 was piercing on headphones)
const WIND_FREQ_MIN = 320; // bandpass centre when barely moving (Hz)
const WIND_FREQ_MAX = 1050; // bandpass centre at full speed (Hz) — lower = less hiss
const WIND_RAMP_S = 0.16; // time-constant of the speed → loudness smoothing
const WIND_FADE_IN_S = 1.6; // how long the wind takes to swell in when enabled
const WIND_FADE_OUT_S = 0.55; // how long it takes to disappear when disabled
// With the ambient pad running the wind has to compete with a constant bed of
// sound, so it is lifted by this factor whenever ambience is on. Applied on the
// user-gain stage as a smooth ramp, so switching ambience never clicks.
// HOW TO MODIFY: 1 = no boost, 2 = twice as loud alongside the pad.
const WIND_AMBIENCE_BOOST = 1.7;


// --- ambience ----------------------------------------------------------------
// Playback level of the ambient music track (post-master). 0..1.
// 2026-07-29: the level that used to be the "reduced audio" level is now the
// DEFAULT level (0.33 x 0.28), because the old default sat too loud over any
// video the visitor plays alongside the site.
// HOW TO MODIFY: raise toward 0.33 to go back to the old, louder pad.
const AMBIENCE_GAIN_MUSIC = 0.092;

// --- accessibility -----------------------------------------------------------
// Reduced audio now sits BELOW the (already quiet) default: the pad is
// multiplied by this again, and the wind channel is switched off entirely by
// SoundController. One-shot clicks stay untouched.
// HOW TO MODIFY: lower toward 0 for an even quieter reduced mode.
const REDUCED_AUDIO_FACTOR = 0.45;

// --- stereo ------------------------------------------------------------------
const PAN_MAX = 0.75; // hard-left/right limit; ±1 is uncomfortably extreme
const PAN_RAMP_S = 0.25; // smoothing on pan moves so panning never "jumps"

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let ambienceNodes: {
  nodes: AudioScheduledSourceNode[];
  gain: GainNode;
  panner: StereoPannerNode | null;
} | null = null;
let windNodes: {
  src: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode; // speed-driven (0..1 shaped by cursor motion)
  userGain: GainNode; // slider × reduced-audio multiplier
  envGain: GainNode; // fade-in / fade-out envelope so it never bursts in
  panner: StereoPannerNode | null;
} | null = null;

// Live, user-controlled state that both sounds read from.
let windUserLevel = 1; // fixed level (no slider any more)
let reducedAudio = false;
let spatialAudio = true;

/** Create a StereoPannerNode when the browser has one (Safari <14.1 doesn't). */
function makePanner(c: AudioContext): StereoPannerNode | null {
  try {
    return typeof c.createStereoPanner === "function" ? c.createStereoPanner() : null;
  } catch {
    return null;
  }
}

function windUserGainValue() {
  const boost = ambienceWanted ? WIND_AMBIENCE_BOOST : 1;
  // Cap above 1 on purpose: the boost must be able to actually lift the wind
  // over the pad instead of being clamped away.
  return Math.min(2.2, windUserLevel * boost) * (reducedAudio ? REDUCED_AUDIO_FACTOR : 1);
}

/** Re-apply the wind's user-gain stage (slider × ambience boost × reduced). */
function refreshWindUserGain(timeConstant = 0.35) {
  if (!ctx || !windNodes) return;
  windNodes.userGain.gain.setTargetAtTime(windUserGainValue(), ctx.currentTime, timeConstant);
}



function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Resume audio on the first real user gesture (autoplay-policy compliance).
 *
 * iOS NOTE: Safari only counts a *completed* touch as a gesture, and it can
 * refuse the very first resume() attempt. So we listen to several gesture
 * types and keep listening until the context is genuinely "running". */
export function unlockOnFirstGesture() {
  if (typeof window === "undefined") return () => {};
  const EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;
  const remove = () => EVENTS.forEach((e) => window.removeEventListener(e, unlock));
  const unlock = () => {
    const c = ensureContext();
    if (!c) return remove();
    void Promise.resolve(c.state === "suspended" ? c.resume() : undefined)
      .catch(() => {})
      .then(() => {
        if (c.state !== "running") return; // still blocked, wait for next gesture
        // A gesture that arrives after an iOS interruption may find the pad
        // wanted but silent — bring it back.
        resumeAudioAfterInterruption();
        remove();
      });
  };
  EVENTS.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
  return remove;
}

/**
 * Recover the audio graph after the OS/browser froze it (tab return, iOS phone
 * call, screen lock, Safari media interruption). Safe to call at any time:
 * it only acts when the visitor actually wants ambience.
 *
 * HOW TO MODIFY: nothing to tune. Called from SoundController on
 * visibilitychange / pageshow / focus.
 */
export function resumeAudioAfterInterruption() {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  if (!ambienceWanted || ambiencePausedForTab || ambienceNodes) return;
  const c = ensureContext();
  if (!c) return;
  void loadAmbienceBuffer(c).then((buffer) => {
    if (!buffer || !ambienceWanted || ambienceNodes || ambiencePausedForTab) return;
    spawnAmbience(buffer, Math.max(0, ambienceOffset - AMBIENCE_RESUME_REWIND_S), 0.8);
  });
}


/**
 * Looping noise buffer. Built once and reused. It is deliberately long (4s) and
 * lowpass-shaped ("pink-ish") so looping it is seamless — white noise loops of
 * <1s develop an audible periodic tick.
 */
function getNoise(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(c.sampleRate * 4);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // simple 1-pole smoothing = softer noise
    data[i] = last * 3.5;
  }
  // Crossfade the tail into the head so the loop point is inaudible.
  const fade = Math.floor(c.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[i] = data[i] * t + data[len - fade + i] * (1 - t);
  }
  noiseBuffer = buf;
  return buf;
}

/** Short UI blip. `soft` is used for hovers / secondary presses. */
export function playClick(soft = false) {
  const c = ensureContext();
  if (!c || !master) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(soft ? CLICK_FREQ * 0.6 : CLICK_FREQ, now);
  osc.frequency.exponentialRampToValueAtTime(soft ? 420 : 320, now + CLICK_MS / 1000);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(soft ? 0.04 : 0.09, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, now + CLICK_MS / 1000 + 0.05);
  osc.connect(g).connect(master);
  osc.start(now);
  osc.stop(now + CLICK_MS / 1000 + 0.08);
}

/* -----------------------------------------------------------------------------
 * CURSOR WIND
 * One permanent looping voice through a three-stage gain chain:
 *
 *   noise → bandpass → [gain] → [userGain] → [envGain] → [panner] → master
 *              ^          ^          ^           ^
 *              |          |          |           `- stereo position (cursor X)
 *              |          |          `------------- fade-in / fade-out envelope
 *              |          `------------------------ slider × reduced-audio
 *              `----------------------------------- cursor speed (per frame)
 *
 * Splitting them means the per-frame speed ramp, the slider and the on/off
 * envelope never fight over one AudioParam — which is exactly what used to
 * make enabling the wind land as a sudden burst.
 * --------------------------------------------------------------------------- */

/** Start the (initially silent) wind voice and swell it in. Idempotent. */
export function startWind() {
  const c = ensureContext();
  if (!c || !master || windNodes) return;
  const now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  src.loop = true;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.7; // wide = airy rush, not a whistle
  filter.frequency.setValueAtTime(WIND_FREQ_MIN, now);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, now);

  const userGain = c.createGain();
  userGain.gain.setValueAtTime(windUserGainValue(), now);

  // Envelope: always begins at silence and swells in over WIND_FADE_IN_S, so
  // turning the toggle on can never produce an abrupt blast of noise.
  const envGain = c.createGain();
  envGain.gain.setValueAtTime(0, now);
  envGain.gain.linearRampToValueAtTime(1, now + WIND_FADE_IN_S);

  const panner = makePanner(c);
  if (panner) panner.pan.setValueAtTime(0, now);

  const tail = src.connect(filter).connect(gain).connect(userGain).connect(envGain);
  if (panner) tail.connect(panner).connect(master);
  else tail.connect(master);

  try { src.start(now); } catch { /* autoplay block */ }
  windNodes = { src, filter, gain, userGain, envGain, panner };
}

/**
 * 0 = still cursor, 1 = full gust. Called every animation frame.
 * `setTargetAtTime` is an exponential approach, not a step, so consecutive
 * frames blend into one continuous curve with no audible stair-stepping.
 */
export function setWindIntensity(intensity: number) {
  if (!ctx || !windNodes) return;
  const i = Math.max(0, Math.min(1, intensity));
  const now = ctx.currentTime;
  const { gain, filter } = windNodes;
  // Reduced audio also slows the response so the wind breathes instead of gusting.
  const ramp = reducedAudio ? WIND_RAMP_S * 2.2 : WIND_RAMP_S;
  gain.gain.setTargetAtTime(WIND_GAIN_MAX * i, now, ramp);
  filter.frequency.setTargetAtTime(
    WIND_FREQ_MIN + (WIND_FREQ_MAX - WIND_FREQ_MIN) * i,
    now,
    ramp,
  );
}

/** Slider value 0..1. Applied on its own gain stage, always as a smooth ramp. */
export function setWindUserLevel(level: number) {
  windUserLevel = Math.max(0, Math.min(1, level));
  if (!ctx || !windNodes) return;
  windNodes.userGain.gain.setTargetAtTime(windUserGainValue(), ctx.currentTime, 0.08);
}

/** -1 (left) .. 1 (right). Ignored when spatial audio is off or unsupported. */
export function setWindPan(pan: number) {
  if (!ctx || !windNodes?.panner) return;
  const p = spatialAudio ? Math.max(-PAN_MAX, Math.min(PAN_MAX, pan)) : 0;
  windNodes.panner.pan.setTargetAtTime(p, ctx.currentTime, PAN_RAMP_S);
}

/** Fade the wind out, then tear the voice down. */
export function stopWind() {
  if (!ctx || !windNodes) return;
  const { src, envGain } = windNodes;
  windNodes = null;
  const now = ctx.currentTime;
  try {
    envGain.gain.cancelScheduledValues(now);
    envGain.gain.setValueAtTime(envGain.gain.value, now);
    envGain.gain.linearRampToValueAtTime(0, now + WIND_FADE_OUT_S);
  } catch {
    /* node already gone */
  }
  try {
    src.stop(now + WIND_FADE_OUT_S + 0.05);
  } catch {

    /* already stopped */
  }
}

export function isWindRunning() {
  return !!windNodes;
}

/* -----------------------------------------------------------------------------
 * AMBIENCE — the licensed space track (src/assets/ambient-space.mp3).
 *
 * The old pad was synthesised. This now streams a real ambient music bed, and
 * the bytes are stored on-device by lib/audioCache.ts (Cache Storage), so the
 * download happens exactly once — every later visit starts from local storage
 * with no network request at all.
 *
 * GRAPH:  buffer → lowpass (takes the edge off) → gain → panner → master
 *
 * The track is encoded with matched 2s fades at its head and tail, so looping
 * it is a smooth swell rather than an audible splice.
 *
 * HOW TO MODIFY
 *   • Different track → replace public/audio/ambient-space.mp3 (keep the name).
 *   • Loudness        → AMBIENCE_GAIN_MUSIC at the top of this file.
 *   • Fade-in length  → AMBIENCE_FADE_S below.
 *
 * WHY A PUBLIC-FOLDER URL (2026-07-31 fix): the track used to be referenced
 * through a Lovable-managed asset descriptor whose URL (/__l5e/assets-v1/...)
 * only resolves inside the Lovable preview host. On a self-hosted deploy
 * (Vercel) that request 404s, so ambience was silent everywhere except the
 * preview. The file now lives in public/ and ships with the build.
 * --------------------------------------------------------------------------- */
const AMBIENCE_FADE_S = 3.5;
/** Self-hosted, build-shipped ambient track. Served at the site root. */
const AMBIENCE_URL = "/audio/ambient-space.mp3";

let ambienceBuffer: AudioBuffer | null = null;
let ambienceLoading: Promise<AudioBuffer | null> | null = null;
let ambienceWanted = false;

async function loadAmbienceBuffer(c: AudioContext): Promise<AudioBuffer | null> {
  if (ambienceBuffer) return ambienceBuffer;
  if (ambienceLoading) return ambienceLoading;
  ambienceLoading = (async () => {
    try {
      const { fetchCachedAudio } = await import("@/lib/audioCache");
      const bytes = await fetchCachedAudio(AMBIENCE_URL);
      ambienceBuffer = await c.decodeAudioData(bytes.slice(0));
      return ambienceBuffer;
    } catch {
      return null; // offline / decode failure — ambience just stays silent
    } finally {
      ambienceLoading = null;
    }
  })();
  return ambienceLoading;
}

/** Download + decode the track ahead of time (called during browser idle). */
export function preloadAmbience() {
  if (typeof window === "undefined" || ambienceBuffer || ambienceLoading) return;
  void import("@/lib/audioCache").then(({ fetchCachedAudio }) =>
    fetchCachedAudio(AMBIENCE_URL).catch(() => {}),
  );
}

/* PLAYHEAD BOOKKEEPING
 * A BufferSource cannot be paused — once stopped it is gone. To make the tab
 * switch feel like a real pause we remember WHERE in the track we were and
 * restart the next voice from that offset (minus a small overlap so the return
 * swells in rather than jumping straight to the exact sample).
 * HOW TO MODIFY: AMBIENCE_RESUME_REWIND_S = how far back the resume rewinds. */
const AMBIENCE_RESUME_REWIND_S = 1.2;
let ambienceOffset = 0; // seconds into the track where playback should resume
let ambienceStartedAtCtxTime = 0; // ctx.currentTime when the current voice started
let ambiencePausedForTab = false;

/** Where in the track we are right now, wrapped to the loop length. */
function currentAmbienceOffset(): number {
  if (!ctx || !ambienceNodes || !ambienceBuffer) return ambienceOffset;
  const played = ctx.currentTime - ambienceStartedAtCtxTime;
  return (ambienceOffset + Math.max(0, played)) % ambienceBuffer.duration;
}

/* VOICE REGISTRY + GENERATION TOKEN (2026-07-30 fix)
 *
 * WHAT: every pad voice ever created is remembered here, and every start /
 *       stop bumps `ambienceGeneration`.
 * WHY:  the pad is spawned from an async download. Without a token, a toggle
 *       sequence like on -> off -> on could let a stale download callback
 *       spawn a second, untracked voice, which then kept playing after the
 *       switch was turned off ("ambience is off but the sound keeps playing").
 *       The registry is the belt to that braces: stopAmbience silences EVERY
 *       voice, tracked or orphaned.
 * HOW TO MODIFY: nothing to tune here. Fade lengths live in stopAmbience /
 *       AMBIENCE_FADE_S. */
let ambienceGeneration = 0;
const liveAmbienceVoices = new Set<{ src: AudioScheduledSourceNode; gain: GainNode }>();

/** Build + start the pad voice at `offset` seconds, swelling in over `fade`. */
function spawnAmbience(buffer: AudioBuffer, offset: number, fade: number) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  const target = AMBIENCE_GAIN_MUSIC * (reducedAudio ? REDUCED_AUDIO_FACTOR : 1);
  out.gain.exponentialRampToValueAtTime(target, now + Math.max(0.05, fade));

  const panner = makePanner(ctx);
  if (panner) panner.pan.setValueAtTime(0, now);

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = reducedAudio ? 1800 : 6000;
  lowpass.Q.value = 0.3;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  src.connect(lowpass).connect(out);
  if (panner) out.connect(panner).connect(master);
  else out.connect(master);

  const safeOffset = ((offset % buffer.duration) + buffer.duration) % buffer.duration;
  
  // Autoplay safeguard: catch blocks even after gestures
  try {
    src.start(now, safeOffset);
  } catch (err) {
    console.warn("Ambience start blocked:", err);
    // Tear down so we don't leak nodes
    out.gain.cancelScheduledValues(now);
    out.gain.value = 0;
  }

  ambienceOffset = safeOffset;
  ambienceStartedAtCtxTime = now;

  const voice = { src, gain: out };
  liveAmbienceVoices.add(voice);
  src.onended = () => liveAmbienceVoices.delete(voice);

  ambienceNodes = { nodes: [src], gain: out, panner };
}

/** Tear the current voice down over `fade` seconds. Does not touch intent. */
function teardownAmbience(fade: number) {
  if (!ctx || !ambienceNodes) return;
  const { nodes, gain } = ambienceNodes;
  ambienceNodes = null;
  const now = ctx.currentTime;
  // A suspended context has a frozen clock, so a scheduled ramp/stop would
  // never run and the pad would burst back to life on the next resume. Cut it.
  const immediate = ctx.state !== "running";
  try {
    gain.gain.cancelScheduledValues(now);
    if (immediate) {
      gain.gain.value = 0.0001;
    } else {
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
    }
  } catch {
    /* node already gone */
  }
  nodes.forEach((n) => {
    // This voice now owns its own graceful stop, so drop it from the registry
    // (the registry is only a safety net for voices nobody is managing).
    liveAmbienceVoices.forEach((v) => {
      if (v.src === n) liveAmbienceVoices.delete(v);
    });
    try {
      if (immediate) n.stop();
      else n.stop(now + fade + 0.2);
    } catch {
      /* already stopped */
    }
  });
}


export function startAmbience() {
  const c = ensureContext();
  if (!c || !master) return;
  // Intent is recorded BEFORE any early exit, so a re-entrant call while a
  // voice is alive still counts as "on".
  ambienceWanted = true;
  ambiencePausedForTab = false;
  refreshWindUserGain(); // the wind gets its ambience boost
  if (ambienceNodes) return; // already sounding

  const gen = ++ambienceGeneration;
  void loadAmbienceBuffer(c).then((buffer) => {
    // Dropped if the visitor toggled it back off (or off-and-on) meanwhile.
    if (gen !== ambienceGeneration) return;
    if (!buffer || !ambienceWanted || ambienceNodes || !ctx || !master) return;
    if (ambiencePausedForTab) return; // hidden tab — wait for the return
    spawnAmbience(buffer, ambienceOffset, reducedAudio ? AMBIENCE_FADE_S * 1.6 : AMBIENCE_FADE_S);
  });
}


/** Fade out and tear down the pad (user turned it off — playhead resets). */
export function stopAmbience() {
  ambienceWanted = false;
  ambiencePausedForTab = false;
  ambienceOffset = 0;
  ambienceGeneration++; // invalidate any download still in flight
  refreshWindUserGain();
  teardownAmbience(1.8);
  // Safety net: silence anything that somehow escaped the tracked voice.
  liveAmbienceVoices.forEach((voice) => {
    try {
      voice.gain.gain.cancelScheduledValues(ctx?.currentTime ?? 0);
      voice.gain.gain.value = 0.0001;
      voice.src.stop();
    } catch {
      /* already stopped */
    }
    liveAmbienceVoices.delete(voice);
  });

}

/* -----------------------------------------------------------------------------
 * TAB PAUSE / RESUME
 * Called by setGlobalMute. Unlike stopAmbience this KEEPS the playhead, so
 * returning to the tab continues the track where it left off (rewound by
 * AMBIENCE_RESUME_REWIND_S so the re-entry feels natural, not abrupt).
 * --------------------------------------------------------------------------- */
function pauseAmbienceForTab(fadeS: number) {
  if (!ambienceWanted || ambiencePausedForTab) return;
  ambiencePausedForTab = true;
  if (!ambienceNodes) return;
  ambienceOffset = currentAmbienceOffset();
  teardownAmbience(fadeS);
}

function resumeAmbienceForTab(fadeS: number) {
  if (!ambiencePausedForTab) return;
  ambiencePausedForTab = false;
  if (!ambienceWanted || ambienceNodes) return;
  const c = ensureContext();
  if (!c) return;
  void loadAmbienceBuffer(c).then((buffer) => {
    if (!buffer || !ambienceWanted || ambienceNodes || ambiencePausedForTab) return;
    const resumeAt = Math.max(0, ambienceOffset - AMBIENCE_RESUME_REWIND_S);
    spawnAmbience(buffer, resumeAt, Math.max(fadeS, 0.6));
  });
}


export function isAmbiencePlaying() {
  return !!ambienceNodes;
}

/**
 * -1 (left) .. 1 (right). The pad pans much more gently than the wind — a
 * wide bed that swings hard across the head is disorienting, so the caller's
 * value is halved here.
 */
export function setAmbiencePan(pan: number) {
  if (!ctx || !ambienceNodes?.panner) return;
  const p = spatialAudio ? Math.max(-PAN_MAX, Math.min(PAN_MAX, pan)) * 0.5 : 0;
  ambienceNodes.panner.pan.setTargetAtTime(p, ctx.currentTime, PAN_RAMP_S * 2);
}

/* -----------------------------------------------------------------------------
 * GLOBAL AUDIO MODES
 * Both of these can be flipped while sound is playing; every change is applied
 * as a ramp on the already-running nodes, so nothing has to be restarted.
 * --------------------------------------------------------------------------- */

/** Minimise continuous beds (wind + pad). One-shot clicks are unaffected. */
export function setReducedAudio(on: boolean) {
  reducedAudio = on;
  if (!ctx) return;
  const now = ctx.currentTime;
  if (windNodes) {
    windNodes.userGain.gain.setTargetAtTime(windUserGainValue(), now, 0.25);
  }
  if (ambienceNodes) {
    const target = AMBIENCE_GAIN_MUSIC * (on ? REDUCED_AUDIO_FACTOR : 1);
    ambienceNodes.gain.gain.setTargetAtTime(target, now, 1.2);
  }
}

/** Enable/disable cursor-following stereo placement; recentres when off. */
export function setSpatialAudio(on: boolean) {
  spatialAudio = on;
  if (!on) {
    setWindPan(0);
    setAmbiencePan(0);
  }
}

/* -----------------------------------------------------------------------------
 * GLOBAL MUTE (tab visibility) — click-free fade out / fade in
 *
 * When the visitor switches away we ramp the ENTIRE master bus down to silence
 * instead of tearing voices down, and ramp it back up on return. Two details
 * keep it free of clicks and zipper noise:
 *   1. The ramp is EXPONENTIAL (perceptually linear loudness), never a jump.
 *      Exponential ramps cannot reach 0, so we floor at SILENCE and only then
 *      hard-zero the bus once the fade has finished.
 *   2. We cancelAndHold (with a cancelScheduledValues fallback for Firefox) so
 *      interrupting a fade half-way continues from the CURRENT value rather
 *      than snapping to the old target — that snap is the click people hear.
 *
 * CONFIGURABLE: the visitor can set the fade length in the Experience menu
 * ("Tab-switch fade"), which calls setTabFadeSeconds(). The out-fade is that
 * value; the return swell is FADE_IN_RATIO× longer because a slightly slower
 * fade-in always reads as smoother than a symmetrical one.
 *
 * AMBIENCE IS PAUSED, NOT JUST MUTED: once the fade-out finishes the pad's
 * voice is torn down and its playhead remembered, so coming back continues the
 * track from (roughly) where it left off instead of drifting on in silence.
 *
 * HOW TO MODIFY
 *   • Default fade length → DEFAULT_TAB_FADE_S.
 *   • Return-swell ratio  → FADE_IN_RATIO.
 * --------------------------------------------------------------------------- */
const DEFAULT_TAB_FADE_S = 0.45; // fade to silence when the tab is hidden
const FADE_IN_RATIO = 2; // return swell = out-fade × this
const SILENCE = 0.0001; // exponential ramps can't target exactly 0
let tabFadeOutS = DEFAULT_TAB_FADE_S;
let muted = false;
let muteTimer: ReturnType<typeof setTimeout> | null = null;

/** Set the tab-switch fade length in seconds (clamped to a sane 0.05..4s). */
export function setTabFadeSeconds(seconds: number) {
  tabFadeOutS = Math.max(0.05, Math.min(4, seconds));
}

export function getTabFadeSeconds() {
  return tabFadeOutS;
}

export function setGlobalMute(on: boolean) {
  muted = on;
  const fadeOut = tabFadeOutS;
  const fadeIn = tabFadeOutS * FADE_IN_RATIO;

  // Pause / resume the ambient track's timeline alongside the bus fade.
  if (on) pauseAmbienceForTab(fadeOut);
  else resumeAmbienceForTab(fadeIn);

  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const g = master.gain;

  // Continue from wherever the previous fade got to — never from a stale target.
  const hold = (g as GainNode["gain"] & { cancelAndHoldAtTime?: (t: number) => void })
    .cancelAndHoldAtTime;
  if (typeof hold === "function") hold.call(g, now);
  else {
    const current = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(current, now);
  }
  // Exponential ramps are undefined from 0, so start from a hair above it.
  if (g.value <= SILENCE) g.setValueAtTime(SILENCE, now);

  if (muteTimer) clearTimeout(muteTimer);

  if (on) {
    g.exponentialRampToValueAtTime(SILENCE, now + fadeOut);
    // Hard-zero AFTER the fade so a backgrounded tab is truly silent.
    muteTimer = setTimeout(() => {
      if (muted && ctx && master) master.gain.setValueAtTime(0, ctx.currentTime);
    }, fadeOut * 1000 + 60);
  } else {
    g.exponentialRampToValueAtTime(MASTER_GAIN, now + fadeIn);
  }
}



export function isGloballyMuted() {
  return muted;
}

/* -----------------------------------------------------------------------------
 * AUDIO DIAGNOSTICS SNAPSHOT
 *
 * WHAT: everything the diagnostics panel (and its JSON export) needs to explain
 * how the audio layer is currently behaving — including the CONFIGURED fade and
 * the fade that was actually applied (they differ when the value is clamped),
 * plus exactly where the ambient track's playhead sits.
 *
 * HOW TO MODIFY: add a field here and it shows up in the exported JSON too.
 * --------------------------------------------------------------------------- */
export type AudioDiagnostics = {
  contextState: string | null;
  muted: boolean;
  reducedAudio: boolean;
  spatialAudio: boolean;
  /** Seconds requested by the user's preference (pre-clamp). */
  tabFadeRequestedS: number;
  /** Seconds actually in force after clamping to 0.05..4s. */
  tabFadeAppliedS: number;
  /** Return swell = applied out-fade × FADE_IN_RATIO. */
  tabFadeInS: number;
  ambienceWanted: boolean;
  ambiencePlaying: boolean;
  ambiencePausedForTab: boolean;
  /** Seconds into the loop where playback would resume right now. */
  ambiencePlayheadS: number | null;
  /** Stored resume offset (what a tab-return would start from). */
  ambienceResumeOffsetS: number | null;
  ambienceRewindS: number;
  ambienceDurationS: number | null;
  windRunning: boolean;
  windUserLevel: number;
  windAmbienceBoost: number;
};

let tabFadeRequestedS = DEFAULT_TAB_FADE_S;

export function getAudioDiagnostics(): AudioDiagnostics {
  return {
    contextState: ctx?.state ?? null,
    muted,
    reducedAudio,
    spatialAudio,
    tabFadeRequestedS: +tabFadeRequestedS.toFixed(3),
    tabFadeAppliedS: +tabFadeOutS.toFixed(3),
    tabFadeInS: +(tabFadeOutS * FADE_IN_RATIO).toFixed(3),
    ambienceWanted,
    ambiencePlaying: !!ambienceNodes,
    ambiencePausedForTab,
    ambiencePlayheadS: ambienceBuffer ? +currentAmbienceOffset().toFixed(3) : null,
    ambienceResumeOffsetS: ambienceBuffer
      ? +Math.max(0, ambienceOffset - AMBIENCE_RESUME_REWIND_S).toFixed(3)
      : null,
    ambienceRewindS: AMBIENCE_RESUME_REWIND_S,
    ambienceDurationS: ambienceBuffer ? +ambienceBuffer.duration.toFixed(3) : null,
    windRunning: !!windNodes,
    windUserLevel: +windUserLevel.toFixed(3),
    windAmbienceBoost: WIND_AMBIENCE_BOOST,
  };
}

/** Remember the raw request so diagnostics can show requested vs applied. */
const _setTabFadeSeconds = setTabFadeSeconds;
export function noteTabFadeRequest(seconds: number) {
  tabFadeRequestedS = seconds;
  _setTabFadeSeconds(seconds);
}

