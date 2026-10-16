// The friendly screen shown when the local program stops unexpectedly (or cannot start). The shell
// writes it as a data: page; its two buttons use the preload bridge. Our own dark theme, no branding.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function crashPageHtml(opts: { title: string; detail: string; canRestart: boolean }): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Blackbook</title>
<style>
html,body{margin:0;height:100%;background:#0A0A0C;color:#FAFAFA;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:34rem;margin:0 auto;padding:18vh 1.5rem 0}
h1{font-size:1.25rem;margin:0 0 .75rem}
p{color:#A1A1AA;margin:0 0 1.5rem}
.card{background:#121215;border:1px solid #27272A;border-radius:.75rem;padding:1.5rem}
button{font:inherit;border-radius:.5rem;padding:.5rem 1rem;margin-right:.5rem;cursor:pointer;border:1px solid #27272A;background:#18181B;color:#FAFAFA}
button.primary{background:#FAFAFA;color:#0A0A0C;border-color:#FAFAFA}
#note{font-family:ui-monospace,Consolas,monospace;font-size:.8rem;color:#A1A1AA;margin-top:1rem;min-height:1.2em}
</style></head><body><main><div class="card">
<h1>${esc(opts.title)}</h1>
<p>${esc(opts.detail)}</p>
${opts.canRestart ? '<button class="primary" id="restart">Restart</button>' : ''}
<button id="copy">Copy diagnostics</button>
<div id="note" role="status"></div>
</div></main>
<script>
var d = window.blackbookDesktop, note = document.getElementById('note');
var r = document.getElementById('restart');
if (r) r.onclick = function () { note.textContent = 'Starting again...'; d && d.restartProgram(); };
document.getElementById('copy').onclick = function () {
  if (!d) return;
  d.copyDiagnostics([]).then(function (ok) { note.textContent = ok ? 'Copied. Paste it into your message when you report the problem.' : 'Could not copy.'; });
};
</script></body></html>`;
}

export function dataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
