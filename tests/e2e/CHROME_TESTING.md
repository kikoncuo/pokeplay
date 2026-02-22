# Manual Chrome Testing Protocol — PokéPlay Platform

This document describes the manual testing protocol for PokéPlay. Run these
checks before each release and after major feature changes. Automated E2E tests
in `auth.test.ts` and `rom-upload.test.ts` cover the same flows programmatically.

---

## Prerequisites

- Chrome 120+ (or latest stable)
- Dev server running: `npm run dev`
- Valid `.env.local` with Supabase credentials
- Test ROM files unzipped to `roms/`
- Two browser profiles (or one incognito window) for multiplayer tests

---

## 1. Authentication

### 1.1 Sign-Up

1. Open `http://localhost:3000`
2. Click "Sign Up" (or navigate to `/sign-up`)
3. Enter a valid email address and password (min 8 chars)
4. Submit the form
5. **Expected:** Confirmation email sent, or direct redirect to dashboard

**Checks:**
- [ ] Form validates email format before submit
- [ ] Form validates password length/strength
- [ ] No raw error stack traces visible to user
- [ ] After sign-up, user is logged in or shown confirmation

### 1.2 Sign-In

1. Navigate to `/sign-in`
2. Enter valid credentials
3. Submit
4. **Expected:** Redirect to `/dashboard`

**Checks:**
- [ ] Invalid credentials show user-friendly error message
- [ ] Session cookie is set (check DevTools → Application → Cookies)
- [ ] Authenticated routes are accessible after login

### 1.3 Sign-Out

1. While authenticated, click "Sign Out" in navbar/header
2. **Expected:** Redirect to `/` or `/sign-in`

**Checks:**
- [ ] Session cookie is cleared after sign-out
- [ ] Navigating to `/dashboard` after sign-out redirects to sign-in

### 1.4 Session Persistence

1. Sign in
2. Close tab, reopen `http://localhost:3000`
3. **Expected:** Still authenticated, no re-login required

---

## 2. ROM Upload

### 2.1 Valid ROM File

1. Navigate to `/dashboard`
2. Click "Add Game" or ROM upload button
3. Select `roms/Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb`
4. **Expected:** File accepted, SHA-1 hash displayed, game appears in library

**Checks:**
- [ ] No network request contains raw ROM binary (check DevTools → Network)
- [ ] File is stored in IndexedDB (DevTools → Application → IndexedDB)
- [ ] SHA-1 hash displayed matches known value
- [ ] Game card appears in library with correct title

### 2.2 Invalid File Types

Test each of the following — all should be rejected with a clear error message:

| File | Expected Error |
|------|---------------|
| `test.exe` | "Invalid file type" |
| `test.txt` | "Invalid file type" |
| `test.zip` | "Invalid file type" |
| `test.png` | "Invalid file type" |

**Checks:**
- [ ] Error appears immediately (client-side validation, no server round-trip)
- [ ] Error is dismissible
- [ ] File is NOT stored in IndexedDB after rejection

### 2.3 File Size Limits

1. Attempt to upload a file larger than 64 MB
2. **Expected:** "File too large" error, file rejected

**Checks:**
- [ ] Validation is client-side (no network activity visible in DevTools)
- [ ] Error shows actual file size and limit

### 2.4 Empty File

1. Create an empty file with `.gb` extension
2. Attempt to upload it
3. **Expected:** "File is empty" error

---

## 3. Emulator

### 3.1 Game Launch

1. Upload a valid ROM and click "Play"
2. **Expected:** Emulator initializes and game starts within 5 seconds

**Checks:**
- [ ] Loading indicator is shown during initialization
- [ ] Emulator canvas/element is visible and interactive
- [ ] Audio works (if permissions allow)
- [ ] Keyboard input is captured (arrow keys, Z/X for A/B, Enter for Start)

### 3.2 Save State

1. Play the game for a few seconds
2. Click "Save" (or use save state shortcut)
3. Refresh the page
4. Resume the game
5. **Expected:** Game resumes from saved state

