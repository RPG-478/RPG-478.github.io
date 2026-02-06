path = r'c:\Users\aiueo\OneDrive\デスクトップ\archy\App.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace snippet grid + isDev status bar + textarea with dev-only versions
old_edit_tab = """                <>
                  {!isDev && (
                    <div className="border-b border-slate-800 bg-slate-900 p-2 grid grid-cols-4 gap-1 shrink-0">
                      {SNIPPETS.map(snippet => (
                        <button key={snippet.id} onClick={() => insertSnippet(snippet)} className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 transition-colors border border-transparent hover:border-slate-700">
                          {snippet.icon}<span className="text-[9px] mt-1 font-bold truncate w-full text-center">{snippet.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {isDev && (
                    <div className="border-b border-[#30363d] bg-[#0d1117] px-4 py-2 flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-mono text-slate-600">LN {currentCode.split('\\n').length}</span>
                      <span className="text-[10px] font-mono text-slate-600">| UTF-8</span>
                      <span className="text-[10px] font-mono text-slate-600">| Mermaid</span>
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={currentCode}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    className={`flex-1 font-mono text-sm p-6 sm:p-8 resize-none focus:outline-none ${
                      isDev
                        ? 'bg-[#0d1117] text-emerald-100 caret-emerald-400 selection:bg-emerald-900/40'
                        : 'bg-slate-900 text-blue-100'
                    }`}
                    placeholder={isDev ? '// Start typing Mermaid code...' : 'コードを直接編集できます...'}
                  />
                </>"""

new_edit_tab = """                <>
                  <div className="border-b border-[#30363d] bg-[#0d1117] px-4 py-2 flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-slate-600">LN {currentCode.split('\\n').length}</span>
                    <span className="text-[10px] font-mono text-slate-600">| UTF-8</span>
                    <span className="text-[10px] font-mono text-slate-600">| Mermaid</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={currentCode}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    className="flex-1 font-mono text-sm p-6 sm:p-8 resize-none focus:outline-none bg-[#0d1117] text-emerald-100 caret-emerald-400 selection:bg-emerald-900/40"
                    placeholder="// Start typing Mermaid code..."
                  />
                </>"""

if old_edit_tab in content:
    content = content.replace(old_edit_tab, new_edit_tab, 1)
    print('Step 1: Replaced edit tab content')
else:
    print('Step 1: FAILED - old_edit_tab not found')
    # Debug
    idx = content.find('{!isDev && (')
    if idx >= 0:
        print(f'  found at {idx}')
        snippet = content[idx-50:idx+50]
        print(f'  Context: {repr(snippet)}')

# 2. Replace version history panel
old_versions = """                <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDev ? 'bg-[#0d1117]' : 'bg-slate-900'}`}>
                  {activeProject?.versions.map((v, i) => (
                    <div key={v.id} className={`p-4 rounded-xl border ${isDev ? 'border-[#30363d] bg-[#161b22]' : 'border-slate-800 bg-slate-800/40'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isDev ? 'text-emerald-400 font-mono' : 'text-blue-400'}`}>
                          {i === 0 ? (isDev ? 'HEAD' : '最新版') : `${isDev ? 'commit' : 'Version'} ${activeProject.versions.length - i}`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">{new Date(v.timestamp).toLocaleString()}</span>
                      </div>
                      <p className={`text-xs font-medium mb-3 line-clamp-2 ${isDev ? 'text-slate-400 font-mono' : 'text-slate-300'}`}>{v.prompt}</p>
                      <button onClick={() => handleRevertVersion(v)} className={`w-full py-2 text-white text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-2 ${
                        isDev ? 'bg-[#1c2128] hover:bg-emerald-600 border border-[#30363d]' : 'bg-slate-700 hover:bg-blue-600'
                      }`}>
                        <RotateCcw size={12} /> {isDev ? 'Revert' : '戻す'}
                      </button>
                    </div>
                  ))}
                </div>"""

new_versions = """                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0d1117]">
                  {activeProject?.versions.map((v, i) => (
                    <div key={v.id} className="p-4 rounded-xl border border-[#30363d] bg-[#161b22]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-mono">
                          {i === 0 ? 'HEAD' : `commit ${activeProject.versions.length - i}`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">{new Date(v.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-medium mb-3 line-clamp-2 text-slate-400 font-mono">{v.prompt}</p>
                      <button onClick={() => handleRevertVersion(v)} className="w-full py-2 text-white text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-2 bg-[#1c2128] hover:bg-emerald-600 border border-[#30363d]">
                        <RotateCcw size={12} /> Revert
                      </button>
                    </div>
                  ))}
                </div>"""

if old_versions in content:
    content = content.replace(old_versions, new_versions, 1)
    print('Step 2: Replaced version history panel')
else:
    print('Step 2: FAILED - old_versions not found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
