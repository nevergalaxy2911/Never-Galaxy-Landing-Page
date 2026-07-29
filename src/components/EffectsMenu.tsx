import { useCallback, useEffect, useState } from "react";
import { Settings2, Volume2, Music4, MousePointer2, EarOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useCloseOnScroll } from "@/hooks/useCloseOnScroll";
import {
  useClickSoundPref,
  useWindPref,
  useAmbiencePref,
  useReducedAudioPref,
  usePrefersReducedMotion,
} from "@/hooks/useEffectsPrefs";

/* -----------------------------------------------------------------------------
 * EffectsMenu — one nav popover holding the few "feel" switches that are still
 * worth exposing: the sound channels, reduced audio, and the tab-switch fade.
 *
 * DELIBERATELY NOT HERE (2026-07-29 — always on / automatic instead):
 *   • Smooth scroll          — always on
 *   • Spatial audio          — always on
 *   • Progressive previews   — always on
 *   • Preview quality cap    — automatic; the FPS watchdog in lib/autoQuality.ts
 *                              trips it the moment the page starts stuttering
 *   • Close panels on scroll — always on, fixed 180ms delay
 *   • Wind intensity         — fixed (WIND_USER_LEVEL), tuned to stay audible
 *                              underneath the ambient pad
 *   • Tab-switch fade        — fixed (TAB_FADE_MS)
 *   • Diagnostics panel      — removed
 *   • Clear preview cache    — removed (the cache self-evicts under quota)
 *
 * Everything left persists to localStorage (see hooks/useEffectsPrefs.ts).
 *
 * SMALL / LOW-END DEVICES: phones get the ambient bed only. Click
 * blips, reduced audio and the tuning knobs are hidden there — those devices are
 * hard-forced onto the cheapest path in code.
 *
 * HOW TO MODIFY: add a row to the `rows` array — label, icon, and the
 * [value, setValue] pair from a pref hook.
 * --------------------------------------------------------------------------- */
