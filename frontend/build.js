#!/usr/bin/env node
/**
 * Vercel project wired-io-music uses Root Directory `frontend`
 * (see DEPLOYMENT.md on the old chat-app tree) and publishes `dist/`.
 * This copies the NASA HUNCH site into that output so aegisv1.vercel.app
 * stops serving the last successful wired-io build.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(__dirname, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

function copy(rel) {
  const from = path.join(root, rel);
  if (!fs.existsSync(from)) {
    console.error('missing', from);
    process.exit(1);
  }
  execSync(`cp -a ${JSON.stringify(from)} ${JSON.stringify(path.join(dist, rel))}`, { stdio: 'inherit' });
}

for (const file of ['index.html', 'landing.html', 'styles.css', 'rover_solo.html', 'app.js']) {
  execSync(
    `cp ${JSON.stringify(path.join(root, file))} ${JSON.stringify(path.join(dist, file))}`,
    { stdio: 'inherit' }
  );
}
copy('assets');
fs.mkdirSync(path.join(dist, 'Hunch'), { recursive: true });
execSync(
  `cp -a ${JSON.stringify(path.join(root, 'Hunch', 'nasa-llaso-cad'))} ${JSON.stringify(path.join(dist, 'Hunch', 'nasa-llaso-cad'))}`,
  { stdio: 'inherit' }
);

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  process.exit(1);
}
console.log('frontend build wrote', dist);
