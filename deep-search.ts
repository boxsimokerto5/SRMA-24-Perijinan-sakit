import * as fs from 'fs';
import * as path from 'path';

const keywords = ['piket', 'potong rambut', 'potong_rambut', 'tausiyah', 'tauziyah', 'absensi'];

function searchDirectory(dir: string, depth = 0) {
  if (depth > 12) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === '.git' || file === 'proc' || file === 'sys' || file === 'dev' || file === 'lib' || file === 'usr') {
        continue;
      }
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchDirectory(fullPath, depth + 1);
        } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json'))) {
          // If the file is inside the current src/ directory, we might have overwritten it, but let's check everywhere else first
          // Actually, let's read the file anyway to see if it contains keywords
          const content = fs.readFileSync(fullPath, 'utf8');
          const found = keywords.filter(kw => content.toLowerCase().includes(kw));
          if (found.length > 0) {
            console.log(`FOUND FILE: ${fullPath} size: ${stat.size} bytes. Contained keywords: ${found.join(', ')}`);
            // Print top lines to check
            console.log(`Preview: ${content.substring(0, 200)}...\n`);
          }
        }
      } catch (e) {
        // Skip inaccessible
      }
    }
  } catch (e) {
    // Skip
  }
}

console.log("Starting deep recovery search across entire system...");
searchDirectory('/app');
searchDirectory('/tmp');
searchDirectory('/root');
console.log("Deep recovery search finished.");
