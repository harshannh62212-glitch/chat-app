#!/usr/bin/env node
/**
 * The Vercel project behind aegisv1.vercel.app (wired-io-music) runs
 * `npm run build` and publishes `dist/`. Without this, production stays
 * on the last successful wired-io build.
 */
const { execSync } = require('child_process');
const fs = require('fs');

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });

execSync(
  [
    'cp index.html landing.html styles.css rover_solo.html app.js dist/',
    'cp -a assets dist/assets',
    'mkdir -p dist/Hunch',
    'cp -a Hunch/nasa-llaso-cad dist/Hunch/nasa-llaso-cad'
  ].join(' && '),
  { stdio: 'inherit' }
);

if (!fs.existsSync('dist/index.html') || !fs.existsSync('dist/landing.html')) {
  console.error('vercel build did not produce index.html and landing.html');
  process.exit(1);
}

console.log('vercel build wrote dist/');
