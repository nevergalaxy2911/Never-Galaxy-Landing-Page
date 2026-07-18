import { createFileRoute } from "@tanstack/react-router";

/* -----------------------------------------------------------------------------
 * TERMS & COPYRIGHT PAGE — standalone legal notice.
 * HOW TO MODIFY: edit the copy in the JSX below. Update the "Last updated"
 * date whenever you change the terms.
 * --------------------------------------------------------------------------- */
export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Copyright | Never Galaxy" },
      {
        name: "description",
        content:
          "Terms of use, copyright notice, and content protection policy for Never Galaxy creative studio.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TermsPage,
});

const UPDATED = "July 18, 2026";

function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-16 space-y-8">
        <header>
          <a
            href="/"
            className="text-xs uppercase tracking-widest text-fuchsia-300 hover:text-fuchsia-200"
          >
            ← Back to site
          </a>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold">Terms & Copyright</h1>
          <p className="mt-2 text-sm text-white/50">Last updated: {UPDATED}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Ownership</h2>
          <p className="text-white/75 leading-relaxed">
            All content on this website, including but not limited to text, graphics,
            logos, icons, images, video clips, motion designs, thumbnails, code, and
            underlying layouts, is the property of Never Galaxy and is protected under
            applicable copyright, trademark, and intellectual property laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. No Copying or Redistribution</h2>
          <p className="text-white/75 leading-relaxed">
            You may not copy, reproduce, republish, download, modify, distribute,
            transmit, display, sell, license, or otherwise exploit any content from
            this site for public or commercial purposes without prior written consent
            from Never Galaxy. Scraping, mirroring, or automated extraction is
            expressly prohibited.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Client Work</h2>
          <p className="text-white/75 leading-relaxed">
            Portfolio pieces are displayed with permission from the respective
            clients. Rights to individual client work remain with the client and/or
            Never Galaxy as outlined in each project's contract.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Trademarks</h2>
          <p className="text-white/75 leading-relaxed">
            "Never Galaxy", the Never Galaxy logo, and related brand marks are
            trademarks of Never Galaxy. Third-party names and logos shown on this
            site belong to their respective owners.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Use of the Website</h2>
          <p className="text-white/75 leading-relaxed">
            You agree not to misuse this site, including attempting to gain
            unauthorized access to any part of the site, interfering with its
            operation, or using it in a way that could damage or overburden our
            infrastructure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Disclaimers</h2>
          <p className="text-white/75 leading-relaxed">
            The site is provided on an "as is" basis. While we work hard to keep
            information accurate and up to date, Never Galaxy makes no warranties,
            express or implied, about the completeness, reliability, or availability
            of the content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. DMCA & Takedown</h2>
          <p className="text-white/75 leading-relaxed">
            If you believe any content on this site infringes your copyright, contact
            us at{" "}
            <a
              className="text-fuchsia-300 hover:text-fuchsia-200"
              href="mailto:nevergalaxy2911@gmail.com"
            >
              nevergalaxy2911@gmail.com
            </a>{" "}
            with details and we will investigate promptly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Governing Law</h2>
          <p className="text-white/75 leading-relaxed">
            These terms are governed by the laws of India. Any disputes arising from
            use of this website will be handled in the appropriate courts of India.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Changes</h2>
          <p className="text-white/75 leading-relaxed">
            We may update these terms from time to time. Continued use of the site
            after changes means you accept the revised terms.
          </p>
        </section>

        <footer className="pt-8 border-t border-white/10 text-sm text-white/50">
          © {new Date().getFullYear()} Never Galaxy. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
