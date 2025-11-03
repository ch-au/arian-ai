#!/usr/bin/env node

// Copy Python scripts to dist/ for Azure deployment
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'scripts');
const destDir = path.join(__dirname, 'dist', 'scripts');

if (!fs.existsSync(srcDir)) {
  console.log('⚠️  scripts directory not found, skipping Python script copy');
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy requirements.txt
const requirementsSrc = path.join(srcDir, 'requirements.txt');
const requirementsDest = path.join(destDir, 'requirements.txt');
if (fs.existsSync(requirementsSrc)) {
  fs.copyFileSync(requirementsSrc, requirementsDest);
  console.log('✅ Copied requirements.txt');
}

// Copy all .py files
const files = fs.readdirSync(srcDir);
files.forEach(file => {
  if (file.endsWith('.py')) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ Copied ${file}`);
  }
});

// Copy tests directory if it exists
const testsSrc = path.join(srcDir, 'tests');
const testsDest = path.join(destDir, 'tests');
if (fs.existsSync(testsSrc)) {
  fs.cpSync(testsSrc, testsDest, { recursive: true });
  console.log('✅ Copied tests directory');
}

// Copy negotiation_models.py and negotiation_utils.py (if they exist)
['negotiation_models.py', 'negotiation_utils.py'].forEach(file => {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ Copied ${file}`);
  }
});

console.log('✅ Python scripts copied to dist/scripts');

