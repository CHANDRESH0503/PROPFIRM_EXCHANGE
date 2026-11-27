"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/browser";

type Phase =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "error" };

/**
 * TOTP enrolment and verification with Supabase Auth MFA. Raises the session to aal2, which
 * requireStaff checks on every admin request. Runs in the browser because the MFA API acts on
 * the user's own session.
 */
export function MfaForm() {
  const t = useTranslations("admin.mfa");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) return setPhase({ kind: "error" });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setPhase({ kind: "verify", factorId: verified.id });
      // Clear abandoned enrolments so a fresh QR code can be issued.
      for (const f of data.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Admin",
      });
      if (cancelled) return;
      if (enrollError || !enrolled) return setPhase({ kind: "error" });
      setPhase({
        kind: "enroll",
        factorId: enrolled.id,
        qr: enrolled.totp.qr_code,
        secret: enrolled.totp.secret,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind !== "enroll" && phase.kind !== "verify") return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: phase.factorId,
      code,
    });
    setPending(false);
    if (verifyError) {
      setError(t("invalid"));
      setCode("");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  if (phase.kind === "loading") return <Skeleton className="h-72 w-full rounded-xl" />;
  if (phase.kind === "error")
    return (
      <p role="alert" className="text-danger">
        {t("error")}
      </p>
    );

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-text-soft">
        {phase.kind === "enroll" ? t("enrollBody") : t("verifyBody")}
      </p>
      {phase.kind === "enroll" ? (
        <div className="space-y-3">
          {/* Supabase returns the QR code as an SVG data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={phase.qr}
            alt={t("qrAlt")}
            width={192}
            height={192}
            className="rounded-lg bg-white p-2"
          />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{t("secret")}</summary>
            <code className="mt-2 block font-mono text-sm break-all text-foreground select-all">
              {phase.secret}
            </code>
          </details>
        </div>
      ) : null}
      <Field label={t("code")} htmlFor="totp" error={error ?? undefined}>
        <Input
          id="totp"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="font-mono text-lg tracking-[0.3em]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "totp-error" : undefined}
        />
      </Field>
      <Button type="submit" size="lg" block pending={pending} disabled={code.length !== 6}>
        {pending ? t("verifying") : t("verify")}
      </Button>
    </form>
  );
}
