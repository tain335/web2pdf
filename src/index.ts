import * as canvasWasm from 'canvas-wasm';
import { process } from './worker';
import { Options, normalizeOptions } from './options';

export { PageFormats } from './pagebreak';
export { collectStyleSheetFonts } from './fonts';
// computePageSize > splitPage > drawPage > mergePages > output
// 分页可以在canvas-wasm处理，每次完全绘制一次，然后只截取指定页面部分，但是这样缺乏灵活性，而且性能也低
// 对于图片无法split的移动到下一页，但是如果下一页都没办法放下情况？
// 1. 缩放图片
// 2. 强行分割
// 对于长段文字如何合理分割文本，而不会出现文本被截断？
export async function web2pdf(el: HTMLElement, options?: Options): Promise<Uint8Array[]> {
  return process({
    el,
    canvas: null as unknown as canvasWasm.CanvasWasm,
    init(e) {
      return canvasWasm.initCanvas(e);
    },
    ...normalizeOptions(options),
  });
}
