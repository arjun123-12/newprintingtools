const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(path.join(__dirname, '..', 'node_modules', '@kittl', 'little-cms', 'dist'));
files.forEach(fn => {
  if (fn.endsWith('.js')) {
    const p = path.join(__dirname, '..', 'node_modules', '@kittl', 'little-cms', 'dist', fn);
    let code = fs.readFileSync(p, 'utf8');
    code = code.replace(/from\s+['"]\.\/formatter['"]/g, "from './formatter.js'");
    code = code.replace(/from\s+['"]\.\/result['"]/g, "from './result.js'");
    code = code.replace(/from\s+['"]\.\/flags['"]/g, "from './flags.js'");
    code = code.replace(/from\s+['"]\.\/formats['"]/g, "from './formats.js'");
    code = code.replace(/from\s+['"]\.\/handles['"]/g, "from './handles.js'");
    code = code.replace(/from\s+['"]\.\/typeUtils['"]/g, "from './typeUtils.js'");
    fs.writeFileSync(p, code);
  }
});
console.log('Fixed @kittl/little-cms import extensions in all dist files.');
