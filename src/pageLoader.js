
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// función para generar nombre
const makeFileName = (url) => {
  const { hostname, pathname } = new URL(url);

  const rawName = `${hostname}${pathname}`;
  
  const normalized = rawName
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${normalized}.html`;
};

const pageLoader = (url, outputDir = process.cwd()) => {
  return axios.get(url)
    .then((response) => {
      const html = response.data;

      const fileName = makeFileName(url);
      const filePath = path.join(outputDir, fileName);

      return fs.writeFile(filePath, html)
        .then(() => filePath);
    });
};

export default pageLoader;
