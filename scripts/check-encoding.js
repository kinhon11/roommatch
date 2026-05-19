const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = ['backend', 'frontend/src', 'README.md', 'PRODUCT.md', 'DESIGN.md'];
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.css', '.html', '.env', '.example']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage']);

const mojibakeSignatures = [
  '\u00c3',
  '\u00c2',
  '\u00c4',
  '\u00c6',
  '\u00c5',
  '\u00f0\u0178',
  '\u00e2\u20ac',
  '\u00e2\u0153',
  '\u00e2\u009d',
  '\u00e2\u0161',
  '\u00e1\u00ba',
  '\u00e1\u00bb',
];

const walk = (target) => {
  const absolute = path.join(ROOT, target);
  if (!fs.existsSync(absolute)) return [];

  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  if (IGNORED_DIRS.has(path.basename(absolute))) return [];

  return fs.readdirSync(absolute).flatMap((entry) => walk(path.relative(ROOT, path.join(absolute, entry))));
};

const isTextFile = (file) => {
  const ext = path.extname(file);
  return TEXT_EXTENSIONS.has(ext) || file.endsWith('.env.example');
};

const failures = [];
for (const target of TARGETS) {
  for (const file of walk(target)) {
    if (!isTextFile(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const signature = mojibakeSignatures.find(item => content.includes(item));
    if (signature) {
      failures.push(path.relative(ROOT, file));
    }
  }
}

if (failures.length) {
  console.error('Found files with mojibake-like encoding artifacts:');
  for (const file of failures) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Encoding check passed: no mojibake-like artifacts found.');
