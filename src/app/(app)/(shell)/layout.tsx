import { Wordmark } from "@/components/brand/wordmark";
import { BottomTabs, TopTabs } from "@/components/layout/app-tabs";

/**
 * Signed-in shell. The chrome is static (no session read), so it renders instantly on every
 * navigation; each page verifies the session inside its own Suspense boundary.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-hairline bg-ink/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8 md:h-16">
          <Wordmark href="/today" />
          <TopTabs />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl px-5 pt-6 pb-10 sm:px-8 md:pt-10">
        {children}
      </main>
      <BottomTabs />
    </div>
  );
}
