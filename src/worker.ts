import * as canvasWasm from 'canvas-wasm';
import html2canvas from 'html2canvas';
import { PageBreakOptions, PageFomat, computePageDimensions, splitPages } from './pagebreak';
import { Pipeline, PipelineContext } from './pipeline';
import { PageSizedResult, SplitPagesResult } from './types';
import { downloadBlob } from './utils';
import { merge } from './merger';

declare global {
  interface Window {
    CANVAS_WASM_RENDERER_CONTEXT: string;
  }
}

export type WorkerContext = {
  el: HTMLElement;
  canvas: canvasWasm.CanvasWasm;
  init: (el: HTMLCanvasElement | OffscreenCanvas) => Promise<canvasWasm.CanvasWasm>;
  finalPageSized: PageSizedResult;
  defaultFonts?: (string | Uint8Array)[];
  fonts?: Record<string, (string | Uint8Array)[]>;
  autoDownload?: boolean;
  fileName?: string;
  format?: PageFomat;
  pageWidth?: number;
  pageHeight?: number;
  perferBinding?: 'canvas_element' | 'offscreen_canvas';
  pageBreak: PageBreakOptions;
  canvasEl?: HTMLCanvasElement;
  margin: number[];
  background: string;
  ignoreElements?: Element[];
};

async function initCanvas(context: PipelineContext<WorkerContext>) {
  context.notifier.notify('initCanvas');
  if (context.perferBinding === 'offscreen_canvas') {
    const canvas = new OffscreenCanvas(
      context.finalPageSized.sourceWidth * context.finalPageSized.scale,
      context.finalPageSized.sourceHeight * context.finalPageSized.scale,
    );
    context.canvas = await context.init(canvas);
  } else {
    const canvasEl = document.createElement('canvas');
    // @ts-ignore
    canvasEl.style = 'position: fixed; z-index: -1; opactiy: 0; pointer-events: none';
    document.body.appendChild(canvasEl);
    canvasEl.width = context.finalPageSized.sourceWidth * context.finalPageSized.scale;
    canvasEl.height = context.finalPageSized.sourceHeight * context.finalPageSized.scale;
    context.canvas = await context.init(canvasEl);
    context.canvasEl = canvasEl;
  }
}

async function loadFonts(context: PipelineContext<WorkerContext>) {
  context.notifier.notify('loadFonts');
  const ready: Promise<any>[] = [];
  const loadFont = (alias: string, sources: (string | Uint8Array)[]) => {
    const fontSources = sources.filter((f) => f instanceof String) as string[];
    const fontBuffers = sources.filter((f) => f instanceof Uint8Array) as Uint8Array[];
    if (fontSources.length) {
      ready.push(context.canvas.loadFonts(fontSources));
    }
    if (fontBuffers.length) {
      fontBuffers.forEach((buf) => {
        context.canvas.loadFontFromBuffer(buf, alias);
      });
    }
  };

  if (context.defaultFonts) {
    loadFont('', context.defaultFonts);
  }

  if (context.fonts) {
    Object.keys(context.fonts)
      .filter((key) => !key.toLowerCase().includes('emoji')) // 因为渲染emoji会导致draw_picture报错, example: https://univer.ai/zh-CN/blog/post/ot
      .forEach((alias) => {
        const sources = context.fonts?.[alias] ?? [];
        if (sources.length) {
          loadFont(alias, sources);
        }
      });
  }

  await Promise.all(ready);
}

