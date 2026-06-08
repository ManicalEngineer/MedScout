# MedScout — Mobile App Design Brief

## Product Overview

MedScout is a community-powered ADHD medication availability tracker. It eliminates the monthly pharmacy scavenger hunt by combining a personal call toolkit, a refill countdown timer, AI-assisted call transcription, and a real-time crowdsourced stock map — so users know where their medication is before they run out.

**Platform:** iOS + Android (Expo SDK 54, React Native 0.81)
**Target users:** Two distinct audiences with different emotional triggers:
- **Adult patients (25–45)** — motivated by cognitive efficiency and dignity. The pharmacy hunt wastes their limited executive function. They want a system, not a rescue.
- **Parents/caregivers (28–50)** — motivated by child protection and preventing missed doses. Stakes feel existential.

---

## Design Principles

These come directly from user research and should govern every screen decision.

1. **Minimize cognitive load above all else.** Every action should be completable in one tap where possible. ADHD users cannot spare executive function on UI friction.
2. **Externalize the system failure.** Copy and visual framing should reinforce that the shortage is a system problem, not a personal one. Never imply the user forgot or failed.
3. **Lead with future control, not past pain.** The app's posture is proactive planner, not rescue service. Show "you're 6 days ahead" not "you almost ran out."
4. **Behavior-naming over abstraction.** UI labels should say "Log a pharmacy call" not "Add entry." Specific and recognizable beats generic.
5. **Respect privacy by default.** Sensitive call data stays on-device unless the user explicitly chooses to contribute it. Trust is the product.

---

## Color Palette

Inherited from the landing page for brand consistency.

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#F97316` | CTAs, active states, key highlights |
| `primary-glow` | `rgba(249,115,22,0.2)` | Button shadows, active indicator halos |
| `success` | `#22C55E` | Confirmed stock, refill secured, positive states |
| `danger` | `#EF4444` | Low stock alerts, overdue refill warnings |
| `bg-base` | `#0D1117` | Screen backgrounds |
| `bg-surface` | `#161B22` | Cards, bottom sheets, modals |
| `border` | `#30363D` | Card borders, dividers, input outlines |
| `text-primary` | `#F0F6FC` | Headlines, primary content |
| `text-muted` | `#8B949E` | Secondary labels, timestamps, captions |
| `focus-ring` | `#F97316` | Input focus border + ring |
| `vault` | `#8B5CF6` | Private Vault lock icons and indicators |

Dark mode only. Do not design a light mode — the audience skews night-owl and the dark palette is the brand.

---

## Typography

Match the landing page: **Lexend** as the primary typeface (already licensed via Google Fonts). Lexend was specifically designed for reading accessibility, which is appropriate for an ADHD-focused product.

| Role | Weight | Size |
|---|---|---|
| Screen title | Bold (700) | 28–32pt |
| Section heading | SemiBold (600) | 20–22pt |
| Body | Regular (400) | 15–16pt |
| Label / caption | Medium (500) | 12–13pt |
| Script text | Regular (400) | 16pt | (slightly larger — read aloud while on a call) |

---

## Authentication

### Required social login providers
- **Apple Sign In** — mandatory for App Store approval when any other social login is present
- **Google Sign In** — broadest coverage for Android + web-crossover users

### Optional
- Email + password fallback for users who distrust OAuth

### UX notes
- Privacy-conscious users (professional adults, per research) may avoid ADHD-diagnostic label targeting — they may also be cautious about social login. Offer email as a non-judgmental alternative.
- Do not ask for name, phone, or any non-essential info at signup. Reduce friction to zero.
- Post-auth, ask one question only: "Are you managing your own prescription or a child's?" — this sets the audience mode (self vs. caregiver) which gates different UX flows.

---

## Feature Architecture

Features are organized into two layers that map to the navigation structure:

**Layer 1 — Active Hunt Toolkit** (personal, private logistics)
**Layer 2 — Community Intelligence** (shared, crowdsourced data)

---

## Layer 1: Active Hunt Toolkit

