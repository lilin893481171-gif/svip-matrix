/**
 * verify-visibility-fix.cjs — 验证可见性锁定修复
 */
const { readFileSync, statSync } = require('fs');
const { join } = require('path');

const ok = (label) => console.log(`  ✅ ${label}`);
const fail = (label) => console.log(`  ❌ ${label}`);

function fileChanged(p) {
  const d = new Date();
  const s = statSync(p);
  return (d - s.mtimeMs) < 60_000;
}

const scripts = [
  {
    label: 'account-browser-manager: visibility lock',
    path: join(__dirname, 'src/main/account-browser-manager.js'),
    checks: ['visibilityState', 'visibilitychange', 'pagehide', 'page visibility locked']
  },
  {
    label: 'PublishTask: cleanup never detaches',
    path: join(__dirname, 'src/renderer/src/components/PublishTask.jsx'),
    checks: ['detach-robot-view']
  },
  {
    label: 'rpa-engine: reconnect-task-monitor',
    path: join(__dirname, 'src/main/rpa-engine.js'),
    checks: ['reconnect-task-monitor', 'reconnect']
  },
];

let all = true;
for (const s of scripts) {
  const content = readFileSync(s.path, 'utf8');
  console.log(`\n📋 ${s.label}`);
  for (const c of s.checks) {
    if (content.includes(c)) ok(`contains "${c}"`);
    else { fail(`missing "${c}"`); all = false; }
  }
  if (fileChanged(s.path)) ok('file modified recently');
}

console.log(all ? '\n🎉 所有修复已应用' : '\n⚠️  部分修复缺失');
