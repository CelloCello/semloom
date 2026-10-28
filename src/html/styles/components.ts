// Shared typography, content components and navigation controls.
export const componentCss = `
:root {
  color-scheme: var(--color-scheme);
  font-family: var(--font-body);
  background: var(--paper);
  color: var(--ink);
}
* {
  box-sizing: border-box;
}
html {
  scroll-padding-top: 1.5rem;
}
body {
  margin: 0;
  font-size: 1rem;
  line-height: var(--body-leading);
}
a {
  color: var(--accent);
  text-underline-offset: 0.22em;
  overflow-wrap: anywhere;
}
a:hover {
  text-decoration-thickness: 2px;
}
a:focus-visible,
button:focus-visible,
[tabindex]:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 5px;
}
::selection {
  background: var(--selection);
  color: var(--ink);
}
h1 {
  text-wrap: balance;
  font-size: clamp(2rem, 4.4vw, 3.4rem);
  font-weight: var(--title-weight);
  line-height: 1.2;
  letter-spacing: -0.025em;
  max-width: 24ch;
  overflow-wrap: anywhere;
  margin: 0;
}
h2 {
  font-size: 1.65rem;
  line-height: 1.35;
  margin: 3.5rem 0 1.25rem;
  letter-spacing: -0.02em;
}
h3 {
  font-size: 1.2rem;
  line-height: 1.4;
  margin: 0 0 1.25rem;
}
h4,
h5,
h6 {
  font-size: 1.06rem;
  line-height: 1.5;
  margin: 0 0 1rem;
}
h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--font-heading);
}
h2,
h3,
h4,
h5,
h6 {
  overflow-wrap: anywhere;
  scroll-margin-top: 1.5rem;
}
.block {
  margin: 1.75rem 0 2.5rem;
  min-width: 0;
}
.prose {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: var(--measure);
  margin: 0;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 1.5rem;
}
.comparison-card {
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  min-width: 0;
}
.comparison-card h4 {
  margin: 0 0 1.25rem;
}
.comparison-card dl {
  margin: 0;
}
.attribute + .attribute {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}
dt {
  font-size: 0.85rem;
  color: var(--muted);
}
dd {
  margin: 0.25rem 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.table-scroll {
  max-width: 100%;
  overflow: auto;
  scrollbar-color: var(--accent) var(--paper);
  scrollbar-width: thin;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-variant-numeric: tabular-nums;
}
caption {
  text-align: left;
  font-size: 1.2rem;
  font-weight: 650;
  padding: 1.25rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
th,
td {
  padding: 1rem 1.25rem;
  vertical-align: top;
  border-top: 1px solid var(--line);
  min-width: 10rem;
  max-width: 32rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
thead th {
  background: var(--table-head);
  color: var(--muted);
  font-size: 0.875rem;
}
tbody th {
  font-weight: 600;
}
tbody tr:hover {
  background: var(--table-hover);
}
.citations {
  margin: 1rem 0 0;
  color: var(--muted);
  font-size: 0.875rem;
}
.citations ul {
  margin: 0.3rem 0;
  padding-left: 1.3rem;
}
.sources {
  border-top: 1px solid var(--line);
  margin-top: 4rem;
  padding-top: 0.5rem;
}
.sources ol {
  padding-left: 1.5rem;
}
.sources li {
  padding-left: 0.35rem;
  margin: 0.75rem 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
[hidden] {
  display: none !important;
}
.skip-link {
  position: absolute;
  top: 1rem;
  left: 1rem;
  padding: 0.6rem 1rem;
  background: var(--surface);
  z-index: 2;
  transform: translateY(-200%);
}
.skip-link:focus {
  transform: none;
}
.nav-toggle {
  font: inherit;
  color: var(--accent);
  background: var(--surface);
  border: 1px solid var(--line);
  padding: 0.65rem 1rem;
  text-align: left;
  cursor: pointer;
}
.nav-toggle:hover {
  background: var(--table-head);
}
nav a[aria-current='location'] {
  font-weight: 700;
  text-decoration-thickness: 2px;
}
@media (max-width: 600px) {
  h2 {
    margin-top: 2.5rem;
    font-size: 1.4rem;
  }
  .cards {
    grid-template-columns: minmax(0, 1fr);
  }
  .comparison-card {
    padding: 1.25rem;
  }
  th,
  td {
    padding: 0.75rem;
    min-width: 9rem;
  }
}
@media print {
  :focus {
    outline: none !important;
  }
  body {
    font-size: 10pt;
  }
  h1 {
    text-wrap: balance;
    font-size: 24pt;
    max-width: none;
  }
  h2,
  h3,
  caption {
    break-after: avoid;
  }
  .cards {
    display: block;
  }
  .comparison-card {
    break-inside: avoid;
    margin: 1rem 0;
    border-radius: 0;
  }
  .table-scroll {
    overflow: visible;
    border: 0;
    border-radius: 0;
  }
  table {
    table-layout: fixed;
    font-size: 8pt;
  }
  th,
  td {
    min-width: 0;
    max-width: none;
    padding: 0.35rem;
    overflow-wrap: anywhere;
  }
  thead {
    display: table-header-group;
  }
  .sources a[href^='http']::after {
    content: ' (' attr(href) ')';
    font-size: 8pt;
  }
  a {
    color: #000;
  }
}
`;