### 1. Dashboard (Home)

The command center. Should answer "where do I stand right now?" in under 2 seconds.

**Key elements:**
- **Refill Countdown widget** — large, prominent. Days remaining displayed as a number with a circular progress ring. Color transitions: green (>10 days) → orange (5–10 days) → red (<5 days).
- **"Start Today's Hunt" CTA** — appears automatically when countdown reaches 7 days. One tap opens the Dialer view.
- **Recent activity feed** — last 3 pharmacy call logs with status badges (In Stock / Out / Check Back).
- **Insights card** — surfaces Advanced Predictions inline: "Your local CVS has had stock 3 of the last 4 weeks."
- **Shortage alert banner** — dismissible. Fires when community data shows low regional availability.

**Copy tone:** Proactive, not alarming. "You're 8 days ahead — good position." not "Warning: running low."

---

### 2. Pharmacy Dialer

A curated list of local pharmacies to call directly from the app — no leaving to the phone app, no losing your place.

**Dialer list view:**
- Pharmacies sorted by: proximity, last-called date, success history
- Each row shows: pharmacy name, distance, last call date, last status badge
- Two action icons per row: **Call** (phone icon) and **Script** (document icon)
- Lock icon on vaulted pharmacies (see Private Vault)

**Pre-Flight screen (mandatory before dialing):**
When the user taps Call, don't dial immediately. Show a full-screen Pre-Flight overlay containing:
- Pharmacy name + phone number
- Last call date and status
- The Script for this call (see Script Drawer below)
- Tone selector: **[Short/Direct]** · **[Polite/Patient]** · **[Insurance-First]**
- Two buttons: **"Start Call"** and **"Skip Script"**

This eliminates the moment of panic where the phone is already ringing and the user can't remember what to say.

---

### 3. Script Drawer

Contextual call scripts that reduce the cognitive load of making pharmacy calls. Slides up as a bottom sheet from the Dialer or Pre-Flight screen.

**Script variants by tone:**

| Tone | Use case | Example |
|---|---|---|
| Short/Direct | Busy pharmacy, clearly impatient staff | "Hi, do you have 20mg Adderall XR in stock?" |
| Polite/Patient | Standard call, unknown pharmacist | "Hi, I'm a patient checking if you're able to facilitate a transfer for 20mg Adderall XR. Is that something you currently have in stock?" |
| Insurance-First | When coverage needs to be confirmed | "Hi, I need to check stock availability and whether you accept [insurance] for a controlled substance transfer — 20mg Adderall XR." |

**Grumpy Pharmacist toggle:** A single-line version of whatever tone is selected. Activated by tapping a "⚡ Short version" chip. Reduces the script to its essential ask — one sentence, no pleasantries.

**Script personalization:** Scripts auto-fill from the user's saved medication profile (name, strength, formulation). No editing required per call.

**Live-view script:** When the call is active, the script remains visible as a persistent overlay at the top of the screen — small enough not to obstruct, large enough to read at a glance (16pt minimum). The user should never have to memorize the script while the phone is ringing.

---

### 4. AI Note-Taker & Call Transcription

Removes the need to type or remember anything during or after a stressful call.

**Live capture:**
- With permission, AI listens to the call and transcribes the conversation in real time
- Transcription runs on-device where possible (privacy-first); cloud fallback for unsupported devices

**Entity extraction:**
Automatically pulls structured data from the transcript:
- Stock status (in stock / out / check back)
- Expected restock date or shipment day
- Dosage and strength mentioned
- Manufacturer/brand if specified

**Post-call confirmation card:**
Immediately after hang-up, a card slides up:
> "I heard: **In stock, 20mg XR, arriving Friday.** Confirm to update your log?"
> [**Confirm**] [**Edit**] [**Discard**]

One tap confirms the log. The user never has to manually enter anything if the AI heard correctly.

**Transcription log:**
Full call history with:
- AI-generated "Key Takeaway" highlighted at the top of each entry (e.g., "Check back Thursday — shipment expected")
- Full transcript expandable below
- Edit button to correct any extraction errors

