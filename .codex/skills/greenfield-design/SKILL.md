---
name: greenfield-design
description: Scaffolds a Next.js site with impeccable-driven design from an empty folder. Called only by bodega-setup when no project exists. Invokes impeccable's teach-impeccable and frontend-design skills, wrapping prompts in simple voice when appropriate.
---

# Bodega: Greenfield Design

Runs only when `$bodega:setup` detects an empty folder.
Creates the canvas that commerce will later live on.

## Pre-checks

1. Read `.bodega.md`. Require `mode_detected: greenfield`. Otherwise exit —
   this skill is not meant to be invoked directly.
2. Confirm we're in the intended project root (empty folder + `.bodega.md`).

## Step 1 — Ensure impeccable is installed

Check if `impeccable` is available as a skill in the current IDE.

- Present → continue to Step 2.
- Absent → say (in chosen voice):

### Developer voice:

> Impeccable not installed. Installing:
> `npx skills add pbakaus/impeccable --yes --global`
> (the `--yes --global` flags skip the upstream installer's
> interactive multi-select picker, which hangs in non-TTY shells).

### Simple voice:

> I'm going to install a design helper called *impeccable*. Free,
> open-source, made by someone who cares a lot about how websites
> look. Takes a few seconds.

Wait for install. If install fails, be honest and offer to continue
with our basic template (much weaker output).

## Step 2 — Scaffold Next.js

```
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --no-git
```

Notes (internal, not for the user):
- `.` scaffolds in current dir
- `--no-git` because `$bodega:backup` handles git
- `--app` for App Router

## Step 3 — Gather design context via impeccable

Invoke `$impeccable:teach-impeccable`. It will ask about
references, palette, typography, voice.

### If voice is "simple":

Prep the user first:

> I'm going to ask about how you want your site to look. Colors, feeling,
> any sites you love. No right answers — tell me in your own words. If
> you're not sure, say "surprise me."

Then invoke impeccable. If its prompts feel technical, act as translator —
rephrase for the user and relay answers back.

### If voice is "developer":

Invoke impeccable directly. Developer users handle it fine.

## Step 4 — Let impeccable build the site

Invoke `$impeccable:frontend-design` with the context
from Step 3. Impeccable generates:

- `app/layout.tsx`, `app/page.tsx`, marketing pages
- Font loading via `next/font`
- Tailwind + CSS custom properties for the palette
- Custom components (decorative marks, photo treatments, etc.)
- `.impeccable.md` capturing design decisions

Takes several minutes. Keep the user posted.

### Simple voice:

> *Building your site now. This is the slow part — making it look
> hand-built, not template-y. Grab a coffee, I'll ping you when it's
> ready.*

### Developer voice:

> *Scaffolding via impeccable:frontend-design. ~10-20 min.*

## Step 5 — Design review point

After impeccable finishes, start a local preview so the user can
actually see the site. Run `npm run dev` as a background process, wait
for the "Ready" line (usually 2–5 seconds), then show the URL. Kill
the process when the user is ready to move on.

### Simple voice:

> Okay, I built you a first draft of the site. I'm starting a preview
> on your computer right now — give it a few seconds.
>
> When it's ready, open this in your browser:
> **http://localhost:3000**
>
> Take a look. Does it feel right? If not, just tell me what's off
> in your own words — "too minimal", "colors feel cold", "headings
> too big", "doesn't feel like me" — and I'll adjust. No design
> vocabulary needed.

### Developer voice:

> Preview up on http://localhost:3000. Iterate with impeccable
> (polish, bolder, typeset, etc.) or move on to commerce?

If the user wants changes, route their free-text feedback to the right
impeccable skill:

- "too tame" → `$impeccable:bolder`
- "too loud" → `$impeccable:quieter`
- "text feels off" → `$impeccable:typeset`
- "spacing/layout issues" → `$impeccable:arrange` or `$impeccable:polish`
- general "not quite right" → `$impeccable:critique` then iterate

Loop until happy (or "good enough").

## Step 6 — Update `.bodega.md` and return

Update `.bodega.md`:
- `mode_detected: adapt` (project now exists)
- Add note under free-form section:

```
Design scaffolded by impeccable on [date].
Tokens captured in .impeccable.md.
```

Return control to `$bodega:setup`, which continues to
the Hosting step.

## Rules

- **Don't invoke impeccable skills that weren't requested.** No running
  `impeccable:audit` or `impeccable:harden` automatically.
- **Don't skip the design review.** Commerce is sticky — reworking
  visual language after commerce is wired is more painful than before.
- **Respect impeccable's output.** Don't second-guess or "fix" its work.
  Route feedback back to impeccable; don't patch over it yourself.
