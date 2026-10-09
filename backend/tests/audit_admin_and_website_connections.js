'use strict';

const fs = require('fs');
const path = require('path');

// 1. Load backend Express app and extract all registered routes
const app = require('../src/app');

function extractRoutes(app) {
  const routes = [];

  function print(path, layer) {
    if (layer.route) {
      layer.route.stack.forEach(print.bind(null, path + (layer.route.path || '')));
    } else if (layer.name === 'router' && layer.handle.stack) {
      let routerPath = path;
      if (layer.regexp) {
        const match = layer.regexp.source
          .replace('\\/?(?=\\/|$)', '')
          .replace('^\\', '')
          .replace('\\/', '/')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\^|\$/g, '');
        if (match && match !== '/') {
          routerPath = (routerPath + '/' + match).replace(/\/+/g, '/');
        }
      }
      layer.handle.stack.forEach(print.bind(null, routerPath));
    } else if (layer.method) {
      routes.push({
        method: layer.method.toUpperCase(),
        path: (path || '/').replace(/\/+/g, '/')
      });
    }
  }

  app._router.stack.forEach(print.bind(null, ''));
  return routes;
}

const backendRoutes = extractRoutes(app);

// Also format a clean list of backend endpoints
console.log('====================================================');
console.log(`  BACKEND HAS ${backendRoutes.length} REGISTERED ENDPOINTS`);
console.log('====================================================\n');

// 2. Scan frontend-admin for all API calls
const adminDir = path.resolve(__dirname, '../../frontend-admin');

function getFilesRecursively(dir, filterExt = ['.ts', '.tsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        results = results.concat(getFilesRecursively(fullPath, filterExt));
      }
    } else if (filterExt.includes(path.extname(file))) {
      results.push(fullPath);
    }
  });
  return results;
}

const adminFiles = getFilesRecursively(adminDir);
console.log(`Scanning ${adminFiles.length} files in frontend-admin...`);

const apiCallRegex = /apiClient\.(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
const adminApiCalls = [];

adminFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = apiCallRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    let url = match[2];
    adminApiCalls.push({
      file: path.relative(adminDir, filePath).replace(/\\/g, '/'),
      method,
      url,
    });
  }
});

console.log(`Found ${adminApiCalls.length} apiClient calls in frontend-admin.\n`);

// 3. Normalize and match against backend routes
function matchRoute(calledMethod, calledUrl, backendRoutes) {
  // Strip query string
  const cleanUrl = '/api/v1' + (calledUrl.startsWith('/') ? calledUrl : '/' + calledUrl).split('?')[0];
  const urlParts = cleanUrl.split('/').filter(Boolean);

  for (const bRoute of backendRoutes) {
    if (bRoute.method !== calledMethod) continue;
    
    const bParts = bRoute.path.split('/').filter(Boolean);
    if (bParts.length !== urlParts.length) continue;

    let matches = true;
    for (let i = 0; i < urlParts.length; i++) {
      const uPart = urlParts[i];
      const bPart = bParts[i];
      if (bPart.startsWith(':')) {
        continue; // parameter matches anything
      }
      if (uPart.startsWith('${')) {
        continue; // template parameter matches
      }
      if (uPart !== bPart) {
        matches = false;
        break;
      }
    }

    if (matches) return { matched: true, route: bRoute.path };
  }

  return { matched: false };
}

const missingOrMismatched = [];
const verifiedCalls = [];

adminApiCalls.forEach(call => {
  const result = matchRoute(call.method, call.url, backendRoutes);
  if (result.matched) {
    verifiedCalls.push({ ...call, backendPath: result.route });
  } else {
    missingOrMismatched.push(call);
  }
});

console.log('====================================================');
console.log(`  ADMIN API CONNECTION AUDIT`);
console.log('====================================================');
console.log(`Verified Endpoints: ${verifiedCalls.length}`);
console.log(`Missing or Mismatched Endpoints: ${missingOrMismatched.length}\n`);

if (missingOrMismatched.length > 0) {
  console.log('--- MISSING / MISMATCHED ADMIN ENDPOINTS ---');
  // Deduplicate by method + url
  const seen = new Set();
  missingOrMismatched.forEach(item => {
    const key = `${item.method} ${item.url}`;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`[MISMATCH] ${item.method} ${item.url} (used in ${item.file})`);
    }
  });
  console.log('');
}

// 4. Check Website Links & Tracking
const websiteDir = path.resolve(__dirname, '../../../../src');
console.log('====================================================');
console.log('  WEBSITE CONNECTION AUDIT');
console.log('====================================================');

if (fs.existsSync(websiteDir)) {
  const websiteFiles = getFilesRecursively(websiteDir);
  console.log(`Scanning ${websiteFiles.length} files in website (src)...`);

  const hrefRegex = /href=["'`](https?:\/\/[^"'`]+|\/[^"'`]+)["'`]/g;
  const externalDomains = new Set();
  const internalPages = new Set();

  websiteFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = hrefRegex.exec(content)) !== null) {
      const link = m[1];
      if (link.startsWith('http')) {
        try {
          const u = new URL(link);
          externalDomains.add(u.origin);
        } catch(e) {}
      } else if (link.startsWith('/')) {
        internalPages.add(link);
      }
    }
  });

  console.log('\nExternal Links Origin Target:');
  externalDomains.forEach(d => console.log(' - ' + d));

  console.log('\nSample Internal Routes:');
  Array.from(internalPages).slice(0, 15).forEach(p => console.log(' - ' + p));
} else {
  console.log('Website directory not found at: ' + websiteDir);
}

// 5. Audit CORS Configuration
console.log('\n====================================================');
console.log('  CORS & ENVIRONMENT CONFIG AUDIT');
console.log('====================================================');
const envConfig = require('../src/config/env');
console.log('Frontend URL:', envConfig.frontendUrl);
console.log('Admin URL:', envConfig.platformAdminFrontendUrl);
console.log('Port:', envConfig.port);
