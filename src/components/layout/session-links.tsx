"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { createClient } from "@/lib/supabase/browser";

/**
 * The public header is prerendered without reading the session, so these two links learn it in
 * the browser (from the auth cookie, no network call) and switch a signed-in member to the app:
 * the wordmark goes to Today and "Sign in" becomes "Open app". Without this a member on a public
 * page sees "Sign in" and lands on the waitlist from the logo, as if they had been signed out.
 */
function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const auth = createClient().auth;
    let active = true;
    void auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data } = auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return signedIn;
}

export function SessionWordmark() {
  return <Wordmark href={useSignedIn() ? "/today" : "/"} />;
}

export function AccountLink({
  signIn,
  openApp,
  className,
  signedInHref = "/today",
  signedOutHref = "/sign-in",
}: {
  signIn: string;
  openApp: string;
  className: string;
  signedInHref?: "/today" | "/accounts";
  signedOutHref?: "/sign-in" | "/sign-in?next=%2Faccounts%2Ftrades%2Fnew";
}) {
  const signedIn = useSignedIn();
  return (
    <Link href={signedIn ? signedInHref : signedOutHref} className={className}>
      {signedIn ? openApp : signIn}
    </Link>
  );
}

/** "Home" for error pages: Today for a signed-in member, the landing page otherwise. */
export function HomeLink({
  home,
  app,
  className,
}: {
  home: string;
  app: string;
  className: string;
}) {
  const signedIn = useSignedIn();
  return (
    <Link href={signedIn ? "/today" : "/"} className={className}>
      {signedIn ? app : home}
    </Link>
  );
}
