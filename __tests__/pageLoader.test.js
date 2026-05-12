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

    nock('https://example.com').get('/test').reply(200, html);

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

    nock('https://example.com').get('/page').reply(200, html);

    nock('https://example.com').get('/assets/test.png').reply(200, imageData);

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

    nock('https://example.com').get('/page').reply(200, html);

    const filePath = await pageLoader(url, tempDir);

    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('<img>');
  });

  test('downloads css and js and ignores external resources', async () => {
    const url = 'https://example.com/page';

    const html = `
      <html>
        <head>
          <link href="/assets/app.css" rel="stylesheet">
          <link href="https://cdn.com/style.css" rel="stylesheet">
        </head>
        <body>
          <script src="/js/app.js"></script>
          <script src="https://external.com/lib.js"></script>
        </body>
      </html>
    `;

    const cssData = 'body { color: red; }';
    const jsData = 'console.log("hello");';

    nock('https://example.com').get('/page').reply(200, html);

    nock('https://example.com').get('/assets/app.css').reply(200, cssData);

    nock('https://example.com').get('/js/app.js').reply(200, jsData);

    const filePath = await pageLoader(url, tempDir);

    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('example-com-page_files');

    const filesDir = path.join(tempDir, 'example-com-page_files');
    const files = await fs.readdir(filesDir);

    expect(files.length).toBe(2);

    expect(files.some((f) => f.endsWith('.css'))).toBe(true);
    expect(files.some((f) => f.endsWith('.js'))).toBe(true);

    const cssFile = files.find((f) => f.endsWith('.css'));
    const cssContent = await fs.readFile(path.join(filesDir, cssFile), 'utf-8');

    expect(cssContent).toBe(cssData);

    const jsFile = files.find((f) => f.endsWith('.js'));
    const jsContent = await fs.readFile(path.join(filesDir, jsFile), 'utf-8');

    expect(jsContent).toBe(jsData);
  });

  test('throws on 404', async () => {
    const url = 'https://ru.hexlet.io/unknown-page';

    nock('https://ru.hexlet.io').get('/unknown-page').reply(404);

    await expect(pageLoader(url, tempDir)).rejects.toThrow(
      'Failed to load page',
    );
  });

  test('throws when output directory does not exist', async () => {
    const url = 'https://ru.hexlet.io/courses';

    nock('https://ru.hexlet.io').get('/courses').reply(200, '<html></html>');

    const invalidDir = '/invalid/path';

    await expect(pageLoader(url, invalidDir)).rejects.toThrow(
      'Cannot create directory',
    );
  });
});
