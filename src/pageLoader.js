import debug from 'debug';
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { Listr } from 'listr2';

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

const downloadResource = (resource, dirPath) => {
    const fileFullPath = path.join(dirPath, resource.name);

    log(`downloading resource: ${resource.url}`);

    return axios.get(resource.url, {
        responseType: 'arraybuffer',
    })
        .catch(() => {
            throw new Error(`Failed to load resource: ${resource.url}`);
        })
        .then((response) => {
            return fs.writeFile(fileFullPath, response.data);
        });
};

const downloadResources = (resources, dirPath) => {
    const tasks = resources.map((resource) => ({
        title: resource.url,
        task: () => downloadResource(resource, dirPath),
    }));

    const listr = new Listr(tasks, {
        concurrent: true,
    });

    return listr.run();
};

const collectResources = ($, url) => {
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

    return resources;
};

const pageLoader = (url, outputDir = process.cwd()) => {
    log(`started downloading: ${url}`);

    return axios.get(url)
        .catch(() => {
            throw new Error(`Failed to load page: ${url}`);
        })
        .then((response) => {
            const html = response.data;

            log('html loaded');

            const fileName = makeFileName(url);
            const filePath = path.join(outputDir, fileName);

            const dirName = makeDirName(url);
            const dirPath = path.join(outputDir, dirName);

            const $ = cheerio.load(html);

            const resources = collectResources($, url);

            log(`resources found: ${resources.length}`);

            return fs.mkdir(dirPath, { recursive: true })
                .catch(() => {
                    throw new Error(`Cannot create directory: ${dirPath}`);
                })
                .then(() => downloadResources(resources, dirPath))
                .then(() => {
                    resources.forEach((res) => {
                        const localPath = path.join(dirName, res.name);

                        $(res.element).attr(res.attr, localPath);
                    });

                    log(`saving html: ${filePath}`);

                    const updatedHtml = $.html();

                    return fs.writeFile(filePath, updatedHtml)
                        .catch(() => {
                            throw new Error(`Cannot write file: ${filePath}`);
                        });
                })
                .then(() => filePath);
        });
};

export default pageLoader;