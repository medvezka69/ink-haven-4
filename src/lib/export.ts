export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const stripHtml = (html: string) =>
  html
    .replace(/<\/(p|h1|h2|h3|blockquote|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export type ExportChapter = { title: string; content: string };

export function exportTxt(title: string, chapters: ExportChapter[]) {
  const text = chapters.map((c) => `${c.title}\n\n${stripHtml(c.content)}`).join("\n\n\n");
  downloadBlob(`${title}.txt`, new Blob([`${title}\n\n\n${text}`], { type: "text/plain;charset=utf-8" }));
}

export function exportHtmlDoc(title: string, chapters: ExportChapter[], ext: "html" | "doc") {
  const body = chapters
    .map((c) => `<h1 style="page-break-before:always">${c.title}</h1>${c.content}`)
    .join("\n");
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;line-height:1.7;max-width:42em;margin:2em auto;padding:0 1em}p{text-indent:1.5em;margin:0 0 .6em}</style>
</head><body><h1>${title}</h1>${body}</body></html>`;
  downloadBlob(
    `${title}.${ext}`,
    new Blob([html], {
      type: ext === "doc" ? "application/msword" : "text/html;charset=utf-8",
    }),
  );
}

export function exportPdf(title: string, chapters: ExportChapter[]) {
  const body = chapters.map((c) => `<h1>${c.title}</h1>${c.content}`).join("\n");
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title>
<style>@page{margin:2cm}body{font-family:Georgia,serif;line-height:1.7}h1{page-break-before:always}h1:first-of-type{page-break-before:auto}p{text-indent:1.5em;margin:0 0 .6em}</style>
</head><body><h1 style="page-break-before:auto">${title}</h1>${body}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
