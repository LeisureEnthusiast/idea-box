{/* Search + List (grouped, less dominant) */}
<section className="container">
  <div className="card group-card">
    <div className="group-head">
      <h2 className="h2">Browse existing names</h2>
      <p className="small">Find a name and vote for it.</p>
    </div>

    {/* SEARCH */}
    <div ref={suggRef} className="search-row" style={{ position: 'relative' }}>
      <div className="form-row" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Search existing names (type to see suggestions)…"
          value={q}
          onChange={e => { setQ(e.target.value); setSearchErr('') }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSIndex(i => Math.min((i < 0 ? -1 : i) + 1, suggestions.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSIndex(i => Math.max((i < 0 ? 0 : i) - 1, -1)) }
            else if (e.key === 'Enter') { e.preventDefault(); runSearch() }
            else if (e.key === 'Escape') { setSuggestions([]); setSIndex(-1); setQ('') }
          }}
        />
        <button className="button" type="button" onClick={runSearch}>Search</button>
      </div>

      {suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute', left: 0, right: 0, zIndex: 20,
            background: 'rgba(15,23,42,0.98)', border: '1px solid var(--border)',
            borderRadius: 12, marginTop: 8, overflow: 'hidden',
            boxShadow: '0 10px 24px rgba(0,0,0,0.35)'
          }}
        >
          {suggestions.map((s, idx) => (
            <div
              key={s.id}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setQ(''); setSuggestions([]); setSIndex(-1); pinAndHighlight(s.id) }}
              onMouseEnter={() => setSIndex(idx)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                background: idx === sIndex ? 'rgba(96,165,250,0.12)' : 'transparent'
              }}
            >
              {s.text}
            </div>
          ))}
        </div>
      )}
    </div>

    {searchErr && <div className="error" style={{ marginTop: 10 }}>{searchErr}</div>}

    <div className="divider" />

    {/* LIST */}
    <ul className="list list-inset">
      {renderIdeas.map(it => {
        const didVote = votedIds.has(it.id)
        return (
          <li key={it.id} id={`idea-${it.id}`} className={`idea-row ${it.id === highlightId ? 'pulse' : ''}`}>
            <div className="idea-text">{it.text}</div>
            <div className="idea-votes">
              {didVote && <span className="pill pill-success">Voted</span>}
              {didVote ? (
                <button className="button ghost" onClick={() => unvote(it.id)}>↩︎ Unvote</button>
              ) : (
                <button className="button ghost" onClick={() => vote(it.id)}>👍 Vote</button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  </div>
</section>
