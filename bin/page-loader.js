#!/usr/bin/env node

import { Command } from 'commander';
import pageLoader from '../src/pageLoader.js';

const program = new Command();

program
  .name('page-loader')
  .description('Page loader utility')
  .version('1.0.0')
  .argument('<url>')
  .option('-o, --output [dir]', 'output directory', process.cwd());

program.parse();

const { output } = program.opts();

const [url] = program.args;

pageLoader(url, output)
  .then((filePath) => {
    console.log(filePath);
  })
  .catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
