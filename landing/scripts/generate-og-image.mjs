// One-off Open Graph share image generator — NOT wired into `astro build`.
//
// Renders a 1200x630 PNG: the Slate `--primary` background with the
// `SITE_NAME` wordmark in `--primary-foreground`, per locked decision D-01
// (44-CONTEXT.md) — no brand-mark image asset exists in this codebase, so
// the share image is generated programmatically instead of hand-designed.
//
// Tooling:
//   - satori (github.com/vercel/satori) turns a plain object element tree
//     into SVG. It has no CSS engine — only inline style objects on plain
//     `{ type, props: { style, children } }` nodes are supported, and its
//     color parser does NOT understand `oklch()` or CSS custom properties.
//   - @resvg/resvg-js (github.com/yisibl/resvg-js) rasterizes that SVG to a
//     PNG buffer.
//
// Color provenance: the two hex literals below are the pre-converted sRGB
// equivalents of this project's Slate design tokens, computed once during
// planning via the standard OKLab -> linear sRGB matrix + sRGB gamma encode
// (see `landing/src/styles/global.css` `:root` block):
//   --primary            oklch(0.39 0.035 256)  -> #394658
//   --primary-foreground oklch(0.985 0 0)       -> #FAFAFA
// If the Slate palette ever changes, re-derive these two hex values from
// the updated oklch source and re-run `npm run generate:og`.

import { readFileSync, writeFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { SITE_NAME } from '../src/consts.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND = '#394658'; // --primary
const FOREGROUND = '#FAFAFA'; // --primary-foreground

const fontPath = new URL('./fonts/Lato-Semibold.ttf', import.meta.url);
const fontBuffer = readFileSync(fontPath);

const tree = {
  type: 'div',
  props: {
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BACKGROUND
    },
    children: {
      type: 'div',
      props: {
        style: {
          color: FOREGROUND,
          fontSize: 96,
          fontWeight: 600,
          fontFamily: 'Lato'
        },
        children: SITE_NAME
      }
    }
  }
};

const svg = await satori(tree, {
  width: WIDTH,
  height: HEIGHT,
  fonts: [
    {
      name: 'Lato',
      data: fontBuffer,
      weight: 600,
      style: 'normal'
    }
  ]
});

const resvg = new Resvg(svg);
const rendered = resvg.render();

if (rendered.width !== WIDTH || rendered.height !== HEIGHT) {
  throw new Error(
    `Rendered OG image is ${rendered.width}x${rendered.height}, expected ${WIDTH}x${HEIGHT}`
  );
}

const png = rendered.asPng();
const outputPath = new URL('../public/og-image.png', import.meta.url);
writeFileSync(outputPath, png);

console.log(`Wrote ${outputPath.pathname} (${png.byteLength} bytes, ${WIDTH}x${HEIGHT})`);
