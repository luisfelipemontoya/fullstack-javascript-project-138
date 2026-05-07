import debug from 'debug';
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const log = debug('page-loader');

const makeFileName = (url) => {
    const { hostname, pathname } = new URL(url);

    const raw = `${hostname}${pathname}`;

    const normalized = raw
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return `${normalized}.html`;
};

const makeDirName = (url) => {
    return makeFileName(url).replace('.html', '_files');
};

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
    log(`started downloading: ${url}`);

    return axios.get(url)
        .then((response) => {
            const html = response.data;

            log('html loaded');

            const fileName = makeFileName(url);
            const filePath = path.join(outputDir, fileName);

            const dirName = makeDirName(url);
            const dirPath = path.join(outputDir, dirName);

            const $ = cheerio.load(html);

            const imgElements = $('img');
            const linkElements = $('link');
            const scriptElements = $('script');

            const resources = [];

            const isLocal = (resourceUrl, baseUrl) => {
                const resource = new URL(resourceUrl, baseUrl);
                const base = new URL(baseUrl);

                return resource.hostname === base.hostname
                    || resource.hostname.endsWith(`.${base.hostname}`);
            };

            imgElements.each((i, el) => {
                const src = $(el).attr('src');

                if (!src) return;

                const fullUrl = new URL(src, url).href;

                if (!isLocal(fullUrl, url)) return;

                const name = makeAssetName(fullUrl);

                resources.push({
                    url: fullUrl,
                    name,
                    element: el,
                    attr: 'src',
                });
            });

            linkElements.each((i, el) => {
                const href = $(el).attr('href');

                if (!href) return;

                const fullUrl = new URL(href, url).href;

                if (!isLocal(fullUrl, url)) return;

                const name = makeAssetName(fullUrl);

                resources.push({
                    url: fullUrl,
                    name,
                    element: el,
                    attr: 'href',
                });
            });

            scriptElements.each((i, el) => {
                const src = $(el).attr('src');

                if (!src) return;

                const fullUrl = new URL(src, url).href;

                if (!isLocal(fullUrl, url)) return;

                const name = makeAssetName(fullUrl);

                resources.push({
                    url: fullUrl,
                    name,
                    element: el,
                    attr: 'src',
                });
            });

            log(`resources found: ${resources.length}`);

            return fs.mkdir(dirPath, { recursive: true })
                .then(() => Promise.all(
                    resources.map((res) => {
                        log(`downloading resource: ${res.url}`);

                        return axios.get(res.url, {
                            responseType: 'arraybuffer',
                        })
                            .then((r) => {
                                const fileFullPath = path.join(dirPath, res.name);

                                return fs.writeFile(fileFullPath, r.data);
                            });
                    }),
                ))
                .then(() => {
                    resources.forEach((res) => {
                        const localPath = path.join(dirName, res.name);

                        $(res.element).attr(res.attr, localPath);
                    });

                    log(`saving html: ${filePath}`);

                    const updatedHtml = $.html();

                    return fs.writeFile(filePath, updatedHtml);
                })
                .then(() => filePath);
        });
};

export default pageLoader;