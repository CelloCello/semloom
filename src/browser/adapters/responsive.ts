import type { BrowserAdapter } from '../types.js';
import { renderResponsive } from '../../plugins/comparison.js';
import { htmlView } from '../index.js';

export const createView: BrowserAdapter = (data, context) =>
  htmlView(renderResponsive(data, context));
