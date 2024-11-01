async function loadCSSCors(uri: string): Promise<string> {
  let hasCred = false;
  try {
    hasCred = XMLHttpRequest && 'withCredentials' in new XMLHttpRequest();
  } catch (e) {
    // no work
  }
  if (!hasCred) {
    throw new Error('CORS not supported');
  }
  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.open('GET', uri);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        console.error(`style failed to load: ${uri}`);
        reject(new Error(`fail load ${uri}`));
      } else {
        resolve(xhr.responseText);
      }
    };
    xhr.onerror = (err) => {
      reject(err);
    };
    xhr.send();
  });
}

async function fetchFontData(uri: string): Promise<Uint8Array> {
  let hasCred = false;
  try {
    hasCred = XMLHttpRequest && 'withCredentials' in new XMLHttpRequest();
  } catch (e) {
    // no work
  }
  if (!hasCred) {
    throw new Error('CORS not supported');
  }
  const xhr = new XMLHttpRequest();
  xhr.responseType = 'arraybuffer';
  return new Promise((resolve, reject) => {
    xhr.open('GET', uri);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`fail load ${uri}`));
      } else {
        resolve(new Uint8Array(xhr.response));
      }
    };
    xhr.onerror = (err) => {
      reject(err);
    };
    xhr.send();
  });
}

export async function collectStyleSheetFonts(doc?: Document, options?: { ignoreCorsError?: boolean }) {
  const document = doc ?? window.document;
  // 获取所有的样式表
  const styleSheets = document.styleSheets;
  const corsStyleSheet: CSSStyleSheet[] = [];
  const fontsWithURL: { [key: string]: string[] } = {};
  const fontsWithData: { [key: string]: Uint8Array[] } = {};
  const processStyleSheet = (styleSheet: CSSStyleSheet) => {
    const rules = styleSheet.cssRules || styleSheet.rules;
    // 遍历样式表中的规则
    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j] as CSSStyleRule;
      // 检查是否为 @font-face 规则
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        // 提取 @font-face 规则中的信息
        const fontFamily = rule.style.getPropertyValue('font-family').replaceAll('"', '').replace("'", '');
        const src = rule.style.getPropertyValue('src');
        const match = /url\("(.+?)"\)/.exec(src);
        if (match) {
          let url = match[1];
          if (/^(\.|\/)/.test(url)) {
            url = new URL(url, styleSheet.href ?? window.location.href).toString();
          }
          if (!fontsWithURL[fontFamily]) {
            fontsWithURL[fontFamily] = [];
          }
          fontsWithURL[fontFamily].push(url);
        }
      }
    }
  };

  const parseCssText = (cssText: string) => {
    const doc = document.implementation.createHTMLDocument('');
    const styleElement = document.createElement('style');

    styleElement.textContent = cssText;
    // the style will only be parsed once it is added to a document
    doc.body.appendChild(styleElement);

    return styleElement.sheet;
  };

  // 遍历每个样式表
  for (let i = 0; i < styleSheets.length; i++) {
    const styleSheet = styleSheets[i];
    // 由于浏览器安全限制，需要考虑跨域资源
    try {
      processStyleSheet(styleSheet);
    } catch (error) {
      if (styleSheet.href) {
        corsStyleSheet.push(styleSheet);
      }
    }
  }

  const pendings: Promise<void>[] = [];
  for (let i = 0; i < corsStyleSheet.length; i++) {
    pendings.push(
      loadCSSCors(corsStyleSheet[i].href as string)
        .then((text) => {
          const sheet = parseCssText(text);
          if (sheet) {
            processStyleSheet(sheet);
          }
        })
        .catch((err) => {
          if (!options?.ignoreCorsError) {
            throw err;
          }
        }),
    );
  }

  await Promise.allSettled(pendings);

  await Promise.allSettled(
    Object.keys(fontsWithURL).map((key) => {
      return Promise.allSettled(fontsWithURL[key].map((url) => fetchFontData(url))).then((data) => {
        fontsWithData[key] = Array.from(data.values())
          .filter((val) => val.status === 'fulfilled')
          .map((val) => (val as PromiseFulfilledResult<Uint8Array>).value);
      });
    }),
  );

  return fontsWithData;
}
