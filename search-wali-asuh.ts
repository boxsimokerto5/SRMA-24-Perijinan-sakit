import * as fs from 'fs';

const content = fs.readFileSync('src/components/WaliAsramaView.tsx', 'utf8');
const terms = ['piket', 'potong', 'rambut', 'tausiyah', 'tauziyah', 'absensi', 'berobat', 'uks', 'kartu'];

for (const term of terms) {
  let count = 0;
  let idx = 0;
  while (true) {
    idx = content.toLowerCase().indexOf(term.toLowerCase(), idx);
    if (idx === -1) break;
    count++;
    idx += term.length;
  }
  console.log(`Term "${term}" found ${count} times in WaliAsramaView.tsx`);
}
