// 書いている途中の投稿を、右の木へドラッグしてつなぐための約束事
export const DRAFT_MIME = "application/x-reflow-draft";

export function isDraftDrag(e: { dataTransfer: DataTransfer }): boolean {
  return Array.from(e.dataTransfer.types).includes(DRAFT_MIME);
}

// 落とし先に付けるハンドラ。key は「いまどこに重なっているか」の目印。
export function draftDropHandlers(
  key: string,
  setHover: (k: string | null) => void,
  onDrop: () => void
) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (!isDraftDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "link";
      setHover(key);
    },
    onDragLeave: () => setHover(null),
    onDrop: (e: React.DragEvent) => {
      if (!isDraftDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setHover(null);
      onDrop();
    },
  };
}
