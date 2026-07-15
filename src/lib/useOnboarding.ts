// src/lib/useOnboarding.ts
// First-run onboarding state. Two dismissable surfaces — a one-time welcome
// modal and a getting-started checklist — both keyed per user in localStorage
// (no DB migration needed) and both auto-retiring once the user reaches the
// aha moment: their first sealed case.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useHauntStore } from '../store/useHauntStore';

type FlagKind = 'welcome' | 'checklist';

function flagKey(kind: FlagKind, uid: string) {
  return `hl_onboard_${kind}_${uid}`;
}
function readFlag(kind: FlagKind, uid: string | undefined): boolean {
  if (!uid || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(flagKey(kind, uid)) === '1';
  } catch {
    return false;
  }
}
function writeFlag(kind: FlagKind, uid: string) {
  try {
    window.localStorage.setItem(flagKey(kind, uid), '1');
  } catch {
    /* private mode / quota — non-fatal, onboarding just reshows */
  }
}

export type OnboardingSteps = {
  startedHunt: boolean;
  loggedEvent: boolean;
  sealedCase: boolean;
};

export function useOnboarding() {
  const { user: authUser } = useAuth();
  const uid = authUser?.id;
  const cases = useHauntStore((s) => s.cases);
  const activeHunt = useHauntStore((s) => s.activeHunt);
  // While the first server case-load is in flight, `cases` is momentarily [] —
  // don't flash onboarding at a returning user before their real count lands.
  const casesLoading = useHauntStore((s) => s.casesLoading);

  const [welcomeDone, setWelcomeDone] = useState(() => readFlag('welcome', uid));
  const [checklistDone, setChecklistDone] = useState(() => readFlag('checklist', uid));

  // Re-read when the signed-in user changes (sign-in / account switch) so one
  // user's dismissals never suppress another's onboarding on a shared browser.
  useEffect(() => {
    setWelcomeDone(readFlag('welcome', uid));
    setChecklistDone(readFlag('checklist', uid));
  }, [uid]);

  // Progress is derived from real state, not a separate tracker: having any
  // sealed case (or an active hunt with logs) proves the step was done, so
  // the checklist stays accurate even across devices / reinstalls.
  const steps: OnboardingSteps = {
    startedHunt: !!activeHunt || cases.length > 0,
    loggedEvent: (activeHunt?.logs.length ?? 0) > 0 || cases.length > 0,
    sealedCase: cases.length > 0,
  };
  // Aha reached → retire all onboarding.
  const activated = steps.sealedCase;

  const dismissWelcome = useCallback(() => {
    if (uid) writeFlag('welcome', uid);
    setWelcomeDone(true);
  }, [uid]);

  const dismissChecklist = useCallback(() => {
    if (uid) writeFlag('checklist', uid);
    setChecklistDone(true);
  }, [uid]);

  return {
    // The welcome modal shows once, only to a brand-new (un-activated) user.
    showWelcome: !!uid && !casesLoading && !activated && !welcomeDone,
    // The checklist follows an un-activated user until they seal or dismiss it.
    showChecklist: !!uid && !casesLoading && !activated && !checklistDone,
    steps,
    activated,
    dismissWelcome,
    dismissChecklist,
  };
}
