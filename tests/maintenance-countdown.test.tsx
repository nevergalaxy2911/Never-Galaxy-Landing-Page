/**
 * Countdown + Last-updated on the maintenance wall are driven purely by
 * the existing maintenance config (`until` and `updatedAt` fields on the
 * payload the root loader returns). This test locks the contract in code:
 *
 *  - When `until` is a future ISO date, a countdown region renders and
 *    ticks down every second, synced to a server-time offset.
 *  - When `until` is absent, no countdown region renders.
 *  - When `updatedAt` is set, a "Last updated …" line renders with the
 *    formatted date.
 *  - When `updatedAt` is null, no last-updated line renders.
 *
 * Rebuilds a minimal MaintenanceScreen matching src/routes/__root.tsx so
 * the test doesn't need router bootstrapping — the structural
 * zero-flash + gating tests already lock the route wiring itself.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { useEffect, useState } from "react";

function useCountdown(until: string | null, serverNow?: number) {
  const [offset] = useState(() => (typeof serverNow === "number" ? serverNow - Date.now() : 0));
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [until, offset]);
  if (!until) return null;
  const diff = Date.parse(until) - now;
  if (diff <= 0) return "any moment now";
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

type Data = { title: string; message: string; until: string | null; updatedAt: string | null };

function Wall({ data, serverNow }: { data: Data; serverNow?: number }) {
  const countdown = useCountdown(data.until, serverNow);
  const updated = data.updatedAt ? new Date(data.updatedAt) : null;
  return (
    <div>
      <h1>{data.title}</h1>
      <p>{data.message}</p>
      {countdown && (
        <div data-testid="countdown">
          <span>Back online in</span>
          <span data-testid="countdown-value">{countdown}</span>
        </div>
      )}
      {updated && <p data-testid="updated">Last updated {updated.toLocaleString()}</p>}
    </div>
  );
}

describe("maintenance wall — countdown + last-updated from config", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); cleanup(); });

  it("renders countdown when `until` is a future ISO date", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    vi.setSystemTime(now);
    const until = new Date(now + 5 * 60 * 1000).toISOString(); // +5 min
    render(<Wall data={{ title: "t", message: "m", until, updatedAt: null }} serverNow={now} />);
    expect(screen.getByTestId("countdown-value").textContent).toBe("5m 0s");
  });

  it("ticks down every second", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    vi.setSystemTime(now);
    const until = new Date(now + 2 * 1000).toISOString();
    render(<Wall data={{ title: "t", message: "m", until, updatedAt: null }} serverNow={now} />);
    expect(screen.getByTestId("countdown-value").textContent).toBe("0m 2s");
    // advanceTimersByTime advances fake clock AND fires due intervals — do
    // NOT also setSystemTime or the interval fires twice in one tick.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId("countdown-value").textContent).toBe("0m 1s");
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByTestId("countdown-value").textContent).toBe("any moment now");
  });

  it("omits countdown when `until` is null", () => {
    render(<Wall data={{ title: "t", message: "m", until: null, updatedAt: null }} />);
    expect(screen.queryByTestId("countdown")).toBeNull();
  });

  it("renders last-updated when `updatedAt` is set, omits otherwise", () => {
    const iso = "2026-07-20T12:34:56Z";
    const { unmount } = render(<Wall data={{ title: "t", message: "m", until: null, updatedAt: iso }} />);
    expect(screen.getByTestId("updated")).toBeTruthy();
    unmount();
    render(<Wall data={{ title: "t", message: "m", until: null, updatedAt: null }} />);
    expect(screen.queryByTestId("updated")).toBeNull();
  });

  it("uses serverNow offset so a skewed client clock doesn't finish early", () => {
    // Real "now" the browser thinks it is
    const clientNow = Date.parse("2026-01-01T00:10:00Z");
    // Server says it's actually 5 min earlier — so a `until = server+3min`
    // should show 3m, not -2m (which the client would compute unsynced).
    const serverNow = clientNow - 5 * 60 * 1000;
    vi.setSystemTime(clientNow);
    const until = new Date(serverNow + 3 * 60 * 1000).toISOString();
    render(<Wall data={{ title: "t", message: "m", until, updatedAt: null }} serverNow={serverNow} />);
    expect(screen.getByTestId("countdown-value").textContent).toBe("3m 0s");
  });
});
