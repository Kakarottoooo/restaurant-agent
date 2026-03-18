"use client";

import { useEffect, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useAuthUpdater } from "./AuthContext";

/**
 * Must be rendered INSIDE <ClerkProvider> and <AuthStateProvider>.
 * Bridges Clerk auth state into AuthContext so non-Clerk components can read it safely.
 */
export function ClerkSync() {
  const { user, isSignedIn } = useUser();
  const clerk = useClerk();
  const updateAuth = useAuthUpdater();

  const signIn = useCallback(() => {
    clerk.openSignIn({});
  }, [clerk]);

  const signOut = useCallback(async () => {
    await clerk.signOut();
  }, [clerk]);

  useEffect(() => {
    updateAuth({
      isSignedIn: isSignedIn ?? false,
      userId: user?.id ?? null,
      userDisplayName: user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? null,
      userAvatar: user?.imageUrl ?? null,
      signIn,
      signOut,
    });
  }, [isSignedIn, user, signIn, signOut, updateAuth]);

  return null;
}