**Checks:**
- [ ] Save written to IndexedDB immediately (offline-first)
- [ ] After page reload, save is loadable
- [ ] Save is synced to Supabase Storage (check Supabase dashboard)

### 3.3 Memory Polling Performance

1. Open Chrome DevTools → Performance
2. Start recording
3. Play the game for 30 seconds
4. Stop recording
5. **Expected:** Memory reads occur at most 10 times per second (100ms interval)

**Checks:**
- [ ] No more than 10 memory poll calls per second in the flame graph
- [ ] No frame rate drops caused by memory polling

---

## 4. Multiplayer

### 4.1 Room Creation

1. In Window A: navigate to a game and click "Multiplayer" → "Create Room"
2. **Expected:** Room code displayed (6 characters)

**Checks:**
- [ ] Room code is visible and copyable
- [ ] Supabase Realtime channel is active (check browser console)

### 4.2 Room Join

1. In Window B (different user/incognito): navigate to the game
2. Click "Join Room" and enter the room code from Window A
3. **Expected:** Both players see each other's position overlay

**Checks:**
- [ ] Player sprites appear on the multiplayer overlay canvas
- [ ] Position updates at ≤100ms latency
- [ ] Overlay does NOT modify the emulator's internal canvas

### 4.3 Disconnect Handling

1. Close Window B abruptly (kill the tab)
2. **Expected:** Window A shows player B as disconnected within 5 seconds

**Checks:**
- [ ] No orphaned player sprites remain after disconnect
- [ ] Supabase Realtime presence is cleaned up

---

## 5. Offline Behavior

### 5.1 Offline Save

1. Sign in and start a game
2. Open DevTools → Network → check "Offline"
3. Save the game
4. **Expected:** Save written to IndexedDB, no error shown to user

**Checks:**
- [ ] Save succeeds without network (IndexedDB write)
- [ ] User sees "Saved locally" indicator (not an error)

### 5.2 Sync on Reconnect

1. Continue from 5.1 (offline save exists)
2. Uncheck "Offline" to restore network
3. **Expected:** Save automatically syncs to Supabase Storage

**Checks:**
- [ ] Sync happens within 30 seconds of reconnect
- [ ] No duplicate saves created
- [ ] User sees "Synced" indicator

---

## 6. Security Checks

### 6.1 ROM Never Sent to Server

1. Open DevTools → Network
2. Upload a ROM file
3. Filter requests by "Payload" size > 1 KB
4. **Expected:** No requests contain ROM binary data

**Checks:**
- [ ] Only the SHA-1 hash (40 chars) is sent, never the ROM bytes
- [ ] No `/api/rom` or similar upload endpoint is called

### 6.2 Row Level Security

1. Sign in as User A and create saves for a game
2. Sign in as User B (different account)
3. Attempt to access User A's saves via direct API call
4. **Expected:** Access denied (Supabase RLS rejects the request)

---

## 7. Cross-Platform Checks

Run the following on each platform before release:

| Platform | Browser | Auth | ROM Upload | Emulator | Multiplayer |
|----------|---------|------|-----------|---------|------------|
| macOS | Chrome | [ ] | [ ] | [ ] | [ ] |
| macOS | Firefox | [ ] | [ ] | [ ] | [ ] |
| macOS | Safari | [ ] | [ ] | [ ] | [ ] |
| Windows | Chrome | [ ] | [ ] | [ ] | [ ] |
| iOS | Safari | [ ] | N/A | [ ] | [ ] |
| Android | Chrome | [ ] | [ ] | [ ] | [ ] |

---

## 8. Performance Benchmarks

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Time to interactive | < 3s | Lighthouse |
| ROM hash computation | < 500ms for 32 MB | `console.time` in hasher |
| Save write (IndexedDB) | < 50ms | `console.time` in save manager |
| Emulator init time | < 5s | Time from click to first frame |
| Multiplayer latency | < 100ms | Supabase Realtime metrics |
| Memory poll rate | ≤ 10 Hz | Performance profiler |

---

## Reporting Issues

File bugs at: https://github.com/anthropics/claude-code/issues

Include:
- Browser and OS version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (copy from DevTools → Console)
- Network requests (screenshot from DevTools → Network)
