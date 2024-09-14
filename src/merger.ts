import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFObject,
  PDFPage,
  PDFRef,
  rgb,
} from 'pdf-lib';

export type MergeUnit = {
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

function createOutlineItem(
  doc: PDFDocument,
  title: string,
  parent: PDFObject,
  nextOrPrev: PDFRef,
  page: PDFRef,
  isLast = false,
) {
  const array = PDFArray.withContext(doc.context);
  array.push(page);
  array.push(PDFName.of('XYZ'));
  array.push(PDFNull);
  array.push(PDFNull);
  array.push(PDFNull);
  const map = new Map();
  map.set(PDFName.Title, PDFHexString.fromText(title));
  map.set(PDFName.Parent, parent);
  map.set(PDFName.of(isLast ? 'Prev' : 'Next'), nextOrPrev);
  map.set(PDFName.of('Dest'), array);

  return PDFDict.fromMapWithContext(map, doc.context);
}

type MergeOptions = {
  emitPageNums?: boolean;
  pageNumFontSize?: number;
  emitOutline?: boolean;
  pageNumsColor?: string;
  // pageNumPosX?: number;
  // pageNumPosY?: number;
};

export async function merge(units: MergeUnit[], opts?: MergeOptions) {
  const mergeOpts = { emitPageNums: false, pageNumFontSize: 14, pageNumsColor: '#fff', emitOutline: false, ...opts };
  const doc = await PDFDocument.create();
  doc.setCreator('web2pdf');
  doc.setAuthor('web2pdf');
  const titleMap = new Map<number, string>();
  const refs: PDFRef[] = [];
  for (const unit of units) {
    let firstPage: PDFPage | null = null;
    for (const page of unit.pages) {
      const ext = await PDFDocument.load(page);
      const pages = await doc.copyPages(ext, ext.getPageIndices());
      if (pages.length && !firstPage) {
        firstPage = pages[0];
      }
      for (const p of pages) {
        const { width } = p.getSize();
        if (mergeOpts.emitPageNums) {
          p.drawText(`${doc.getPageCount() + 1}`, {
            size: mergeOpts.pageNumFontSize,
            color: parseColor(mergeOpts.pageNumsColor),
            x: (width * 11) / 12,
            y: (width * 1) / 24,
          });
        }
        doc.addPage(p);
      }
    }
    if (firstPage) {
      titleMap.set(firstPage.ref.objectNumber, unit.title);
      refs.push(firstPage.ref);
    }
  }
  if (mergeOpts.emitOutline) {
    const outlinesDictRef = doc.context.nextRef();
    const outlinesDistMap = new Map();
    outlinesDistMap.set(PDFName.Type, PDFName.of('Outlines'));
    let nextRef: PDFRef;
    let prevRef: PDFRef;
    refs.forEach((ref, index) => {
      const outlineRef = nextRef ?? doc.context.nextRef();
      nextRef = doc.context.nextRef();
      const isLast = index === refs.length - 1;

      if (index === 0) {
        outlinesDistMap.set(PDFName.of('First'), outlineRef);
      }
      if (isLast) {
        outlinesDistMap.set(PDFName.of('Last'), outlineRef);
        outlinesDistMap.set(PDFName.of('Count'), PDFNumber.of(refs.length));
      }

      const outlineItem = createOutlineItem(
        doc,
        titleMap.get(ref.objectNumber) ?? '',
        outlinesDictRef,
        isLast ? prevRef : nextRef,
        ref,
        isLast,
      );
      doc.context.assign(outlineRef, outlineItem);
      prevRef = outlineRef;
    });
    doc.catalog.set(PDFName.of('Outlines'), outlinesDictRef);
    const outlineDict = PDFDict.fromMapWithContext(outlinesDistMap, doc.context);
    doc.context.assign(outlinesDictRef, outlineDict);
  }
  return doc.save();
}
