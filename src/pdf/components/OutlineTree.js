/**
 * 目录树递归组件 — 渲染 PDF 大纲的多层级结构
 */
export default function OutlineTree({ items, currentPage, onJump, depth = 0 }) {
  return (
    <ul className="outline-tree">
      {items.map((item, idx) => (
        <li key={idx}>
          <div
            className={`outline-item ${item.pageNumber === currentPage ? 'active' : ''}`}
            style={{ paddingLeft: 12 + depth * 16 }}
            onClick={() => onJump(item.pageNumber)}
          >
            <span className="outline-title">{item.title}</span>
            <span className="outline-page">{item.pageNumber ?? '-'}</span>
          </div>
          {item.children?.length > 0 && (
            <OutlineTree
              items={item.children}
              currentPage={currentPage}
              onJump={onJump}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
