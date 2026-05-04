import { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './PdfReader.css';

// 设置 PDF.js 的 worker（负责后台解析 PDF，不阻塞 UI）
// 使用本地 public/ 目录下的 worker 文件，避免 CDN 版本不匹配
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function PdfReader() {
  // === 状态变量（修改它们会自动刷新 UI） ===
  const [pdfDoc, setPdfDoc] = useState(null);       // 当前加载的 PDF 文档对象
  const [pageNum, setPageNum] = useState(1);         // 当前页码
  const [totalPages, setTotalPages] = useState(0);   // 总页数
  const [loading, setLoading] = useState(false);     // 是否正在加载
  const [error, setError] = useState(null);           // 错误信息

  // === 引用（类似 C++ 的指针成员，改它不会触发 UI 刷新） ===
  const canvasRef = useRef(null);  // 指向 <canvas> 元素，用于绑制 PDF 页面

  // === 渲染当前页到 canvas ===
  const renderPage = useCallback(async (doc, pageNumber) => {
    if (!canvasRef.current) return;

    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });  // 1.5 倍放大，清晰度合适

    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
    }).promise;
  }, []);

  // === 处理用户选择的 PDF 文件 ===
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // 将文件读取为 ArrayBuffer（二进制数据）
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setPageNum(1);
      await renderPage(doc, 1);
    } catch (err) {
      setError('PDF 加载失败: ' + err.message);
      setPdfDoc(null);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [renderPage]);

  // === 翻页 ===
  const goToPage = useCallback(async (delta) => {
    const newPage = pageNum + delta;
    if (newPage < 1 || newPage > totalPages || !pdfDoc) return;

    setPageNum(newPage);
    await renderPage(pdfDoc, newPage);
  }, [pageNum, totalPages, pdfDoc, renderPage]);

  // ========== UI（JSX 语法，看起来像 HTML） ==========
  return (
    <div className="pdf-reader">
      {/* 顶部工具栏 */}
      <div className="pdf-toolbar">
        {/* 文件选择按钮 */}
        <label className="pdf-file-btn">
          选择 PDF 文件
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            hidden
          />
        </label>

        {/* 翻页控件 */}
        {pdfDoc && (
          <div className="pdf-controls">
            <button onClick={() => goToPage(-1)} disabled={pageNum <= 1}>
              上一页
            </button>
            <span>第 {pageNum} / {totalPages} 页</span>
            <button onClick={() => goToPage(1)} disabled={pageNum >= totalPages}>
              下一页
            </button>
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="pdf-content">
        {loading && <div className="pdf-message">正在加载 PDF...</div>}
        {error && <div className="pdf-error">{error}</div>}

        {/* canvas 用于绑制 PDF 页面 */}
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
  );
}

export default PdfReader;