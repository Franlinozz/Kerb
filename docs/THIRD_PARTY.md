# Third-party assets

## Fonts

| Family | Weights | Licence | How it reaches the site |
|---|---|---|---|
| General Sans | 300, 400, 500, 600 | ITF Free Font License 2.0 (Fontshare, Indian Type Foundry). Commercial use and self-hosting on our own site are allowed; redistribution of the font files, including through a public repository, is not | `apps/web/scripts/fetch-fonts.mjs` downloads the files from Fontshare at build time into `apps/web/src/fonts/`, which is git-ignored. The licence text is fetched alongside them. The build fails if they cannot be fetched |
| Instrument Serif | 400, 400 italic | SIL Open Font License 1.1 | `next/font/google`, self-hosted by Next.js at build time |
| IBM Plex Mono | 400, 500 | SIL Open Font License 1.1 | `next/font/google`, self-hosted by Next.js at build time |

Rung: General Sans is on rung 1 (the specified family). Hanken Grotesk is only the CSS fallback name.

## Icons

lucide-react (ISC licence), used for interface icons only.

## Art

Every art slot uses one of the operator's own plates (docs/v2/ART.md). A slot without a plate draws the geometric Kerbstone: an inline SVG made from the Kerb mark. No stock imagery is used anywhere.
