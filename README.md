# Cosmere Timeline

An interactive, animated timeline of Brandon Sanderson's Cosmere books with multilingual UI, dynamic book overlays, and polished mobile behavior.

## Why This Is Cool

- Cinematic horizontal timeline with a live projection line.
- Rich hover/book overlay with cover art, world, year, and short blurb.
- Planet-based filtering with visual highlighting and snap-style navigation.
- Animated slider thumb (eclipse effect) and projection ray pulses when crossing books.
- Localization support (English + Ukrainian) across UI, labels, blurbs, and metadata.
- Mobile-friendly interactions with native momentum scrolling on iPhone.

## Feature Highlights

- **Book cards + overlays**
  - Contextual cover rendering with fallback cards.
  - Planet-colored accents and dynamic metadata.
  - Language-aware titles (including original-title display in non-English mode).

- **Timeline interactions**
  - `EARLIER` / `LATER` quick-jump controls.
  - Smooth lerp for programmatic scrolling.
  - Manual interaction always takes priority (auto-scroll cancels on user input).
  - Active “All Worlds” default filter state.

- **Visual polish**
  - Era labels and year marks “pop” near the projection line.
  - Color-matched vertical ray burst when the line crosses a current book.
  - Subtle glow treatment on the main title.

## Localization

- Language toggle (`EN` / `UK`) with persistent user preference (`localStorage`).
- Localized UI text, era labels, years, and book blurbs.
- Locale-aware cover selection with per-language overrides where available.

## Project Structure

- Single-file app in [`index.html`](./index.html) (HTML + CSS + JS).

## Rights Notice

All rights to books, titles, and cover artwork belong to their respective rightful owners.
