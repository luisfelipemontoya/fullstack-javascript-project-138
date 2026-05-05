import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// genera nombre de archivo html
const makeFileName = (url) => {
  const { hostname, pathname } = new URL(url);

  const ext = path.extname(pathname);

  const raw = `${hostname}${pathname.replace(ext, '')}`;

  const normalized = raw
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const maxLength = 100; //limitar longitud del nombre

  const trimmed = normalized.slice(0, maxLength);

  return `${trimmed}.html`;
};

// nombre carpeta recursos
const makeDirName = (url) => {
  return makeFileName(url).replace('.html', '_files');
};

// nombre archivo recurso
const makeAssetName = (url) => {
  const { hostname, pathname } = new URL(url);

  const ext = path.extname(pathname);

  const raw = `${hostname}${pathname.replace(ext, '')}`;

  const normalized = raw
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const maxLength = 100;

  const trimmed = normalized.slice(0, maxLength);

  return `${trimmed}${ext}`;
};

const pageLoader = (url, outputDir = process.cwd()) => {
  return axios.get(url)
    .then((response) => {
      const html = response.data;

      const fileName = makeFileName(url);
      const filePath = path.join(outputDir, fileName);

      const dirName = makeDirName(url);
      const dirPath = path.join(outputDir, dirName);

      const $ = cheerio.load(html);

      const imgElements = $('img');

      const images = [];

      imgElements.each((i, el) => {
        const src = $(el).attr('src');

        if (!src) return;

        const imageUrl = new URL(src, url).href;

        const assetName = makeAssetName(imageUrl);

        const localPath = path.join(dirName, assetName);

        images.push({
          url: imageUrl,
          name: assetName,
          localPath,
          element: el,
        });
      });

      // crear carpeta
      return fs.mkdir(dirPath, { recursive: true })
        .then(() => Promise.all(
          images.map((img) => axios.get(img.url, {
            responseType: 'arraybuffer', // 🔥 clave
          }).then((res) => {
            const fileFullPath = path.join(dirPath, img.name);
            return fs.writeFile(fileFullPath, res.data);
          })),
        ))
        .then(() => {
          // reescribir HTML
          images.forEach((img) => {
            $(img.element).attr('src', img.localPath);
          });

          const updatedHtml = $.html();

          return fs.writeFile(filePath, updatedHtml);
        })
        .then(() => filePath);
    });
};

export default pageLoader;