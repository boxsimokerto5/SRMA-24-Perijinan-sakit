import * as fs from 'fs';
import * as path from 'path';

const bundlePath = '/app/applet/dist/assets/index-BPvYrdI5.js';

if (!fs.existsSync(bundlePath)) {
  console.log("No compiled asset bundle found at " + bundlePath);
} else {
  const code = fs.readFileSync(bundlePath, 'utf8');
  console.log(`Bundle size: ${code.length} bytes`);

  // Search for the keys of WaliAsuhView viewModes
  // Let's find any occurrences of 'piket', 'potong_rambut', 'tausiyah' or 'tauziyah' in the bundle code
  // We can write regex to search around these words and print sections of code
  const keywords = ['potong_rambut', 'tausiyah_spinner', 'tausiyah', 'piket', 'absensi', 'uks', 'catatan_berobat_uks'];
  
  for (const kw of keywords) {
    let index = 0;
    console.log(`\n=== SEARCHING FOR KEYWORD: "${kw}" ===`);
    while (true) {
      index = code.indexOf(kw, index);
      if (index === -1) break;
      const start = Math.max(0, index - 250);
      const end = Math.min(code.length, index + 250);
      console.log(`[Pos ${index}]: ...${code.substring(start, end).replace(/\n/g, ' ')}...`);
      index += kw.length + 1000; // Skip ahead to cover unique occurrences
    }
  }
}
