import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useMemo, useRef, useState } from 'react';
import { blobs, pickFiles } from '../lib/platform';
import { Material, deleteMaterial, fail, importMaterial, libraryStore, say, updateMaterial } from '../store/app';
import { ConfirmDialog, PageHeader, PromptDialog } from '../ui/kit';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function Library() {
  const { items } = libraryStore.use();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Material | null>(null);
  const [renaming, setRenaming] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle === '' ? items : items.filter((m) => m.title.toLowerCase().includes(needle));
  }, [items, query]);

  if (open) {
    const current = items.find((m) => m.id === open.id) ?? open;
    return <PdfViewer material={current} onClose={() => setOpen(null)} />;
  }

  const importFiles = async () => {
    const files = await pickFiles({ filters: [{ name: 'PDF', extensions: ['pdf'] }], multiple: true });
    for (const file of files) {
      try {
        // Reading the first page proves the file is a PDF before it is kept.
        const document = await pdfjs.getDocument({ data: file.data.slice() }).promise;
        await document.destroy();
        await importMaterial(file.name, file.data);
      } catch {
        say(`„${file.name}“ ist kein lesbares PDF.`);
      }
    }
  };

  return (
    <div className="page">
      <PageHeader caption="Bibliothek" title="Material">
        <input className="field" style={{ width: 220 }} placeholder="Suchen" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn" onClick={() => void importFiles()}>PDF importieren</button>
      </PageHeader>
      {items.length === 0 ? (
        <div className="card col">
          <strong>Noch kein Material</strong>
          <span className="muted">Importiere Skripte, Arbeitsblätter oder die PDFs, die du aus einem Tafelbild gespeichert hast.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {shown.map((m) => (
            <div key={m.id} className="card col" style={{ gap: 14 }}>
              <button className="link" style={{ textAlign: 'left', color: 'var(--ink)' }} onClick={() => { updateMaterial(m.id, { lastOpenedAt: Date.now() }); setOpen(m); }}>
                <div style={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{m.title}</div>
                <div className="faint mono small" style={{ marginTop: 4 }}>
                  {new Date(m.createdAt).toLocaleDateString('de-DE')} · Seite {m.lastPage}
                </div>
              </button>
              <div className="row small">
                <button className="link" onClick={() => setOpen(m)}>Öffnen</button>
                <button className="link muted" onClick={() => setRenaming(m)}>Umbenennen</button>
                <button className="link muted" onClick={() => setDeleting(m)}>Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {renaming && <PromptDialog title="Umbenennen" initial={renaming.title} confirm="Speichern" onSubmit={(text) => updateMaterial(renaming.id, { title: text.trim() })} onClose={() => setRenaming(null)} />}
      {deleting && <ConfirmDialog title="Löschen?" text={`„${deleting.title}“ wird von diesem PC gelöscht.`} confirm="Löschen" onConfirm={() => void deleteMaterial(deleting.id)} onClose={() => setDeleting(null)} />}
    </div>
  );
}

/** A PDF as a column of pages, drawn when they scroll into view. */
function PdfViewer({ material, onClose }: { material: Material; onClose: () => void }) {
  const [document, setDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [zoom, setZoom] = useState(1.25);
  const [page, setPage] = useState(material.lastPage);
  const scroller = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: pdfjs.PDFDocumentProxy | null = null;
    void (async () => {
      const data = await blobs.get(material.id);
      if (!data) return fail(new Error('Die Datei fehlt auf diesem PC.'));
      try {
        loaded = await pdfjs.getDocument({ data: data.slice(), standardFontDataUrl: './pdfjs/standard_fonts/', cMapUrl: './pdfjs/cmaps/', cMapPacked: true }).promise;
        if (!cancelled) setDocument(loaded);
      } catch {
        fail(new Error('Das PDF lässt sich nicht öffnen.'));
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [material.id]);

  useEffect(() => {
    if (!document || !holder.current) return;
    const container = holder.current;
    container.innerHTML = '';
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const canvas = entry.target as HTMLCanvasElement;
          if (entry.isIntersecting && canvas.dataset.drawn !== String(zoom)) {
            canvas.dataset.drawn = String(zoom);
            void draw(document, Number(canvas.dataset.page), zoom, canvas);
          }
        }
      },
      { root: scroller.current, rootMargin: '600px 0px' },
    );
    void (async () => {
      const first = await document.getPage(1);
      const base = first.getViewport({ scale: zoom });
      for (let number = 1; number <= document.numPages; number++) {
        const canvas = window.document.createElement('canvas');
        canvas.className = 'pdf-page';
        canvas.dataset.page = String(number);
        // Pages are the same size as the first until they are drawn, which keeps the scroll height stable.
        canvas.style.width = `${base.width}px`;
        canvas.style.height = `${base.height}px`;
        container.appendChild(canvas);
        observer.observe(canvas);
      }
      const target = container.children[Math.max(0, Math.min(page, document.numPages) - 1)] as HTMLElement | undefined;
      target?.scrollIntoView();
    })();
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, zoom]);

  const onScroll = () => {
    const root = scroller.current;
    const container = holder.current;
    if (!root || !container) return;
    const middle = root.getBoundingClientRect().top + root.clientHeight / 3;
    let current = 1;
    Array.from(container.children).forEach((child, index) => {
      if ((child as HTMLElement).getBoundingClientRect().top <= middle) current = index + 1;
    });
    if (current !== page) {
      setPage(current);
      updateMaterial(material.id, { lastPage: current });
    }
  };

  const jump = (number: number) => {
    const clamped = Math.max(1, Math.min(document?.numPages ?? 1, number));
    (holder.current?.children[clamped - 1] as HTMLElement | undefined)?.scrollIntoView();
  };

  return (
    <div className="page wide" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ padding: '10px 18px', borderBottom: '1px solid var(--line)' }}>
        <button className="btn outline small" onClick={onClose}>← Bibliothek</button>
        <strong className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{material.title}</strong>
        <span className="mono small muted">Seite</span>
        <input
          className="field"
          style={{ width: 64, height: 32, padding: '0 8px', textAlign: 'center' }}
          value={page}
          onChange={(e) => setPage(Number(e.target.value.replace(/\D/g, '')) || 1)}
          onKeyDown={(e) => e.key === 'Enter' && jump(page)}
        />
        <span className="mono small muted">/ {document?.numPages ?? '–'}</span>
        <button className="btn outline small" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</button>
        <span className="mono small" style={{ width: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button className="btn outline small" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
      </div>
      <div className="pdf-scroll grow" ref={scroller} onScroll={onScroll}>
        <div ref={holder} />
      </div>
    </div>
  );
}

async function draw(document: pdfjs.PDFDocumentProxy, number: number, zoom: number, canvas: HTMLCanvasElement): Promise<void> {
  const page = await document.getPage(number);
  const ratio = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: zoom });
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const context = canvas.getContext('2d');
  if (!context) return;
  await page.render({ canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }).promise;
}
