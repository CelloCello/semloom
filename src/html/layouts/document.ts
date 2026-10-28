// Default document flow is shared by both Layouts.
export const documentCss = `
.page {
  max-width: 76rem;
  padding: 4rem 3rem 6rem;
  margin: auto;
}
header {
  border-bottom: 1px solid var(--line);
  padding-bottom: 2.5rem;
  margin-bottom: 2rem;
}
section section {
  margin-left: 1rem;
  padding-left: 1.5rem;
  border-left: 1px solid var(--line);
}
nav {
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--line);
}
nav h2 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
}
nav ul {
  margin: 0.3rem 0;
  padding-left: 1.35rem;
}
nav a {
  font-size: 0.95rem;
}
nav ul ul {
  padding-left: 1.25rem;
}
footer {
  margin-top: 4rem;
  color: var(--muted);
  font-size: 0.8rem;
  border-top: 1px solid var(--line);
  padding-top: 1rem;
}
main {
  min-width: 0;
}
nav ul ul ul ul {
  padding-left: 0.4rem;
}
section section section section {
  margin-left: 0;
  padding-left: 0.5rem;
}
@media (max-width: 600px) {
  .page {
    padding: 2rem 1.1rem 3rem;
  }
  header {
    padding-bottom: 1.75rem;
  }
  section section {
    margin-left: 0;
    padding-left: 0.8rem;
  }
}
`;

// Both Layouts return to document flow when printed.
export const layoutPrintCss = `
@media print {
  [data-layout='sidebar'] .page,
  .page {
    display: block;
    max-width: none;
    padding: 0;
  }
  header {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
  }
  nav,
  [data-layout='sidebar'] nav,
  .nav-toggle,
  .skip-link,
  footer {
    display: none !important;
  }
  section section {
    margin-left: 0;
    padding-left: 0.7rem;
  }
}
`;
