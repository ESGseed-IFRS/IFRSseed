'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from 'lucide-react';
import { C } from '@/app/(main)/dashboard/lib/constants';

function exec(cmd: string, value?: string) {
  try {
    document.execCommand(cmd, false, value);
  } catch {
    /* noop */
  }
}

function ToolbarBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: 30,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${C.g200}`,
        borderRadius: 6,
        background: 'white',
        cursor: 'pointer',
        color: C.g700,
      }}
    >
      {children}
    </button>
  );
}

export function ApprovalDraftRichEditor({
  html,
  onChange,
  disabled,
  minHeight = 280,
}: {
  html: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastDoc = useRef<string>('');

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const normalized = html?.trim() ? html : '<p><br></p>';
    if (lastDoc.current === normalized) return;
    lastDoc.current = normalized;
    if (el.innerHTML !== normalized) el.innerHTML = normalized;
  }, [html, disabled]);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = el.innerHTML;
    lastDoc.current = next;
    onChange(next);
  }, [onChange]);

  if (disabled) {
    return (
      <div
        style={{
          padding: 16,
          border: `1px solid ${C.g200}`,
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.65,
          background: '#FAFBFC',
          minHeight,
        }}
        dangerouslySetInnerHTML={{ __html: html || '<p></p>' }}
      />
    );
  }

  return (
    <div
      style={{
        border: `1px solid #c5d4e8`,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'white',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '8px 10px',
          background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
          borderBottom: `1px solid ${C.g200}`,
        }}
      >
        <ToolbarBtn onClick={() => exec('bold')} title="굵게">
          <Bold size={15} strokeWidth={2.2} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec('italic')} title="기울임">
          <Italic size={15} strokeWidth={2.2} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec('underline')} title="밑줄">
          <Underline size={15} strokeWidth={2.2} />
        </ToolbarBtn>
        <span style={{ width: 1, height: 22, background: C.g200, margin: '0 4px' }} />
        <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="글머리 기호">
          <List size={15} strokeWidth={2.2} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertOrderedList')} title="번호 목록">
          <ListOrdered size={15} strokeWidth={2.2} />
        </ToolbarBtn>
        <span style={{ width: 1, height: 22, background: C.g200, margin: '0 4px' }} />
        <ToolbarBtn onClick={() => exec('undo')} title="실행 취소">
          <Undo2 size={15} strokeWidth={2.2} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec('redo')} title="다시 실행">
          <Redo2 size={15} strokeWidth={2.2} />
        </ToolbarBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        style={{
          minHeight,
          padding: '14px 16px',
          fontSize: 13,
          lineHeight: 1.65,
          color: C.g800,
          outline: 'none',
        }}
      />
    </div>
  );
}
