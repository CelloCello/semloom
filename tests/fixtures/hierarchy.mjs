import { readFileSync } from 'node:fs';

export function hierarchyDocument(edited = false) {
  const input = JSON.parse(
    readFileSync(
      new URL('../../examples/hierarchy.json', import.meta.url),
      'utf8',
    ),
  );
  if (edited) {
    const root = input.sections[0].blocks[1].root;
    const [theme] = root.children[1].children.splice(0, 1);
    theme.label = 'Theme：可替換的視覺風格';
    root.children[2].children.push(theme);
  }
  return input;
}

export function hierarchyChain(depth, prefix = '層級') {
  const root = { label: `${prefix} 1` };
  let current = root;
  for (let i = 2; i <= depth; i++) {
    current.children = [{ label: `${prefix} ${i}` }];
    current = current.children[0];
  }
  return root;
}

export function hierarchyWide(nodes) {
  return {
    label: 'Root',
    children: Array.from({ length: nodes - 1 }, (_, index) => ({
      label: `分支 ${index + 1}`,
    })),
  };
}

export function hierarchyAsymmetric() {
  const root = { label: '非對稱深樹', children: [] };
  let current = root;
  for (let depth = 1; depth < 8; depth++) {
    current.children = Array.from({ length: 100 }, (_, i) => ({
      label: `層 ${depth} 分支 ${i}`,
    }));
    current = current.children[0];
  }
  return root;
}
