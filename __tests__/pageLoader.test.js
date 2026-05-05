import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import nock from 'nock';

import pageLoader from '../src/pageLoader.js';

describe('pageLoader', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('downloads page and saves it', async () => {
    const url = 'https://example.com/test';
    const html = '<html><body>Hello</body></html>';

    nock('https://example.com')
      .get('/test')
      .reply(200, html);

    const filePath = await pageLoader(url, tempDir);

    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('Hello');
  });

  test('downloads images and rewrites paths', async () => {
    const url = 'https://example.com/page';

    const html = `
      <html>
        <body>
          <img src="/assets/test.png">
        </body>
      </html>
    `;

    const imageData = Buffer.from('fake-image-content');

    // mock HTML
    nock('https://example.com')
      .get('/page')
      .reply(200, html);

    // mock imagen
    nock('https://example.com')
      .get('/assets/test.png')
      .reply(200, imageData);

    const filePath = await pageLoader(url, tempDir);

    const content = await fs.readFile(filePath, 'utf-8');

    // ✔ HTML reescrito
    expect(content).toContain('example-com-page_files');

    // ✔ carpeta creada
    const filesDir = path.join(tempDir, 'example-com-page_files');
    const files = await fs.readdir(filesDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.png$/);

    // ✔ archivo descargado correctamente (binario)
    const imagePath = path.join(filesDir, files[0]);
    const savedImage = await fs.readFile(imagePath);

    expect(savedImage.equals(imageData)).toBe(true);
  });

  test('ignores img without src', async () => {
    const url = 'https://example.com/page';

    const html = `
      <html>
        <body>
          <img>
        </body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, html);

    const filePath = await pageLoader(url, tempDir);

    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('<img>');
  });
});