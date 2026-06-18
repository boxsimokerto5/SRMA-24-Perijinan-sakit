import * as fs from 'fs';
import * as path from 'path';

function findBackups(dir: string) {
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (f !== 'node_modules' && f !== '.git') {
          findBackups(full);
        }
      } else {
        if (f.toLowerCase().includes('asuh') || f.toLowerCase().includes('asrama') || f.toLowerCase().includes('backup')) {
          console.log(`Found file: ${full} (${stat.size} bytes)`);
        }
      }
    }
  } catch (e) {}
}

findBackups('/app');
