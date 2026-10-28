import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { compile, html, layoutNames, themeNames } from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'reports/themes');
const input = JSON.parse(
  await readFile(resolve(root, 'examples/comparison.json'), 'utf8'),
);
await mkdir(destination, { recursive: true });

for (const theme of themeNames) {
  for (const layout of layoutNames) {
    const output = compile(input, { theme, layout });
    await writeFile(
      resolve(destination, `${theme}-${layout}.html`),
      output.html,
    );
  }
}

const index = html`<!doctype html>
  <html lang="zh-TW">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; frame-src 'self' file:; base-uri 'none'; form-action 'none'"
      />
      <title>Semloom Theme 預覽</title>
      <style>
        :root {
          color-scheme: light;
          font-family:
            system-ui,
            -apple-system,
            'PingFang TC',
            'Microsoft JhengHei',
            sans-serif;
          color: #242923;
          background: #faf9f6;
          line-height: 1.75;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 2rem 1.1rem 4rem;
        }
        main {
          max-width: 90rem;
          margin: auto;
        }
        h1 {
          font-size: clamp(2rem, 4.4vw, 3.4rem);
          line-height: 1.2;
          text-wrap: balance;
        }
        h2 {
          margin: 0 0 0.5rem;
          font-size: 1.4rem;
          text-transform: capitalize;
        }
        p {
          max-width: 72ch;
        }
        .summary {
          margin-bottom: 2.5rem;
        }
        .themes {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(min(100%, 23rem), 1fr)
          );
          gap: 2.5rem 1.5rem;
        }
        .theme {
          min-width: 0;
        }
        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 1.25rem;
          margin-bottom: 1rem;
        }
        a {
          color: #285744;
          text-underline-offset: 0.22em;
        }
        a:hover {
          text-decoration-thickness: 2px;
        }
        a:focus-visible {
          outline: 3px solid #285744;
          outline-offset: 4px;
        }
        iframe {
          display: block;
          width: 100%;
          height: 30rem;
          border: 1px solid #d8ddd4;
          border-radius: 12px;
          background: #fff;
          pointer-events: none;
        }
        ::selection {
          background: #cde2d3;
        }
      </style>
    </head>
    <body>
      <main>
        <h1>Semloom Theme 預覽</h1>
        <div class="summary">
          <p>
            同一份內容，呈現所有內建 Theme 與
            Layout。選擇連結可開啟完整報告，調整視窗或列印。
          </p>
          <p>
            範例：${input.title}。下方預覽統一顯示 document
            版面的比較區塊，內容與來源保持一致。
          </p>
        </div>
        <div class="themes">
          ${themeNames.map(
            (theme) =>
              html`<section class="theme" aria-labelledby="theme-${theme}">
                <h2 id="theme-${theme}">${theme}</h2>
                <nav class="links" aria-label="${theme} 版面">
                  ${layoutNames.map(
                    (layout) =>
                      html`<a href="${theme}-${layout}.html">${layout}</a>`,
                  )}
                </nav>
                <iframe
                  src="${theme}-document.html#comparison"
                  title="${theme} document 預覽"
                  tabindex="-1"
                  aria-hidden="true"
                  sandbox="allow-scripts"
                ></iframe>
              </section>`,
          )}
        </div>
      </main>
    </body>
  </html>`;

const entry = resolve(destination, 'index.html');
await writeFile(entry, index.value);
console.log(
  `Built ${themeNames.length * layoutNames.length} reports: ${entry}`,
);
