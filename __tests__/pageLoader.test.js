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

  test('downloads page and saves it', async () => {
    const url = 'https://example.com/test';
    const html = '<html><body>Hello</body></html>';

    nock('https://example.com')
      .get('/test')
      .reply(200, html);

    const filePath = await pageLoader(url, tempDir);

    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toBe(html);
  });
});
