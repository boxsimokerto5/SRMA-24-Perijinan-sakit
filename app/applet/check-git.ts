import { execSync } from 'child_process';

function run(cmd: string) {
  try {
    const out = execSync(cmd, { encoding: 'utf8' });
    console.log(`=== RUNNING: ${cmd} ===`);
    console.log(out || "(no output)");
  } catch (err: any) {
    console.error(`=== ERROR RUNNING: ${cmd} ===`);
    console.error(err.stdout || err.message);
  }
}

run("git status");
run("git log -n 10 --oneline");
run("git reflog -n 20");
