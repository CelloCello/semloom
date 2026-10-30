// Sidebar overrides the document frame; mobile disclosure remains progressive.
export const sidebarCss = `
[data-layout='sidebar'] .page {
  max-width: 96rem;
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  column-gap: 3rem;
  align-items: start;
}
[data-layout='sidebar'] header,
[data-layout='sidebar'] main,
[data-layout='sidebar'] footer {
  grid-column: 2;
}
[data-layout='sidebar'] nav {
  grid-column: 1;
  grid-row: 1 / span 3;
  position: sticky;
  top: 2rem;
  max-height: calc(100vh - 4rem);
  overflow: auto;
  padding: 1.25rem;
}
[data-layout='sidebar'] nav ul {
  list-style: none;
  padding-left: 0;
}
[data-layout='sidebar'] nav ul ul {
  padding-left: 0.9rem;
}
[data-layout='sidebar'] nav ul ul ul ul {
  padding-left: 0.4rem;
}
[data-layout='sidebar'] nav a {
  display: block;
  padding: 0.3rem 0.35rem;
  line-height: 1.5;
}
[data-layout='sidebar'] nav a[aria-current='location'] {
  background: var(--table-head);
}
@media (max-width: 800px) {
  [data-layout='sidebar'] .page {
    display: block;
    padding: 2rem 1.1rem 3rem;
  }
  [data-layout='sidebar'] nav {
    position: static;
    max-height: none;
    padding: 1.25rem;
  }
  [data-layout='sidebar'][data-nav-ready='true'] nav[data-open='false'] {
    display: none;
  }
  .nav-toggle {
    width: 100%;
  }
  [data-layout='sidebar'][data-nav-ready='true'] .nav-toggle[aria-expanded='true'] {
    border-bottom: 0;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  [data-layout='sidebar'][data-nav-ready='true'] nav {
    border-top: 0;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    padding-top: 0.25rem;
  }
  [data-layout='sidebar'][data-nav-ready='true'] nav > h2 {
    display: none;
  }
}
`;
