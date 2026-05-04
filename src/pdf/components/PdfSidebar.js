import { useState, useEffect, useRef, useCallback } from 'react';
import OutlineTree from './OutlineTree';

/**
 * 侧边栏内容 — 缩略图 / 目录面板
 */
export default function PdfSidebar({
  pdfDoc,
  sidebarTab,
  totalPages,
  pageNum,
  outline,
  thumbRefs,
  sidebarWidth,
  setThumbRef,
  onJump,
  onOutlineJump,
}) {
  const [renderedPages, setRenderedPages] = useState(new Set());

  /** 渲染单页缩略图 */
  const renderThumbnail = useCallback(async (doc, pageNumber) => {
    const canvas = thumbRefs.current[pageNumber];
    if (!canvas || canvas.dataset.rendered) return;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 0.2 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    canvas.dataset.rendered = '1';
  }, [thumbRefs]);

  // 切换到缩略图面板时，逐页渲染
  useEffect(() => {
    if (sidebarTab !== 'thumbnails' || !pdfDoc) return;
    let cancelled = false;

    async function renderAll() {
      for (let i = 1; i <= totalPages; i++) {
        if (cancelled) return;
        if (thumbRefs.current[i] && !renderedPages.has(i)) {
          await renderThumbnail(pdfDoc, i);
          setRenderedPages(prev => new Set(prev).add(i));
        }
      }
    }
    renderAll();
    return () => { cancelled = true; };
  }, [sidebarTab, pdfDoc, totalPages, renderThumbnail, thumbRefs, renderedPages]);

  return (
    <div className="pdf-sidebar" style={{ width: sidebarWidth }}>
      <div className="sidebar-inner">
        {/* 缩略图面板 */}
        {sidebarTab === 'thumbnails' && (
          <div className="thumbnail-list">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <div
                key={p}
                className={`thumbnail-item ${p === pageNum ? 'active' : ''}`}
                onClick={() => onJump(p)}
              >
                <canvas ref={setThumbRef(p)} />
                <span className="thumbnail-label">{p}</span>
              </div>
            ))}
          </div>
        )}

        {/* 目录面板 */}
        {sidebarTab === 'outline' && (
          <div className="outline-list">
            {outline.length === 0 ? (
              <div className="outline-empty">此 PDF 没有目录</div>
            ) : (
              <OutlineTree items={outline} currentPage={pageNum} onJump={onOutlineJump} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
