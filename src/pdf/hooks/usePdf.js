import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * PDF 阅读器核心 Hook — 封装所有状态和操作逻辑
 *
 * 返回三层内容：
 *   state  — 状态变量（PDF 数据、页码、侧边栏、错误等）
 *   refs   — DOM 引用（主 canvas、缩略图 canvas）
 *   ops    — 操作函数（加载、翻页、跳转、渲染、缩放）
 */
export function usePdf() {
  // ==================== 状态设定 ====================

  // PDF 核心状态
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 侧边栏状态
  const [sidebarTab, setSidebarTab] = useState(null);   // null | 'thumbnails' | 'outline'
  const [outline, setOutline] = useState([]);
  const [thumbRendered, setThumbRendered] = useState(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(220);

  // 跳页输入框状态
  const [jumpInput, setJumpInput] = useState('');

  // ==================== DOM 引用 ====================
  const canvasRef = useRef(null);
  const thumbRefs = useRef({});
  const mainTaskRef = useRef(null);   // 主 canvas 当前渲染任务（用于取消）

  // 侧边栏拖拽引用
  const draggingRef = useRef(false);

  // 滚轮翻页节流
  const wheelTimerRef = useRef(0);

  // ==================== 操作逻辑 ====================

  /** 渲染 PDF 某一页到主 canvas */
  const renderPage = useCallback(async (doc, pageNumber) => {
    if (!canvasRef.current) return;

    if (mainTaskRef.current) {
      mainTaskRef.current.cancel();
      mainTaskRef.current = null;
    }

    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    const task = page.render({ canvasContext: ctx, viewport });
    mainTaskRef.current = task;
    try {
      await task.promise;
    } catch (e) {
      // 渲染被取消时会抛异常，忽略即可
      if (e?.name !== 'RenderingCancelledException') throw e;
    } finally {
      mainTaskRef.current = null;
    }
  }, []);

  /** 渲染缩略图到指定 canvas */
  const renderThumbnail = useCallback(async (doc, pageNumber) => {
    const canvas = thumbRefs.current[pageNumber];
    if (!canvas || canvas.dataset.rendered) return;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 0.2 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    canvas.dataset.rendered = '1';
  }, []);

  /** 解析 PDF 目录（大纲），返回带页码的树形结构 */
  const resolveOutline = useCallback(async (doc) => {
    const rawOutline = await doc.getOutline();
    if (!rawOutline || rawOutline.length === 0) return [];
  
    async function resolveItems(items) {
      // 使用 Promise.all 并行解析，大幅提升速度
      return Promise.all(items.map(async (item) => {
        let pageNumber = null;
  
        try {
          // 1. 确定具体的 dest 数组
          let destArray = null;
          if (typeof item.dest === 'string') {
            // 如果是字符串，需要查表
            destArray = await doc.getDestination(item.dest);
          } else if (Array.isArray(item.dest)) {
            // 如果本身就是数组，直接用
            destArray = item.dest;
          }
  
          // 2. 从 dest 数组提取页码
          if (destArray && destArray.length > 0) {
            const pageRef = destArray[0];
  
            // 关键判断：pageRef 必须是对象 {num, gen} 才能传给 getPageIndex
            if (typeof pageRef === 'object' && pageRef !== null) {
              const pageIndex = await doc.getPageIndex(pageRef);
              pageNumber = pageIndex + 1;
            } else if (typeof pageRef === 'number') {
              // 极少数 PDF 直接存的是页码索引
              pageNumber = pageRef + 1;
            }
          }
        } catch (err) {
          // 静默处理特定条目的解析失败
          console.warn(`条目 "${item.title}" 解析页码失败:`, err.message);
        }
  
        // 3. 递归处理子项
        const children = item.items && item.items.length > 0 
          ? await resolveItems(item.items) 
          : [];
  
        return {
          title: item.title,
          pageNumber,
          dest: item.dest, // 保留原始 dest 备用
          children,
        };
      }));
    }
  
    return await resolveItems(rawOutline);
  }, []);

  /** 跳转到指定页 */
  const jumpToPage = useCallback(async (target) => {
    if (!pdfDoc || target < 1 || target > totalPages) return;
    setPageNum(target);
    await renderPage(pdfDoc, target);
  }, [pdfDoc, totalPages, renderPage]);

  /** 翻页（delta = ±1） */
  const goToPage = useCallback(async (delta) => {
    const target = pageNum + delta;
    if (target < 1 || target > totalPages || !pdfDoc) return;
    setPageNum(target);
    await renderPage(pdfDoc, target);
  }, [pageNum, totalPages, pdfDoc, renderPage]);

  /** 加载 PDF 文件 */
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSidebarTab(null);
    setOutline([]);
    setThumbRendered(new Set());
    thumbRefs.current = {};

    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setPageNum(1);
      await renderPage(doc, 1);
      resolveOutline(doc).then(setOutline);
    } catch (err) {
      setError('PDF 加载失败: ' + err.message);
      setPdfDoc(null);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [renderPage, resolveOutline]);

  /** 跳页输入框回车处理 */
  const handleJumpKeyDown = useCallback(async (e) => {
    if (e.key === 'Enter') {
      const target = parseInt(jumpInput, 10);
      if (isNaN(target)) {
        setJumpInput(String(pageNum));
        return;
      }
      await jumpToPage(target);
    }
  }, [jumpInput, pageNum, jumpToPage]);

  /** 目录条目点击 — 跳转但不关闭侧边栏 */
  const handleJumpOutlineClick = useCallback(async (target) => {
    await jumpToPage(target);
  }, [pdfDoc, jumpToPage]);

  /** 缩略图 canvas 的 callback ref */
  const setThumbRef = useCallback((pageNumber) => (el) => {
    if (el) thumbRefs.current[pageNumber] = el;
  }, []);

  /** 侧边栏拖拽开始 */
  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  /** 滚轮翻页 — 在内容区域滚动边界处切换页码 */
  const handleWheel = useCallback((e) => {
    if (!pdfDoc) return;

    const now = Date.now();
    if (now - wheelTimerRef.current < 200) return;

    const el = e.currentTarget;
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;

    if (e.deltaY > 0 && atBottom) {
      e.preventDefault();
      wheelTimerRef.current = now;
      goToPage(1);
    } else if (e.deltaY < 0 && atTop) {
      e.preventDefault();
      wheelTimerRef.current = now;
      goToPage(-1);
    }
    // 其他情况（页面内部滚动）不阻止默认行为
  }, [pdfDoc, goToPage]);

  // ==================== 副作用 ====================

  // 卸载时取消进行中的渲染
  useEffect(() => {
    return () => {
      if (mainTaskRef.current) {
        mainTaskRef.current.cancel();
        mainTaskRef.current = null;
      }
    };
  }, []);

  // 同步 jumpInput 与当前页码
  useEffect(() => {
    if (pdfDoc) setJumpInput(String(pageNum));
  }, [pageNum, pdfDoc]);

  // 侧边栏拖拽缩放
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const w = e.clientX;
      if (w >= 150 && w <= 500) setSidebarWidth(w);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ==================== 导出 ====================
  return {
    // 状态
    pdfDoc, pageNum, totalPages, loading, error,
    sidebarTab, setSidebarTab,
    outline,
    thumbRendered,
    jumpInput, setJumpInput,
    sidebarWidth,
    // 引用
    canvasRef,
    thumbRefs,
    // 操作
    handleFileChange,
    goToPage,
    jumpToPage,
    handleJumpKeyDown,
    handleJumpOutlineClick,
    handleWheel,
    setThumbRef,
    onResizeStart,
  };
}
