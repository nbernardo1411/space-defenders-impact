import type * as React from 'react'

export function StatPill({ icon, val, color }: { icon: string; val: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#111914', border: `1px solid ${color}55`, borderRadius: 4, padding: '5px 9px', boxShadow: 'inset 0 0 0 1px #00000088' }}>
      <span style={{ color: '#9ab5a8', fontSize: '0.72rem', letterSpacing: 1.1 }}>{icon}</span>
      <span style={{ color, fontWeight: 800, fontSize: '0.92rem', minWidth: 92, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{typeof val === 'number' ? val.toLocaleString() : val}</span>
    </div>
  )
}

export function btnStyle(bg: string, color: string, bold = false): React.CSSProperties {
  return {
    background: bg,
    color,
    border: '1px solid #5c7e6a',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    fontWeight: bold ? 800 : 600,
    fontSize: '0.76rem',
    transition: 'filter 0.15s',
    fontFamily: 'inherit',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    boxShadow: 'inset 0 0 0 1px #00000088',
  }
}
