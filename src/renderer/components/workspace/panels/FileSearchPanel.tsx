import { useState, useCallback, useRef, useEffect } from 'react'
import { useWorkspaceStore } from '../../../store/workspace'

interface SearchResult {
  path: string
  name: string
  isDirectory: boolean
}

interface Props {
  onOpenFile?: (filePath: string) => void
}

/** Extension-based icon character */
function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'ts': case 'tsx': return '◇'
    case 'js': case 'jsx': return '◆'
    case 'json': return '{'
    case 'md': case 'mdx': return '¶'
    case 'css': case 'scss': return '#'
    case 'html': return '<'
    case 'svg': case 'png': case 'jpg': case 'gif': return '◻'
    default: return '·'
  }
}

function iconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'ts': case 'tsx': return '#548C5A'
    case 'js': case 'jsx': return '#d4a040'
    case 'json': return '#c87830'
    case 'css': case 'scss': return '#6b8fa3'
    default: return '#595653'
  }
}

export function FileSearchPanel({ onOpenFile }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const rootDir = useWorkspaceStore((s) => s.rootPath) ?? ''
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input on mount and when panel receives focus
  useEffect(() => {
    inputRef.current?.focus()

    const handler = (): void => {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    window.addEventListener('hotkey:focusSearch', handler)
    return () => window.removeEventListener('hotkey:focusSearch', handler)
  }, [])

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !rootDir) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const hits = await window.electronAPI.fs.search(rootDir, searchQuery.trim(), 50)
      setResults(hits)
      setSelectedIndex(0)
    } catch (err) {
      console.error('[FileSearch] search error:', err)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [rootDir])

  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void doSearch(value)
    }, 200)
  }, [doSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      onOpenFile?.(results[selectedIndex].path)
    }
  }, [results, selectedIndex, onOpenFile])

  /** Shorten path for display: show relative to root, dimming parent dirs */
  function displayPath(fullPath: string): { dir: string; file: string } {
    const rel = rootDir ? fullPath.replace(rootDir, '~') : fullPath
    const lastSlash = rel.lastIndexOf('/')
    if (lastSlash === -1) return { dir: '', file: rel }
    return { dir: rel.slice(0, lastSlash + 1), file: rel.slice(lastSlash + 1) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0E0E0D', color: '#9A9692' }}>
      {/* Search input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
        borderBottom: '1px solid rgba(89,86,83,0.2)', flexShrink: 0,
      }}>
        <span style={{ color: '#595653', fontSize: 'inherit', flexShrink: 0 }}>⌕</span>
        <input
          ref={inputRef}
          data-file-search-input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search files..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#9A9692', fontSize: 'inherit', fontFamily: 'inherit',
          }}
        />
        {isSearching && (
          <span style={{ color: '#595653', fontSize: 10, flexShrink: 0 }}>searching...</span>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!rootDir ? (
          <div style={{ padding: 16, color: '#595653', fontSize: 12, textAlign: 'center' }}>
            Open a folder first (⌘O)
          </div>
        ) : query.trim() === '' ? (
          <div style={{ padding: 16, color: '#595653', fontSize: 12, textAlign: 'center' }}>
            Type to search files
          </div>
        ) : results.length === 0 && !isSearching ? (
          <div style={{ padding: 16, color: '#595653', fontSize: 12, textAlign: 'center' }}>
            No results
          </div>
        ) : (
          results.map((result, idx) => {
            const { dir, file } = displayPath(result.path)
            const isSelected = idx === selectedIndex
            return (
              <div
                key={result.path}
                className="hover-row"
                onClick={() => {
                  setSelectedIndex(idx)
                  onOpenFile?.(result.path)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                  background: isSelected ? 'rgba(84,140,90,0.1)' : 'transparent',
                }}
              >
                <span style={{ color: iconColor(result.name), width: 14, textAlign: 'center', flexShrink: 0 }}>
                  {fileIcon(result.name)}
                </span>
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ color: '#9A9692', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file}
                  </span>
                  <span style={{ color: '#3a3a38', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dir}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '4px 10px', borderTop: '1px solid rgba(89,86,83,0.2)',
        fontSize: 10, color: '#3a3a38', display: 'flex', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span>{results.length} results</span>
        <span>↑↓ navigate · Enter open</span>
      </div>
    </div>
  )
}
