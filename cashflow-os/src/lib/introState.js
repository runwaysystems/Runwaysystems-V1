// Tracks whether the brand intro has already played during this page-load
// session. The module stays alive across client-side navigation, so the intro
// plays once per fresh page load (a refresh or a new visit) and never replays
// when the user navigates back to the suite in-app, such as via the logo.
let introSeenThisSession = false

export function introSeenInSession() {
  return introSeenThisSession
}

export function markIntroSeenInSession() {
  introSeenThisSession = true
}
