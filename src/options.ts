import { PageBreakOptions, PageFomat } from './pagebreak';
import { PageSizeResult } from './types';

export interface Options {
  defaultFonts?: (string | Uint8Array)[];
  fonts?: Record<string, (string | Uint8Array)[]>;
  autoDownload?: boolean;
  fileName?: string;
  format?: PageFomat;
  pageWidth?: number;
  pageHeight?: number;
  margin?: number[];
  background?: string;
  ignoreElements?: Element[];
  pageBreak?: PageBreakOptions;
}

export function normalizeOptions(options?: Options) {
  let margin = [0, 0, 0, 0];
  if (options?.margin) {
    if (options.margin.length === 1) {
      margin = [options.margin[0], options.margin[0], options.margin[0], options.margin[0]];
    } else if (options.margin.length === 2) {
      margin = [options.margin[0], options.margin[1], options.margin[0], options.margin[1]];
    } else if (options.margin.length !== 4) {
      throw new Error('margin only support 1, 2, 4 length array');
    }
  }
  let pageBreak: PageBreakOptions = {
    avoidBreakBlockElements: ['img', 'canvas', 'picture'],
    avoidBreakTextElements: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    avoidBreakStyle: true,
  };
  if (options?.pageBreak) {
    pageBreak = Object.assign(pageBreak, options.pageBreak ?? {});
  }
  return {
    margin,
    pageBreak,
    autoDownload: options?.autoDownload ?? false,
    finalPageSize: null as unknown as PageSizeResult,
    defaultFonts: options?.defaultFonts,
    fonts: options?.fonts,
    fileName: options?.fileName,
    format: options?.format,
    pageWidth: options?.pageWidth,
    pageHeight: options?.pageHeight,
    background: options?.background ?? '#ffffff',
    ignoreElements: options?.ignoreElements ?? [],
  };
}