async function computePageSize(context: PipelineContext<WorkerContext>) {
  context.notifier.notify('computePageSize');
  let restoreIgnoreElements: () => void = () => {};
  let removeIgnoreElements: () => void = () => {};
  if (context.ignoreElements) {
    removeIgnoreElements = () => {
      const resetFuncs: (() => void)[] = [];
      for (const el of context.ignoreElements ?? []) {
        const next = el.nextSibling;
        const parentNode = el.parentNode;
        if (parentNode) {
          parentNode.removeChild(el);
        }
        resetFuncs.push(() => {
          if (next) {
            parentNode?.insertBefore(next, el);
          } else {
            parentNode?.appendChild(el);
          }
        });
      }
      restoreIgnoreElements = () => {
        while (resetFuncs.length) {
          const func = resetFuncs.pop();
          if (func) {
            func();
          }
        }
      };
    };
  }
  removeIgnoreElements();
  const sourceWidth = context.el.clientWidth;
  const sourceHeight = context.el.clientHeight;
  restoreIgnoreElements();
  let scale = 1;
  let targetWidth = 0;
  let targetHeight = 0;
  let splitPageHeight = 0;
  if (context.format !== undefined) {
    const [formatWidth, formatHeight] = computePageDimensions(context.format);
    const tagetContentWidth = formatWidth - context.margin[1] - context.margin[3];
    const tagetContentHeight = formatHeight - context.margin[0] - context.margin[2];
    scale = tagetContentWidth / sourceWidth;
    targetWidth = formatWidth;
    targetHeight = formatHeight;
    splitPageHeight = tagetContentHeight / scale;
  }
  if (context.pageHeight !== undefined && context.pageWidth !== undefined) {
    const tagetContentWidth = context.pageWidth - context.margin[1] - context.margin[3];
    const tagetContentHeight = context.pageHeight - context.margin[0] - context.margin[2];
    splitPageHeight = tagetContentHeight / scale;
    scale = tagetContentWidth / sourceWidth;
    targetWidth = context.pageWidth;
    targetHeight = context.pageHeight;
  }
  context.finalPageSized = {
    targetHeight,
    targetWidth,
    scale,
    sourceWidth,
    sourceHeight,
    splitPageHeight,
    removeIgnoreElements,
    restoreIgnoreElements,
  };
  console.log('finalPageSize', context.finalPageSized);
}

async function drawPage(context: PipelineContext<WorkerContext>, result: SplitPagesResult) {
  let offset = 0;
  const ctx = context.canvas.getContext('2d');
  const pdfData: Uint8Array[] = [];
  const canvasWidth = result.meta.sourceWidth * result.meta.scale;
  const canvasHeight = result.meta.sourceHeight * result.meta.scale;
  ctx.setSize(canvasWidth, canvasHeight);
  window.CANVAS_WASM_RENDERER_CONTEXT = 'html2canvas';
  ctx.translate(0, 0);
  ctx.scale(result.meta.scale, result.meta.scale);
  console.info('[web2pdf] drawPage start');
  await html2canvas(context.el, {
    canvas: context.canvas as unknown as HTMLCanvasElement,
    scale: 1,
    y: 0,
    useCORS: true,
    allowTaint: true,
    waitForFonts: false,
    waitForLoaded: false,
    ignoreElements(element: any) {
      return context.ignoreElements?.includes(element) ?? false;
    },
  });
  console.info('[web2pdf] drawPage end');
  console.info('[web2pdf] savePage start');
  for (let i = 0; i < result.pages.length; i++) {
    const page = result.pages[i];
    // 因为canvas内容已经被缩放
    const sourceHeight = page.height * result.meta.scale;
    const data = context.canvas.saveAs('pdf', {
      quality: 100,
      density: 96,
      bacground: context.background,
      cuttingOptions: {
        targetWidth: result.meta.targetWidth,
        targetHeight: result.meta.targetHeight,
        targetOffsetTop: context.margin[0],
        targetOffsetRight: context.margin[1],
        targetOffsetBottom: context.margin[2] + (result.meta.splitPageHeight - page.height) * result.meta.scale,
        targetOffsetLeft: context.margin[3],
        sourceOffset: offset,
      },
    });
    pdfData.push(data);
    offset += sourceHeight;
  }
  console.info('[web2pdf] savePage end');
  return pdfData;
}

async function mergePages(context: PipelineContext<WorkerContext>, pdfData: Uint8Array[]) {
  return merge([{ title: '', pages: pdfData }]).then((data) => data);
}

async function downloadAndOutput(context: PipelineContext<WorkerContext>, pdfData: Uint8Array) {
  if (context.autoDownload) {
    // eslint-disable-next-line no-bitwise
    downloadBlob(pdfData, `${context.fileName ?? 'web2pdf'}_${~~(Date.now() / 1000)}.pdf`, 'application/octet-stream');
  }
  return pdfData;
}

async function clear(context: PipelineContext<WorkerContext>) {
  if (context.canvasEl) {
    document.body.removeChild(context.canvasEl);
  }
}

export async function process(options: WorkerContext): Promise<Uint8Array> {
  const pipeline = new Pipeline(options);

  const data = await pipeline
    .pipe(computePageSize)
    .pipe(initCanvas)
    .pipe(loadFonts)
    .pipe<unknown, SplitPagesResult>(splitPages)
    .pipe<SplitPagesResult, Uint8Array[]>(drawPage)
    .pipe<Uint8Array[], Uint8Array>(mergePages)
    .pipe(downloadAndOutput)
    .finally(clear)
    .exec();
  return data as Promise<Uint8Array>;
}