**Privacy note displayed to user:** "Transcription stays on your device unless you choose to share it with the community."

---

### 5. Refill Countdown

Proactive refill management — the "know before you run out" feature.

**Setup flow:**
- Last fill date
- Days supply (typically 30)
- "Start hunting" lead time (default: 7 days before last pill)

**Display:**
- Large circular countdown ring on the Dashboard widget
- Full-screen detail view: days remaining, estimated run-out date, recommended start date, pill count estimator
- Push notification at the configured lead time: *"You have 7 days of medication left. Start your search now while you have time."*

**Copy:** Always frame as time ahead, not time until crisis. "Start in 3 days" not "3 days until you run out."

---

### 6. Private Vault

A privacy layer for users who want to track calls without contributing any data to the community.

**Behavior:**
- Tap the lock icon on any pharmacy to vault it
- Vaulted pharmacies are marked with a purple lock icon (`#8B5CF6`) throughout the app
- All calls, transcripts, and notes for vaulted pharmacies are stored on-device only — never synced, never shared, never included in community reports
- Vault status is per-pharmacy, not per-user — users can mix vaulted and non-vaulted pharmacies in the same hunt

**UX copy:** "This pharmacy is private. Your calls and notes stay on your device only." — one line, no further explanation needed.

**Vault lock screen:** If biometric auth is enabled in settings, opening the Vault section requires Face ID / fingerprint.

---

## Layer 2: Community Intelligence

### 7. Availability Map

Real-time, human-verified stock reports by zip code.

**Map view:**
- Dark map tile (Mapbox dark style — matches `bg-base`)
- Pin clusters by zip code, color-coded by recency trust score:
  - **Green** — confirmed fill <2 hours ago
  - **Yellow** — confirmed fill 2–24 hours ago
  - **Grey** — report >24 hours old (trust degraded)
  - **Red** — out of stock confirmed <24h
- **Recency trust badge** on each pin: "Verified fill 10m ago" / "Last report 6h ago"
- Tap a pin → bottom sheet: pharmacy name, reported strength, reporter count, time since last report, source filter tag (Community / Official)

**Source filter bar:**
Toggle between three data layers:
| Filter | Data source |
|---|---|
| My Logs | Personal call history only |
| Community | Crowdsourced contributor reports |
| Official | FDA / ASHP shortage data |

Multiple filters can be active simultaneously. Default: Community + Official.

**List fallback:** Users with location permission denied get a zip-code search list view.

**Disclaimer:** "Reports from contributors. Verify with pharmacy before driving." — directly addresses trust skepticism from research.

---

### 8. Regional Heatmaps (Give-to-Get)

Macro-level shortage visibility. Answers: "Is it bad everywhere, or just near me?"

**Give-to-Get access model:**
- The heatmap layer is **blurred** until the user has submitted their own monthly status report
- Blur overlay shows the shape of the data with a prompt: "Submit your fill status to unlock the regional map — takes 10 seconds."
- Once unlocked, heatmap access persists for 30 days from the last contribution

**Heatmap display:**
- Choropleth layer overlaid on the availability map
- State/county level fill rate intensity
- Toggle in the map filter bar: "Regional Heatmap"
- Useful for users willing to drive further or use mail-order

**Rationale:** Give-to-get creates a self-sustaining contribution loop without requiring payment. It also frames contribution as fair exchange, not charity.

---

### 9. Shortage Alerts

Push notification system for proactive stock intelligence.

**Alert types:**
- "Stock arriving at [pharmacy] near you — reported 20 min ago"
- "Regional shortage worsening in [metro area] — start your search earlier this month"
- "New shipment pattern detected: [manufacturer] arriving Tuesdays at [chain]"

**Settings:** Users configure alert radius, medication/strength, and quiet hours. Default: 10-mile radius, no alerts 10pm–8am.

---

### 10. Advanced Predictions (Premium Intel)

ML-driven refill timing and availability recommendations.

