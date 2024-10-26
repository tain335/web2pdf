import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNull, PDFNumber, PDFPage, PDFRef, PDFString, rgb } from 'pdf-lib';

type MergeUnit = {
  title: string;
  pages: Uint8Array[];
};

function parseColor(color: string) {
  const c = color.substring(1);
  if (c.length === 3) {
    const nums = c.split('').map((i) => {
      return parseInt(`${i.repeat(2)}`, 16);
    });
    return rgb(nums[0], nums[1], nums[2]);
  }
  if (c.length === 6) {
    return rgb(parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16));
  }
  throw new Error('unsupport color length');
}

type MergeOptions = {
  emitPageNums?: boolean;
  pageNumFontSize?: number;
  emitOutline?: boolean;
  pageNumsColor?: string;
  // pageNumPosX?: number;
  // pageNumPosY?: number;
};

const createOutlineItem = (
  pdfDoc: PDFDocument,
  title: string,
  parent: PDFRef,
  nextOrPrev: PDFRef,
  page: PDFRef,
  isLast = false,
) => {
  const array = PDFArray.withContext(pdfDoc.context);
  array.push(page);
  array.push(PDFName.of('XYZ'));
  array.push(PDFNull);
  array.push(PDFNull);
  array.push(PDFNull);
  const map = new Map();
  map.set(PDFName.Title, PDFString.of(title));
  map.set(PDFName.Parent, parent);
  map.set(PDFName.of(isLast ? 'Prev' : 'Next'), nextOrPrev);
  map.set(PDFName.of('Dest'), array);

  return PDFDict.fromMapWithContext(map, pdfDoc.context);
};

export async function merge(units: MergeUnit[], opts?: MergeOptions) {
  const mergeOpts = { emitPageNums: false, pageNumFontSize: 14, pageNumsColor: '#fff', emitOutline: false, ...opts };
  const mergedDoc = await PDFDocument.create();
  const titleMap = new Map<number, string>();
  const refs: PDFRef[] = [];
  mergedDoc.setCreator('web2pdf');
  mergedDoc.setAuthor('web2pdf');
  console.info('[web2pdf] merge start');
  for (const unit of units) {
    let firstPage: PDFPage | null = null;
    for (const page of unit.pages) {
      const ext = await PDFDocument.load(page);
      const pages = await mergedDoc.copyPages(ext, ext.getPageIndices());
      if (pages.length && !firstPage) {
        firstPage = pages[0];
      }
      for (const p of pages) {
        const { width } = p.getSize();
        if (mergeOpts.emitPageNums) {
          p.drawText(`${mergedDoc.getPageCount() + 1}`, {
            size: mergeOpts.pageNumFontSize,
            color: parseColor(mergeOpts.pageNumsColor),
            x: (width * 11) / 12,
            y: (width * 1) / 24,
          });
        }
        mergedDoc.addPage(p);
      }
    }
    if (firstPage) {
      titleMap.set(firstPage.ref.objectNumber, unit.title);
      refs.push(firstPage.ref);
    }
  }

  if (units.length > 1 && mergeOpts.emitOutline) {
    console.info('[web2pdf] emitOutline start');
    const outlinesDictRef = mergedDoc.context.nextRef();
    const outlinesDistMap = new Map();
    outlinesDistMap.set(PDFName.Type, PDFName.of('Outlines'));
    let nextRef: PDFRef;
    let prevRef: PDFRef;
    refs.forEach((ref, index) => {
      const outlineRef = nextRef ?? mergedDoc.context.nextRef();
      nextRef = mergedDoc.context.nextRef();
      const isLast = index === refs.length - 1;

      if (index === 0) {
        outlinesDistMap.set(PDFName.of('First'), outlineRef);
      }
      if (isLast) {
        outlinesDistMap.set(PDFName.of('Last'), outlineRef);
        outlinesDistMap.set(PDFName.of('Count'), PDFNumber.of(refs.length));
      }

      const outlineItem = createOutlineItem(
        mergedDoc,
        titleMap.get(ref.objectNumber) ?? '',
        outlinesDictRef,
        isLast ? prevRef : nextRef,
        ref,
        isLast,
      );
      mergedDoc.context.assign(outlineRef, outlineItem);
      prevRef = outlineRef;
    });
    mergedDoc.catalog.set(PDFName.of('Outlines'), outlinesDictRef);
    const outlineDict = PDFDict.fromMapWithContext(outlinesDistMap, mergedDoc.context);
    mergedDoc.context.assign(outlinesDictRef, outlineDict);
    console.info('[web2pdf] emitOutline end');
  }
  console.info('[web2pdf] merge end');
  return mergedDoc.save();
}
