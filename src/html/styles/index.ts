import type { ThemeName, ThemeDefinition } from '../../core/types.js';
import { documentCss, layoutPrintCss } from '../layouts/document.js';
import { sidebarCss } from '../layouts/sidebar.js';
import { themeCss } from '../themes/index.js';
import { componentCss } from './components.js';

export function stylesheetCss(theme: ThemeName | ThemeDefinition): string {
  // Layout overrides follow shared components; print flow overrides both Layouts.
  return [
    themeCss(theme),
    componentCss,
    documentCss,
    sidebarCss,
    layoutPrintCss,
  ].join('\n');
}
