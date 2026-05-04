/**
 * 顶部工具栏 — 文件选择、侧边栏切换、跳页输入、翻页按钮
 */
export default function PdfToolbar({
  pdfDoc,
  pageNum,
  totalPages,
  jumpInput,
  sidebarTab,
  outlineCount,
  onFileChange,
  onSidebarTabChange,
  onJumpInputChange,
  onJumpKeyDown,
  onGoToPage,
}) {
  return (
    <div className="pdf-toolbar">
      {/* 文件选择 */}
      <label className="pdf-file-btn">
        选择 PDF 文件
        <input type="file" accept=".pdf" onChange={onFileChange} hidden />
      </label>

      {pdfDoc && (
        <>
          <div className="toolbar-divider" />

          {/* 侧边栏切换 */}
          <button
            className={`toolbar-btn ${sidebarTab === 'thumbnails' ? 'active' : ''}`}
            onClick={() => onSidebarTabChange(s => s === 'thumbnails' ? null : 'thumbnails')}
          >
            缩略图
          </button>
          <button
            className={`toolbar-btn ${sidebarTab === 'outline' ? 'active' : ''}`}
            onClick={() => onSidebarTabChange(s => s === 'outline' ? null : 'outline')}
          >
            目录
            {outlineCount > 0 && <span className="badge">{outlineCount}</span>}
          </button>

          <div className="toolbar-divider" />

          {/* 翻页 */}
          <button onClick={() => onGoToPage(-1)} disabled={pageNum <= 1}>
            上一页
          </button>

          <span className="page-info">
            <input
              className="jump-input"
              type="text"
              value={jumpInput}
              onChange={e => onJumpInputChange(e.target.value)}
              onKeyDown={onJumpKeyDown}
              onBlur={() => onJumpInputChange(String(pageNum))}
            />
            <span className="page-total"> / {totalPages}</span>
          </span>

          <button onClick={() => onGoToPage(1)} disabled={pageNum >= totalPages}>
            下一页
          </button>
        </>
      )}
    </div>
  );
}
