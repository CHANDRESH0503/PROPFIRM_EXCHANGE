import { SessionWordmark } from "@/components/layout/session-links";

/** Focused layout for sign-in: no navigation to leak away from the task. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl px-5 pt-3 sm:px-8">
        <SessionWordmark />
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10 pb-16 sm:pt-20"
      >
        {children}
      </main>
    </div>
  );
}
