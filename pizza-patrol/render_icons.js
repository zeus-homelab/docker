// Renders the launcher icon from the game's own drawing code. Usage: node render_icons.js <appDir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const app = path.resolve(process.argv[2] || 'app');
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + path.join(app, 'assets/index.html'));
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, px] of Object.entries(sizes)) {
    const data = await pg.evaluate(px => { const c = document.createElement('canvas'); c.width = c.height = px; window.__drawIcon(c); return c.toDataURL('image/png').split(',')[1]; }, px);
    const dir = path.join(app, 'res', 'mipmap-' + d); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), Buffer.from(data, 'base64'));
  }
  await b.close();
})();
