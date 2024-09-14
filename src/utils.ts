export function downloadBlob(data: any, fileName: any, mimeType: any) {
  const blob = new Blob([data], {
    type: mimeType,
  });
  const url = window.URL.createObjectURL(blob);
  downloadURL(url, fileName);
  setTimeout(function () {
    return window.URL.revokeObjectURL(url);
  }, 1000);
}

export function downloadURL(data: any, fileName: any) {
  const a = document.createElement('a');
  a.href = data;
  a.download = fileName;
  document.body.appendChild(a);
  // @ts-ignore
  a.style = 'display: none';
  a.click();
  a.remove();
}
