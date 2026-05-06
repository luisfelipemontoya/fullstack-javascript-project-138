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

    nock('https://example.com')
      .get('/page')
      .reply(200, html);

    nock('https://example.com')
      .get('/assets/test.png')
      .reply(200, imageData);

    const filePath = await pageLoader(url, tempDir);
    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('example-com-page_files');

    const filesDir = path.join(tempDir, 'example-com-page_files');
    const files = await fs.readdir(filesDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.png$/);

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

  // 🔥 NUEVO TEST PASO 3
  test('downloads local resources (link, script) and ignores external', async () => {
    const url = 'https://example.com/page';

    const html = `
      <html>
        <head>
          <link href="/assets/app.css" rel="stylesheet">
          <link href="https://cdn.com/style.css" rel="stylesheet">
        </head>
        <body>
          <script src="/js/app.js"></script>
          <script src="https://cdn.com/lib.js"></script>
        </body>
      </html>
    `;

    const cssData = 'body { color: red; }';
    const jsData = 'console.log("hello");';

    nock('https://example.com')
      .get('/page')
      .reply(200, html);

    nock('https://example.com')
      .get('/assets/app.css')
      .reply(200, cssData);

    nock('https://example.com')
      .get('/js/app.js')
      .reply(200, jsData);

    const filePath = await pageLoader(url, tempDir);
    const content = await fs.readFile(filePath, 'utf-8');

    // ✔ locales reescritos
    expect(content).toContain('example-com-page_files');

    // ✔ externos NO modificados
    expect(content).toContain('https://cdn.com/style.css');
    expect(content).toContain('https://cdn.com/lib.js');

    const filesDir = path.join(tempDir, 'example-com-page_files');
    const files = await fs.readdir(filesDir);

    // ✔ solo recursos locales descargados
    expect(files.length).toBe(2);

    const savedCss = await fs.readFile(path.join(filesDir, files.find(f => f.endsWith('.css'))), 'utf-8');
    const savedJs = await fs.readFile(path.join(filesDir, files.find(f => f.endsWith('.js'))), 'utf-8');

    expect(savedCss).toBe(cssData);
    expect(savedJs).toBe(jsData);
  });
});