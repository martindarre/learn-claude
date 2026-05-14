# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

No build step. Open `index.html` directly in a browser:

```
open index.html
```

Each game is a standalone HTML file reachable from the home page.

## Architecture

Plain vanilla HTML/CSS/JS — no framework, no bundler, no dependencies.

**Entry point:** `index.html` — a card-grid home page linking to each game. Adding a new game means adding a card here and creating the corresponding files.

**Per-game file convention:** each game uses three separate files — `game.html`, `game.css`, `game.js`. Tictactoe currently violates this (inline CSS and JS in `tictactoe.html`); follow the separate-file pattern for any new or refactored game.

**Back navigation:** every game page includes `<a href="index.html" id="home-btn">← Hjem</a>` as the first child of `<body>`, styled with `position: fixed`.

## Snake game loop

`snake.js` runs a `requestAnimationFrame` loop with a manual delta-time accumulator to control step speed. State machine: `state ∈ { 'start', 'playing', 'dead' }`. The start screen runs its own `startLoop` with an AI-driven demo snake. On death, control passes to `deathLoop` which plays out particle/shake effects before accepting restart input.

## Design system

All pages share the same dark palette:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#1a1a2e` / `#0a1628` | Page / canvas |
| Green accent | `#4ecca3` | Snake, home page, headings |
| Red accent | `#e94560` | Tictactoe, food, danger |
| Muted text | `#888` / `#555` | Labels, hints |

Font: `'Segoe UI', sans-serif` everywhere. All UI text is in Norwegian (bokmål).

## Committing and pushing

After changes, commit and push to `origin/main` (GitHub: `martindarre/learn-claude`).
