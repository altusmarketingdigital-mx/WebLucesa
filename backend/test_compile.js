import { pathToRegexp } from 'path-to-regexp';
try {
  console.log('Testing /api/products/:codigo(.*)');
  pathToRegexp('/api/products/:codigo(.*)');
  console.log('Success :codigo(.*)');
} catch(e) { console.log(e.message); }

try {
  console.log('Testing /api/products/:codigo([^/]*)');
  pathToRegexp('/api/products/:codigo([^/]*)');
  console.log('Success :codigo([^/]*)');
} catch(e) { console.log(e.message); }

try {
  console.log('Testing /api/products/(.*)');
  pathToRegexp('/api/products/(.*)');
  console.log('Success (.*)');
} catch(e) { console.log(e.message); }
