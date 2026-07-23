/**
 * Portfolio desktop preview modal regressions.
 *
 * Locks in the bugfix for the "two right scrollbars / navbar bleeding through
 * the iframe preview" issue: the modal must stop Lenis, hard-lock the outer
 * document, portal above the app shell, trap focus, and close with Escape.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WebsitePreviewModal from "@/components/galaxy/WebsitePreviewModal";

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(() => Promise.resolve({ ok: true })),
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler: () => vi.fn(() => Promise.resolve({ ok: true })),
    };
    return chain;
  },
}));

const props = {
  open: true,
  onClose: vi.fn(),
  slug: "vortex",
  title: "Vortex Agency",
  subtitle: "Immersive agency build",
  url: "https://example.com",
  detailHref: "/work/vortex",
};

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value,
  });
}

describe("WebsitePreviewModal", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
    window.__lenis = undefined;
    vi.restoreAllMocks();
    setScrollY(0);
  });

  it("hard-locks outer scrolling, stops Lenis, then restores both on close", () => {
    const stop = vi.fn();
    const start = vi.fn();
    window.__lenis = {
      isStopped: false,
      stop,
      start,
    } as unknown as typeof window.__lenis;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setScrollY(420);

    const { unmount } = render(<WebsitePreviewModal {...props} />);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overscrollBehavior).toBe("none");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-420px");
    expect(document.body.style.touchAction).toBe("none");

    unmount();

    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
    expect(scrollTo).toHaveBeenCalledWith(0, 420);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("renders as an accessible dialog with explicit navigation actions", async () => {
    render(<WebsitePreviewModal {...props} />);

    expect(screen.getByRole("dialog", { name: "Vortex Agency" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Back to Never Galaxy$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open Vortex Agency live site in a new tab/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Close preview/i })).toBeTruthy();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: /Close preview/i }));
    });
  });

  it("traps keyboard focus and closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<WebsitePreviewModal {...props} onClose={onClose} />);

    const close = screen.getByRole("button", { name: /Close preview/i });
    const back = screen.getByRole("button", { name: /^Back to Never Galaxy$/i });
    await waitFor(() => expect(document.activeElement).toBe(close));

    await user.tab();
    expect(document.activeElement).toBe(back);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(close);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});