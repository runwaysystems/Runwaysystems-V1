// Tracks whether the brand intro has already played for this visitor.
//
// The in-memory flag prevents replays during client-side navigation. The
// localStorage flag prevents replays on refresh or a later visit from the same
// browser, so only first-time visitors see the full intro animation.
const INTRO_STORAGE_KEY = 'runway-intro-seen'
let introSeenThisSession = false

function readIntroSeenStorage() {
  try {
    return window.localStorage.getItem(INTRO_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeIntroSeenStorage() {
  try {
    window.localStorage.setItem(INTRO_STORAGE_KEY, 'true')
  } catch {
    // Persistence is optional when storage is restricted. The in-memory flag
    // still prevents replays during this page session.
  }
}

export function introSeenForVisitor() {
  return introSeenThisSession || readIntroSeenStorage()
}

export function markIntroSeenForVisitor() {
  introSeenThisSession = true
  writeIntroSeenStorage()
}

// Backwards-compatible aliases for older tests/imports.
export function introSeenInSession() {
  return introSeenForVisitor()
}

export function markIntroSeenInSession() {
  markIntroSeenForVisitor()
}
