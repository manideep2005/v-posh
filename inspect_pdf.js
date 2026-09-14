const fs = require('fs');
const zlib = require('zlib');
const path = process.argv[2] || 'status_check.pdf';
const p = fs.readFileSync(path);
const s = p.toString('binary');

const pageRe = /(\d+)\s+(\d+)\s+obj\s*<<([\s\S]*?)\/Type\s*\/Page/g;
let pm;
while ((pm = pageRe.exec(s))) {
  const [, , , header] = pm;
  const contentsRe = /\/Contents\s+(\d+)\s+(\d+)\s+R/g;
  let cm;
  while ((cm = contentsRe.exec(header))) {
    const [cNum, cGen] = [cm[1], cm[2]];
    const objStart = s.lastIndexOf(cNum + ' ' + cGen + ' obj', cm.index - 200);
    if (objStart < 0) continue;
    const objEnd = s.indexOf('endobj', cm.index);
    if (objEnd < 0) continue;
    const body = s.slice(objStart, objEnd + 6);
    const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/;
    const sm = body.match(streamRe);
    if (!sm) continue;
    const raw = sm[1];
    let data;
    try { data = zlib.inflateSync(Buffer.from(raw, 'binary')); }
    catch (e1) {
      try { data = zlib.inflateRawSync(Buffer.from(raw, 'binary')); }
      catch (e2) { continue; }
    }
    console.log('=== PAGE ' + pm[1] + ' CONTENT STREAM ===');
    console.log(data.toString('binary').slice(0, 3000));
    process.exit(0);
  }
}
console.log('no page content found');