**Access:** Premium / Power User tier. Free users see the card title and one teaser data point; full detail is paywalled.

**Content:**
- "Based on 847 reports in your area, [strength] tends to arrive at chain pharmacies on Thursdays"
- "Your local CVS has had stock 3 of the last 4 weeks — highest probability near you"
- Manufacturer/generic brand-specific shortage alerts
- Regional trend reports: "Shortage in [metro] worsening — 34% fewer fills reported vs. last month"

**Placement:** Surfaced as an "Insights" card on the Dashboard. Tapping opens a full Insights screen.

---

## Subscription / Access Tiers

| Feature | Free | Contributor | Premium |
|---|---|---|---|
| Pharmacy Dialer | ✓ | ✓ | ✓ |
| Script Drawer | ✓ | ✓ | ✓ |
| Refill Countdown | ✓ | ✓ | ✓ |
| Call Log (manual) | ✓ | ✓ | ✓ |
| AI Transcription | Limited (5/mo) | ✓ | ✓ |
| Private Vault | ✓ | ✓ | ✓ |
| Community Map | ✓ | ✓ | ✓ |
| Official (FDA/ASHP) data | ✓ | ✓ | ✓ |
| Regional Heatmap | Blurred | Unlocked by contributing | ✓ |
| Shortage Alerts | Basic | ✓ | ✓ |
| Advanced Predictions | — | — | ✓ |
| Manufacturer alerts | — | — | ✓ |

Contributor status = submitted a fill report in the last 30 days. No payment required.

---

## Navigation Structure

Bottom tab bar — 4 tabs:

| Tab | Icon | Screen |
|---|---|---|
| Home | House | Dashboard |
| Hunt | Phone | Pharmacy Dialer + Call Tracker |
| Map | Map pin | Availability Map |
| Profile | Person | Settings, account, subscription |

**Hunt tab sub-navigation** (top segmented control, not nested tabs):
- Dialer (default)
- Call Log / Transcription History

No hamburger menus. Everything reachable in 2 taps from anywhere.

---

## Caregiver Mode

Toggled at onboarding ("Managing a child's prescription?") or in Profile settings.

**Differences from adult mode:**
- Copy shifts: "your child's medication" instead of "your medication"
- Dashboard label: child's name + medication instead of anonymous
- Alert language: "Make sure [name] doesn't miss a dose" — child-protective framing
- Scripts auto-fill with caregiver framing: "I'm a parent picking up for my child..."
- Supports multiple profiles (parent managing 2+ children)

---

## Empty States & Error States

These are high-stakes moments — a confused empty state costs a refill.

- **No pharmacies in dialer yet:** "Add your local pharmacies once — call them every month in one tap." + Add button.
- **No calls logged yet:** "Your hunt log is empty. Tap below when you make your first call." + large CTA.
- **Map with no nearby reports:** "No reports in your area yet. Be the first to contribute — it takes 10 seconds."
- **Network error:** "Can't reach the community right now. Your call log and scripts still work offline."
- **Out of stock everywhere nearby:** "We're not seeing stock nearby right now. Check the regional map or try expanding your radius." — never a dead end.
- **AI transcription failed:** "Couldn't catch that call. Tap to log the outcome manually." — one tap, no friction.

---

## Accessibility

- All tap targets minimum 48×48pt
- Color is never the only status indicator — always paired with text or icon
- Status badges: use both color AND label ("In Stock ✓" not just a green dot)
- Script text renders at 16pt minimum — readable while on a call
- Haptic feedback on key actions: call connected, log confirmed, fill secured, alert received
- VoiceOver/TalkBack labels on all custom components

---

## What Not To Build (Phase 1)

Per the messaging guardrails from user research:

- No "managing your ADHD" language anywhere in the UI
- No features that imply the user is disorganized or needs reminders beyond refill timing
- No social/sharing features that expose ADHD status publicly
- No gamification — streaks, badges, points. This is a utility, not a habit app.
- No "Never miss a dose again" promise copy — triggers skepticism from users burned by systems that didn't deliver
