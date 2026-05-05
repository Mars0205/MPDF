import './PdfReader.css';
import { usePdf } from './hooks/usePdf';
import PdfToolbar from './components/PdfToolbar';
import PdfSidebar from './components/PdfSidebar';

/**
 * PDF 阅读器 — 组装容器，只做布局编排，不包含业务逻辑
 */
export default function PdfReader() {
  const {
    pdfDoc, pageNum, totalPages, loading, error, scale,
    sidebarTab, setSidebarTab,
    outline,
    jumpInput, setJumpInput,
    sidebarWidth,
    canvasRef,
    thumbRefs,
    handleFileChange,
    goToPage,
    jumpToPage,
    handleJumpKeyDown,
    handleJumpOutlineClick,
    handleWheel,
    setThumbRef,
    onResizeStart,
  } = usePdf();

  return (
    <div className="pdf-reader">
      {/* 顶部工具栏 */}
      <PdfToolbar
        pdfDoc={pdfDoc}
        pageNum={pageNum}
        totalPages={totalPages}
        scale={scale}
        jumpInput={jumpInput}
        sidebarTab={sidebarTab}
        outlineCount={outline.length}
        onFileChange={handleFileChange}
        onSidebarTabChange={setSidebarTab}
        onJumpInputChange={setJumpInput}
        onJumpKeyDown={handleJumpKeyDown}
        onGoToPage={goToPage}
      />

      {/* 主体区域 */}
      <div className="pdf-body">
        {/* 侧边栏 */}
        {sidebarTab && (
          <PdfSidebar
            pdfDoc={pdfDoc}
            sidebarTab={sidebarTab}
            totalPages={totalPages}
            pageNum={pageNum}
            outline={outline}
            thumbRefs={thumbRefs}
            sidebarWidth={sidebarWidth}
            setThumbRef={setThumbRef}
            onJump={jumpToPage}
            onOutlineJump={handleJumpOutlineClick}
          />
        )}

        {/* 拖拽手柄 — 夹在侧边栏和内容之间，属于布局层 */}
        {sidebarTab && (
          <div className="resize-handle" onMouseDown={onResizeStart} />
        )}

        {/* 主内容 */}
        <div className="pdf-content" onWheel={handleWheel}>
          {loading && <div className="pdf-message">正在加载 PDF...</div>}
          {error && <div className="pdf-error">{error}</div>}

          <canvas
            ref={canvasRef}
            className={`pdf-canvas ${pdfDoc ? 'visible' : ''}`}
          />

          {!pdfDoc && !loading && !error && (
            <div className="pdf-placeholder">
              请选择一个 PDF 文件开始阅读
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
