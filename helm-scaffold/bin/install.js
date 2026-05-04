#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: npx helm-scaffold-skill [options]

Options:
  --local    Install to .claude/skills/helm-scaffold/ in the current directory
  --help     Show this help

Default: installs to ~/.claude/skills/helm-scaffold/ (available in all projects)
`);
  process.exit(0);
}

const isLocal = args.includes('--local');
const installDir = isLocal
  ? path.join(process.cwd(), '.claude', 'skills', 'helm-scaffold')
  : path.join(os.homedir(), '.claude', 'skills', 'helm-scaffold');

const pkgRoot = fs.realpathSync(path.join(__dirname, '..'));
const realInstallDir = fs.existsSync(installDir)
  ? fs.realpathSync(installDir)
  : installDir;

if (realInstallDir === pkgRoot) {
  console.log(`\nhelm-scaffold-skill: skipping install — install target is the package source (symlink dev setup).`);
  console.log(`Skill is already available at: ${installDir}`);
  process.exit(0);
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// dist/cli.bundle.js
copyFile(
  path.join(pkgRoot, 'dist', 'cli.bundle.js'),
  path.join(installDir, 'dist', 'cli.bundle.js')
);

// scripts/validate.sh (executable)
const validateDest = path.join(installDir, 'scripts', 'validate.sh');
copyFile(path.join(pkgRoot, 'scripts', 'validate.sh'), validateDest);
fs.chmodSync(validateDest, 0o755);

// REFERENCE.md
copyFile(
  path.join(pkgRoot, 'REFERENCE.md'),
  path.join(installDir, 'REFERENCE.md')
);

// SKILL.md — replace __SKILL_DIR__ placeholder with actual install path
const skillMd = fs.readFileSync(path.join(pkgRoot, 'SKILL.md'), 'utf8');
fs.writeFileSync(
  path.join(installDir, 'SKILL.md'),
  skillMd.replaceAll('__SKILL_DIR__', installDir)
);

const scope = isLocal ? 'project-local' : 'global';
console.log(`\nhelm-scaffold-skill installed (${scope})`);
console.log(`  → ${installDir}`);
console.log('\nThe skill is now available in Claude Code.');
if (isLocal) {
  console.log('Note: skill is scoped to this project only.');
}