export function EffectsMenu({ className = "" }: { className?: string }) {
  const [click, setClick] = useClickSoundPref();
  const [wind, setWind] = useWindPref();
  const [ambience, setAmbience] = useAmbiencePref();
  const [reducedAudio, setReducedAudio] = useReducedAudioPref();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [open, setOpen] = useState(false);
  useCloseOnScroll(open, useCallback(() => setOpen(false), []));

  // SSR-safe pointer probe: assume touch until the client proves otherwise.
  const [finePointer, setFinePointer] = useState(false);
  /* ADVANCED CONTROLS GATE — small / low-end devices skip the tuning knobs. */
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    setFinePointer(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false);
    void import("@/lib/deviceTier").then(({ isLowEndDevice }) => {
      setAdvanced(window.innerWidth >= 1024 && !isLowEndDevice());
    });
  }, []);

  // "Full" audio UI is desktop-only; phones keep wind + ambience.
  const fullAudioUi = finePointer && advanced;

  /* WIND DRIVER — desktop follows the CURSOR, small/touch devices follow the
     PAGE SCROLL (there is no hovering cursor to follow when you tap). The
     runtime picks the same way in SoundController; this only labels it. */
  const cursorWind = finePointer && advanced;

  /* Ambience and wind belong together: flipping the pad on also brings the
     wind in (the two were designed as one bed). Turning ambience off leaves
     the wind exactly as the visitor left it. */
  /* ONE SWITCH — the ambient pad and the wind are a single bed, so there is no
     separate wind row any more. Flipping ambience flips both channels together.
     The wind DRIVER still differs by device (cursor on desktop, scroll on
     touch); see SoundController. HOW TO MODIFY: split them again by giving the
     wind its own row here and dropping the setWind call below. */
  const toggleAmbience = (on: boolean) => {
    setAmbience(on);
    setWind(on);
  };

  /* Self-heal older sessions that stored the two prefs independently. */
  useEffect(() => {
    if (wind !== ambience) setWind(ambience);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambience]);

  const rows: Array<{
    id: string;
    label: string;
    hint: string;
    icon: typeof Music4;
    value: boolean;
    set: (v: boolean) => void;
  }> = [
    ...(fullAudioUi
      ? [{ id: "click", label: "UI click sounds", hint: "Soft blip on buttons", icon: MousePointer2, value: click, set: setClick }]
      : []),
    // Wind + ambient pad are the ONLY two audio channels small devices get —
    // they're cheap (one noise voice, one pad) and the wind needs no cursor
    // there because it rides the page scroll instead.
    {
      id: "ambience",
      label: "Ambient space pad",
      hint: cursorWind
        ? "Deep-space chord + wind that follows your cursor"
        : "Deep-space chord + wind that follows your scrolling",
      icon: Music4,
      value: ambience,
      set: toggleAmbience,
    },
    ...(fullAudioUi
      ? [{ id: "reduced", label: "Reduced audio", hint: "Even quieter pad, and the wind is switched off", icon: EarOff, value: reducedAudio || prefersReducedMotion, set: setReducedAudio }]
      : []),
  ];

  const soundsOn = (fullAudioUi && click) || wind || ambience;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open experience settings"
          title="Experience settings: sound"
          className={`relative grid h-9 w-9 place-items-center rounded-full border border-border/50 bg-background/40 backdrop-blur transition-all hover:border-border hover:bg-background/70 ${className}`}
        >
          <Settings2 className="h-4 w-4" />
          {soundsOn && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary text-[7px] text-primary-foreground"
            >
              <Volume2 className="h-2 w-2" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        /* UI: comfortable on desktop, and on very small screens it shrinks to
           the viewport width minus a gutter so the switches never clip. */
        className="w-[min(340px,calc(100vw-1rem))] overflow-hidden rounded-2xl border-border/60 bg-background/95 p-2 shadow-2xl backdrop-blur-xl sm:w-[320px]"
      >
        <p className="mb-1.5 px-3 pt-2 text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Experience
        </p>
        {/* Rows are spaced further apart on phones so two neighbouring taps can
            never be confused, and each row is at least 56px tall (comfortably
            above the 44px minimum touch target). */}
        <ul className="grid gap-1.5 sm:gap-0.5">
          {rows.map(({ id, label, hint, icon: Icon, value, set }) => (
            <li key={id}>
              <label
                htmlFor={`fx-${id}`}
                /* Three-column grid: text column can shrink and wrap, the switch
                   column keeps its intrinsic width so it can never be clipped. */
                className="grid min-h-[56px] cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl px-3 py-3 transition-colors hover:bg-foreground/5 active:bg-foreground/10 sm:min-h-0 sm:py-2.5"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-tight">{label}</span>
                  {/* Hints wrap instead of truncating, so no text is cut off. */}
                  <span className="mt-0.5 block break-words text-[10px] leading-snug text-muted-foreground">
                    {hint}
                  </span>
                </span>
                {/* The switch sits inside a padded hit box: the visible track
                    stays small, but the tappable area is a full 44x44. */}
                <span className="-my-2 -mr-1 grid h-11 w-11 shrink-0 place-items-center sm:-my-1 sm:h-9 sm:w-9">
                  <Switch
                    id={`fx-${id}`}
                    checked={value}
                    onCheckedChange={set}
                    aria-label={label}
                    className="shrink-0"
                  />
                </span>
              </label>
            </li>
          ))}
        </ul>



        <div className="mt-2 space-y-1.5 border-t border-border/50 px-3 pb-1 pt-3">
          {prefersReducedMotion && (
            <p className="text-[10px] leading-snug text-muted-foreground">
              Your system asks for reduced motion, so continuous sounds are kept
              quiet automatically.
            </p>
          )}
          {!fullAudioUi && (
            <p className="text-[10px] leading-snug text-muted-foreground">
              This device is kept on the light path, so only the ambient bed is
              offered.
            </p>
          )}
          <p className="text-[10px] leading-snug text-muted-foreground">
            Sounds start after your first click, because browsers block audio
            until then.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default EffectsMenu;
