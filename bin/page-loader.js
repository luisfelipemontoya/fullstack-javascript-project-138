#!/usr/bin/env node

import pageLoader from '../src/pageLoader.js';

const url = process.argv[2];

pageLoader(url)
  .then((filePath) => {
    console.log(filePath);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
