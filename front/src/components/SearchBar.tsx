import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import FunctionBuilderPanel from './FunctionBuilderPanel'
import type { ElementRef, FnCategory, FnConfig, FnGroup } from '../types/builder'
import { emptyConfigFor, isConfigComplete } from '../types/builder'


const SearchBar = () => {

  const [url, setUrl] = useState("");
  const [siteValue, setSiteValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ---- function builder state ----
  const [functions, setFunctions] = useState<FnGroup[]>([])
  const [draftName, setDraftName] = useState("")
  const [draftCategory, setDraftCategory] = useState<FnCategory>('header')
  const [draftConfig, setDraftConfig] = useState<FnConfig>(emptyConfigFor('header'))

  // 'main' = filling the category's single target/container/table/item/next slot
  // 'field' = adding a named sub-field inside a 'list' function's item template
  const [pickTarget, setPickTarget] = useState<'main' | 'field' | null>(null)
  const pickTargetRef = useRef(pickTarget)
  useEffect(() => { pickTargetRef.current = pickTarget }, [pickTarget])

  // only 'field' picks need a name prompt — main-slot picks apply immediately
  const [naming, setNaming] = useState<ElementRef | null>(null)
  const [nameInput, setNameInput] = useState("")

  const getWebsiteContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/fetch_website", {
        params: { website: url.trim() },
      });
      setSiteValue(res.data);
    } catch (err) {
      setError("Failed to fetch site");
    } finally {
      setLoading(false);
    }
  };

  const applyMainPick = (ref: ElementRef) => {
    setDraftConfig(prev => {
      switch (prev.category) {
        case 'header': return { ...prev, target: ref }
        case 'text': return { ...prev, target: ref }
        case 'links': return { ...prev, container: ref }
        case 'list': return { ...prev, item: ref }
        case 'table': return { ...prev, table: ref }
        case 'pagination': return { ...prev, next: ref }
      }
    })
  }

  // Runs once per iframe (re)load, i.e. once per new siteValue, since a
  // srcDoc change fully replaces the iframe's document.
  const handleIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !doc.body) return

    // auto-size the iframe to the fetched page's real content height
    if (iframeRef.current) {
      iframeRef.current.style.height = `${doc.documentElement.scrollHeight}px`
    }

    const onMouseOver = (e: Event) => {
      const target = e.target as HTMLElement
      if (target === doc.body) return
      target.style.outline = "1px solid red"
    }

    const onMouseOut = (e: Event) => {
      (e.target as HTMLElement).style.outline = ""
    }

    const onClick = (e: Event) => {
      e.preventDefault()
      const target = e.target as HTMLElement
      const mode = pickTargetRef.current
      if (mode) {
        e.stopPropagation()
        const ref: ElementRef = { tag: target.tagName.toLowerCase(), html: target.outerHTML }
        if (mode === 'field') {
          setNaming(ref)
        } else {
          applyMainPick(ref)
        }
        setPickTarget(null)
      }
    }

    doc.addEventListener("mouseover", onMouseOver)
    doc.addEventListener("mouseout", onMouseOut)
    doc.addEventListener("click", onClick)
    // no explicit cleanup needed: srcDoc changes discard this whole
    // document (and its listeners) before onLoad fires again
  }

  const changeCategory = (category: FnCategory) => {
    setDraftCategory(category)
    setDraftConfig(emptyConfigFor(category))
    setPickTarget(null)
    setNaming(null)
  }

  const confirmAddField = () => {
    if (!naming || !nameInput.trim()) return
    setDraftConfig(prev =>
      prev.category === 'list'
        ? { ...prev, fields: [...prev.fields, { id: crypto.randomUUID(), name: nameInput.trim(), ref: naming }] }
        : prev
    )
    setNaming(null)
    setNameInput("")
  }

  const removeField = (id: string) => {
    setDraftConfig(prev =>
      prev.category === 'list' ? { ...prev, fields: prev.fields.filter(f => f.id !== id) } : prev
    )
  }

  const createFunction = () => {
    if (!draftName.trim() || !isConfigComplete(draftConfig)) return
    setFunctions(prev => [...prev, { id: crypto.randomUUID(), name: draftName.trim(), config: draftConfig }])
    setDraftName("")
    setDraftCategory('header')
    setDraftConfig(emptyConfigFor('header'))
    setPickTarget(null)
  }

  const deleteFunction = (id: string) => {
    setFunctions(prev => prev.filter(fn => fn.id !== id))
  }

  const canCreate = draftName.trim().length > 0 && isConfigComplete(draftConfig)

  return (
    <div className='flex flex-row items-start justify-start'>
      <div className='w-2/3 py-6 pr-6'>
        <div className='flex items-center gap-3 mb-4'>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='https://example.com'
            className='
              flex-1 px-3 py-2 rounded font-mono text-sm
              bg-[linear-gradient(180deg,#16211a_0%,#0d1610_100%)]
              text-[#8be8ab] placeholder:text-[#3f5647]
              border border-[#0a120d]
              shadow-[inset_0_2px_5px_rgba(0,0,0,0.8),inset_0_-1px_0_rgba(255,255,255,0.05)]
              focus:outline-none focus:shadow-[inset_0_2px_5px_rgba(0,0,0,0.8),0_0_0_2px_rgba(74,222,128,0.4)]
            '
          />
          <button
            onClick={getWebsiteContent}
            disabled={loading}
            className='
              px-5 py-2 rounded font-sans font-bold text-xs tracking-[0.08em] uppercase text-white whitespace-nowrap
              bg-[linear-gradient(180deg,#4ade80_0%,#22a55e_50%,#15803d_51%,#22a55e_100%)]
              border border-[#14532d]
              shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.3)]
              transition-[filter,transform] hover:enabled:brightness-110
              active:enabled:translate-y-px active:enabled:shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]
              disabled:opacity-40 disabled:cursor-not-allowed
            '
          >
            {loading ? "Loading…" : "Get Website content"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <div
          className='
            relative rounded-lg p-2
            bg-[linear-gradient(180deg,#3d413f_0%,#242826_100%)]
            border border-[#151716]
            shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.3)]
          '
        >
          <div className='flex items-center gap-2 px-1 pb-2'>
            <span
              className='
                w-2 h-2 rounded-full bg-[#4ade80]
                shadow-[0_0_4px_1px_#4ade80,0_0_8px_2px_rgba(74,222,128,0.5)]
              '
            />
            <span className='font-mono text-[10px] tracking-[0.12em] uppercase text-[#9be8ab]'>Preview</span>
          </div>
          <iframe
            ref={iframeRef}
            srcDoc={siteValue}
            onLoad={handleIframeLoad}
            sandbox="allow-same-origin"
            title="Fetched site preview"
            className={`element w-full bg-white rounded border-2 transition-colors ${pickTarget ? 'cursor-crosshair border-red-400' : 'border-transparent'}`}
          />
        </div>
      </div>
      <div className='w-1/3 h-full flex items-start justify-start flex-col'>
        <FunctionBuilderPanel
          draftName={draftName}
          setDraftName={setDraftName}
          draftCategory={draftCategory}
          onCategoryChange={changeCategory}
          draftConfig={draftConfig}
          setDraftConfig={setDraftConfig}
          pickTarget={pickTarget}
          onStartPickMain={() => setPickTarget(p => p === 'main' ? null : 'main')}
          onStartPickField={() => setPickTarget(p => p === 'field' ? null : 'field')}
          naming={naming}
          nameInput={nameInput}
          setNameInput={setNameInput}
          onConfirmField={confirmAddField}
          onCancelNaming={() => setNaming(null)}
          onRemoveField={removeField}
          canCreate={canCreate}
          onCreate={createFunction}
          functions={functions}
          onDeleteFunction={deleteFunction}
        />
      </div>
    </div>
  )
}

export default SearchBar
