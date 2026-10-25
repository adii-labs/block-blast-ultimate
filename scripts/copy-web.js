const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const webRoot = path.join(projectRoot, 'www');

for (const entry of ['index.html', 'src', 'assets']) {
  const source = path.join(projectRoot, entry);
  const destination = path.join(webRoot, entry);

  if (!fs.existsSync(source)) {
    throw new Error(`Required web content not found: ${entry}`);
  }

  fs.cpSync(source, destination, { recursive: true, force: true });
}

console.log('Web app copied to www/.');