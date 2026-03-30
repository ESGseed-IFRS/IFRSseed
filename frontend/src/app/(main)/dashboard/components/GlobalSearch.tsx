'use client';

import { useState } from 'react';
import { SR_ITEMS, FEEDBACKS } from '../lib/mockData';
import { StBadge, CatBadge } from './shared';

interface GlobalSearchProps {
  onNav: (id: string) => void;
}

type SrStatus = 'done' | 'warn' | 'error' | 'none';
type SrCat = 'E' | 'S' | 'G' | 'IT';

type SearchResultItem = {
  type: 'item';
  label: string;
  cat: SrCat;
  id: string;
  status: SrStatus;
};

type SearchResultFeedback = {
  type: 'feedback';
  label: string;
  sub: string;
  id: string;
};

type SearchResult = SearchResultItem | SearchResultFeedback;

export function GlobalSearch({ onNav }: GlobalSearchProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const results: SearchResult[] =
    q.length < 1
      ? []
      : [
          ...SR_ITEMS.filter((i) => i.label.includes(q) || i.cat.includes(q)).map(
            (i): SearchResultItem => ({
              type: 'item',
              label: i.label,
              cat: i.cat as SrCat,
              id: i.id,
              status: i.status as SrStatus,
            }),
          ),
          ...FEEDBACKS.filter((f) => f.item.includes(q) || f.msg.includes(q)).map(
            (f): SearchResultFeedback => ({
              type: 'feedback',
              label: f.item,
              sub: f.from,
              id: f.id,
            }),
          ),
        ].slice(0, 6);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          background: '#F3F4F6',
          border: '1px solid #E5E7EB',
          borderRadius: 8,
          padding: '0 10px',
          width: 240,
        }}
      >
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>⌕</span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="항목·피드백 검색..."
          style={{
            border: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 12,
            color: '#374151',
            outline: 'none',
            flex: 1,
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setOpen(false);
            }}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: '#9CA3AF',
              padding: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 0,
            width: 340,
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            zIndex: 999,
            overflow: 'hidden',
          }}
        >
          {results.map((r, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => {
                setQ('');
                setOpen(false);
                if (r.type === 'item') onNav('sr_status');
                else if (r.type === 'feedback') onNav('sr_feedback');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setQ('');
                  setOpen(false);
                  if (r.type === 'item') onNav('sr_status');
                  else if (r.type === 'feedback') onNav('sr_feedback');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 14px',
                borderBottom: i < results.length - 1 ? '1px solid #F3F4F6' : 'none',
                cursor: 'pointer',
                background: 'white',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F9FAFB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: r.type === 'item' ? '#e8eef8' : '#fef3e2',
                  color: r.type === 'item' ? '#1351D8' : '#D97706',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {r.type === 'item' ? '항목' : '피드백'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1F2937' }}>{r.label}</div>
                {'sub' in r && r.sub && (
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{r.sub}</div>
                )}
              </div>
              {r.type === 'item' && (
                <>
                  <StBadge s={r.status} />
                  <CatBadge cat={r.cat} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {open && q.length > 0 && results.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 0,
            width: 280,
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            zIndex: 999,
            fontSize: 12,
            color: '#9CA3AF',
          }}
        >
          &quot;{q}&quot;에 대한 결과가 없습니다
        </div>
      )}
    </div>
  );
}
