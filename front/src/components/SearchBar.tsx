import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import FunctionBuilderPanel from './FunctionBuilderPanel'
import type { ElementRef, ExtractMode, FnCategory, FnConfig, FnGroup } from '../types/builder'
import { emptyConfigFor, isConfigComplete } from '../types/builder'
import { absoluteSelector, fieldSelectorFor, groupSelector, nearestRepeatingElement } from '../lib/selector'
import { ancestorChain, defaultExtractModeFor } from '../lib/elementLayers'
import { runExtraction, type ExtractionResult } from '../lib/extract'
import { loadWorkspace, saveWorkspace } from '../lib/persistence'
import { detectFields, type FieldCandidate } from '../lib/autoFields'

// Applied to every element matched by a 'list' function's item selector, so
// picking one row visibly highlights the *whole group* it generalized to —
// e.g. every row of a jobs table, not just the one that was clicked.
const GROUP_HIGHLIGHT_CLASS = '__site-inspector-group-highlight'
const GROUP_HIGHLIGHT_STYLE = `
  .${GROUP_HIGHLIGHT_CLASS} {
    outline: 2px dashed #22a55e !important;
    outline-offset: 2px;
    background-color: rgba(74, 222, 128, 0.12) !important;
  }
`


const SearchBar = () => {

  const [url, setUrl] = useState(() => loadWorkspace()?.url ?? "");
  const [siteValue, setSiteValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ---- function builder state ----
  const [functions, setFunctions] = useState<FnGroup[]>(() => loadWorkspace()?.functions ?? [])
  // Autosave on every change — restored on next visit via the lazy
  // initializers above. Excludes siteValue; see lib/persistence.ts.
  useEffect(() => { saveWorkspace({ url, functions }) }, [url, functions])
  const [draftName, setDraftName] = useState("")
  const [draftCategory, setDraftCategory] = useState<FnCategory>('header')
  const [draftConfig, setDraftConfig] = useState<FnConfig>(emptyConfigFor('header'))

  // 'main' = filling the category's single target/container/table/item/next slot
  // 'field' = adding a named sub-field inside a 'list' function's item template
  const [pickTarget, setPickTarget] = useState<'main' | 'field' | null>(null)
  const pickTargetRef = useRef(pickTarget)
  useEffect(() => { pickTargetRef.current = pickTarget }, [pickTarget])

  // handleIframeLoad's listeners are bound once per srcDoc (see comment
  // below) — this ref keeps their view of draftConfig fresh across renders,
  // same trick as pickTargetRef, so a 'field' pick knows the *current* item
  // selector to build its relative selector against.
  const draftConfigRef = useRef(draftConfig)
  useEffect(() => { draftConfigRef.current = draftConfig }, [draftConfig])

  // only 'field' picks need a name prompt — main-slot picks apply immediately
  const [naming, setNaming] = useState<{ ref: ElementRef; extract: ExtractMode } | null>(null)
  const [nameInput, setNameInput] = useState("")

  // A click only ever gives you the exact element under the cursor — this
  // holds the "layer picker" session that lets it be refined (move up to an
  // ancestor, down into a child, choose what to extract) before it's
  // actually applied to the function being built. `chain` is the path from
  // the topmost kept ancestor down to whichever level is currently
  // selected (always the last entry); `extract` is null for categories
  // that don't have a choosable extraction (list item, links container,
  // table, pagination's next-link).
  const [layerPick, setLayerPick] = useState<{ mode: 'main' | 'field'; chain: Element[]; extract: ExtractMode | null } | null>(null)

  // Mutates the live iframe DOM directly (a locked-on outline for whatever
  // layerPick currently points at) rather than going through React state —
  // same "synchronize with an external system" case as the group-highlight
  // effect below, just imperative style instead of a CSS class. The lint
  // rule below assumes anything reachable from useState is React-owned data
  // and shouldn't be mutated in place — but `chain` holds live DOM Elements
  // from the iframe's document, not app data; React only ever reads the
  // array/its length to render the breadcrumb, never the elements' own
  // mutable style state, so mutating that style directly is safe here.
  const layerHighlightRef = useRef<HTMLElement | null>(null)
  /* eslint-disable react-hooks/immutability -- see comment above: `current`
     is a live iframe DOM Element, not React-owned data, even though it's
     reachable through layerPick's state */
  useEffect(() => {
    if (layerHighlightRef.current) {
      layerHighlightRef.current.style.outline = ""
      layerHighlightRef.current.style.backgroundColor = ""
    }
    const current = layerPick?.chain[layerPick.chain.length - 1] as HTMLElement | undefined
    if (current) {
      current.style.outline = "2px solid #2563eb"
      current.style.backgroundColor = "rgba(37, 99, 235, 0.12)"
    }
    layerHighlightRef.current = current ?? null
  }, [layerPick])
  /* eslint-enable react-hooks/immutability */

  // Suggested sub-fields for the just-picked list item, offered as a bulk
  // checklist instead of making the user manually pick each column/field.
  const [detectedFields, setDetectedFields] = useState<FieldCandidate[] | null>(null)

  // How many times the just-picked element repeats on the page — set only
  // for non-'list' picks, so picking a repeating card as e.g. 'Header' (which
  // just concatenates all its text into one blob) can be flagged with a
  // nudge toward 'List' instead.
  const [repeatHint, setRepeatHint] = useState<number | null>(null)

  // How many elements the current 'list' function's item selector actually
  // matches — null when there's nothing to report (no item picked / not a
  // list function). Drives the "N matching items" feedback + the in-preview
  // group highlight, so picking one row visibly confirms the whole group.
  const [groupMatchCount, setGroupMatchCount] = useState<number | null>(null)

  // Whenever the 'list' function's item selector changes, re-run it against
  // the live preview and highlight every match — the visible proof that
  // picking one row (e.g. one job listing) selected the whole repeating
  // group, not just that instance. This is the sanctioned "synchronize with
  // an external system" case for effects (here, the iframe's live
  // contentDocument — imperative, not derivable during render), so the
  // setState-in-effect rule's usual "compute it during render instead" fix
  // doesn't apply — disabled at each call site below.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return

    doc.querySelectorAll(`.${GROUP_HIGHLIGHT_CLASS}`).forEach(el => el.classList.remove(GROUP_HIGHLIGHT_CLASS))

    if (draftConfig.category !== 'list' || !draftConfig.item) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroupMatchCount(null)
      return
    }

    let matches: Element[]
    try {
      matches = Array.from(doc.querySelectorAll(draftConfig.item.selector))
    } catch {
      matches = []
    }
    matches.forEach(el => el.classList.add(GROUP_HIGHLIGHT_CLASS))
    setGroupMatchCount(matches.length)
  }, [draftConfig, siteValue])

  // Results of the last "Run" click — null until run, re-cleared whenever a
  // new page is fetched (old results referencing the old page are useless).
  // Reset-on-prop-change during render, not an effect: React's own
  // recommended pattern for this — an effect here would mean an extra
  // wasted render of the stale results before the reset takes effect.
  const [extractionResult, setExtractionResult] = useState<Record<string, ExtractionResult> | null>(null)
  const [extractionSiteValue, setExtractionSiteValue] = useState(siteValue)
  if (siteValue !== extractionSiteValue) {
    setExtractionSiteValue(siteValue)
    setExtractionResult(null)
  }

  const runFunctions = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    setExtractionResult(runExtraction(doc, functions))
  }

  const getWebsiteContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/fetch_website", {
        params: { website: url.trim() },
      });
      setSiteValue(res.data);
    } catch {
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
        // url_pattern mode has no element to pick — nothing to do if we
        // somehow get here while in it (shouldn't happen: the UI hides the
        // pick button for that mode, but a stale pick session started
        // before switching modes could otherwise still land here).
        case 'pagination': return prev.mode === 'link' ? { ...prev, next: ref } : prev
      }
    })
  }

  // Both of these change which element is "current" — the extract mode has
  // to be recomputed for it, not carried over from whatever level was
  // selected before. Carrying it over is actively wrong: e.g. an <a> with no
  // text defaults to attr:href, but descending into its <img> shouldn't keep
  // "href" selected — an <img> doesn't have one, and silently landing on the
  // wrong attribute (or a blank custom one) would go unnoticed.
  const layerSelectLevel = (index: number) => {
    setLayerPick(prev => {
      if (!prev) return prev
      const chain = prev.chain.slice(0, index + 1)
      return { ...prev, chain, extract: prev.extract !== null ? defaultExtractModeFor(chain[chain.length - 1]) : null }
    })
  }

  const layerDescend = (child: Element) => {
    setLayerPick(prev => {
      if (!prev) return prev
      const chain = [...prev.chain, child]
      return { ...prev, chain, extract: prev.extract !== null ? defaultExtractModeFor(child) : null }
    })
  }

  const layerExtractChange = (mode: ExtractMode) => {
    setLayerPick(prev => (prev && prev.extract !== null ? { ...prev, extract: mode } : prev))
  }

  const layerCancel = () => setLayerPick(null)

  // Turns whatever level+extract-mode the layer picker landed on into an
  // actual ElementRef and applies it — the same selector logic the click
  // handler used to run immediately, just deferred until confirmed.
  const layerConfirm = () => {
    if (!layerPick) return
    const doc = iframeRef.current?.contentDocument
    const cfg = draftConfigRef.current
    const target = layerPick.chain[layerPick.chain.length - 1] as HTMLElement
    const isListItemPick = layerPick.mode === 'main' && cfg.category === 'list'
    const selector = layerPick.mode === 'field'
      ? fieldSelectorFor(target, cfg)
      : isListItemPick
        ? groupSelector(target) // match the whole repeating group, not just this row
        : absoluteSelector(target)
    const ref: ElementRef = { tag: target.tagName.toLowerCase(), html: target.outerHTML, selector }

    if (layerPick.mode === 'field') {
      setNaming({ ref, extract: layerPick.extract ?? { kind: 'text' } })
    } else {
      applyMainPick(ref)
      const extract = layerPick.extract
      if (extract) {
        setDraftConfig(prev =>
          (prev.category === 'header' || prev.category === 'text') ? { ...prev, extract } : prev
        )
      }
      if (isListItemPick) {
        setDetectedFields(detectFields(target))
        setRepeatHint(null)
      } else {
        setDetectedFields(null)
        // Same repeat-detection used for list items, applied here purely
        // as a hint: does this element (picked for a single-target
        // category) actually repeat elsewhere on the page? If so, its
        // whole-subtree get_text() is probably not what was wanted.
        let count = 0
        if (doc) {
          try { count = doc.querySelectorAll(groupSelector(nearestRepeatingElement(target))).length } catch { /* invalid selector — no hint */ }
        }
        setRepeatHint(count > 1 ? count : null)
      }
    }
    setLayerPick(null)
  }

  // Runs once per iframe (re)load, i.e. once per new siteValue, since a
  // srcDoc change fully replaces the iframe's document.
  const handleIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !doc.body) return

    // Auto-size the iframe to the fetched page's real content height. A
    // single measurement right here isn't enough: proxied stylesheets can
    // still be loading at this exact moment and grow the real layout well
    // past what scrollHeight reports right now — observed live: a page
    // that's actually ~3400px tall measured as 150px at this instant,
    // clipping almost the entire preview invisibly. A ResizeObserver on
    // documentElement, tried first, turned out *not* to reliably fire for
    // this (scrollHeight/overflow growth isn't the same as a border-box
    // resize, which is what ResizeObserver actually watches) — so instead,
    // hook the actual known cause directly (each stylesheet's load/error),
    // plus a couple of cheap fallback re-measurements for anything else
    // (images, fonts) that doesn't have as clean a signal to hook.
    const resizeToContent = () => {
      if (iframeRef.current) {
        iframeRef.current.style.height = `${doc.documentElement.scrollHeight}px`
      }
    }
    resizeToContent()
    doc.head?.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      link.addEventListener('load', resizeToContent)
      link.addEventListener('error', resizeToContent) // don't stall forever on one bad stylesheet
    })
    doc.fonts?.ready.then(resizeToContent).catch(() => { /* font loading failed — nothing to resize for */ })
    setTimeout(resizeToContent, 300)
    setTimeout(resizeToContent, 1000)

    // Style hook for the group-highlight effect below (new document each
    // load, so this needs re-adding every time — nothing to clean up).
    if (doc.head) {
      const style = doc.createElement('style')
      style.textContent = GROUP_HIGHLIGHT_STYLE
      doc.head.appendChild(style)
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
      const clicked = e.target as HTMLElement
      const mode = pickTargetRef.current
      if (mode) {
        e.stopPropagation()
        const cfg = draftConfigRef.current
        const isListItemPick = mode === 'main' && cfg.category === 'list'
        // For the list 'item' slot, the click almost never lands on the row/card
        // itself (it lands on a cell's text, a heading, ...) — climb to the
        // actual repeating element so "click anywhere in one row" works. This
        // is just the *default* level the layer picker opens on — ancestors
        // and children are both still reachable from there before confirming.
        const initialTarget = isListItemPick ? nearestRepeatingElement(clicked) : clicked
        const showExtract = mode === 'field' || cfg.category === 'header' || cfg.category === 'text'
        setLayerPick({
          mode,
          chain: ancestorChain(initialTarget),
          extract: showExtract ? defaultExtractModeFor(initialTarget) : null,
        })
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
    setLayerPick(null)
    setNaming(null)
    setDetectedFields(null)
    setRepeatHint(null)
  }

  // Bulk-adds the checked/renamed detected-field candidates in one go,
  // instead of the user manually picking + naming each one.
  const addDetectedFields = (selected: { tag: string; selector: string; name: string; extract: ExtractMode }[]) => {
    setDraftConfig(prev =>
      prev.category === 'list'
        ? {
          ...prev,
          fields: [
            ...prev.fields,
            ...selected.map(c => ({
              id: crypto.randomUUID(),
              name: c.name,
              ref: { tag: c.tag, html: '', selector: c.selector },
              extract: c.extract,
            })),
          ],
        }
        : prev
    )
    setDetectedFields(null)
  }

  const confirmAddField = () => {
    if (!naming || !nameInput.trim()) return
    setDraftConfig(prev =>
      prev.category === 'list'
        ? { ...prev, fields: [...prev.fields, { id: crypto.randomUUID(), name: nameInput.trim(), ref: naming.ref, extract: naming.extract }] }
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
    setDetectedFields(null)
    setRepeatHint(null)
  }

  const deleteFunction = (id: string) => {
    setFunctions(prev => prev.filter(fn => fn.id !== id))
  }

  // Just empties functions — the autosave effect above persists that change
  // right away, so there's no separate localStorage-clearing step needed.
  const clearAllFunctions = () => setFunctions([])

  const canCreate = draftName.trim().length > 0 && isConfigComplete(draftConfig)

  return (
    <div className='flex flex-row items-start justify-start w-full'>
      <div className='w-2/3 py-6 pr-6'>
        <div className='flex items-center gap-3 mb-4'>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='https://example.com'
            className='
              flex-1 px-3 py-2 rounded-lg font-mono text-sm
              bg-[linear-gradient(180deg,#16211a_0%,#0d1610_100%)]
              text-[#8be8ab] placeholder:text-[#3f5647]
              border border-[#1f3a28]
              shadow-[inset_0_2px_5px_rgba(0,0,0,0.8),inset_0_-1px_0_rgba(255,255,255,0.05)]
              focus:outline-none focus:shadow-[inset_0_2px_5px_rgba(0,0,0,0.8),0_0_0_2px_rgba(74,222,128,0.4)]
            '
          />
          <button
            onClick={getWebsiteContent}
            disabled={loading}
            className='
              px-5 py-2 rounded-lg font-sans font-bold text-xs tracking-[0.08em] uppercase text-white whitespace-nowrap
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
            relative rounded-xl p-2
            bg-[linear-gradient(180deg,#3d413f_0%,#242826_100%)]
            border border-[#484d4a]
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
            className={`element w-full bg-white rounded-lg border-2 transition-colors ${pickTarget ? 'cursor-crosshair border-red-400' : 'border-transparent'}`}
          />
        </div>
      </div>
      {/*
        The preview iframe auto-sizes to the fetched page's real height (see
        handleIframeLoad) — for a real site that's often several screens
        tall, which pushes this panel's controls out of view as you scroll
        down to pick something further down the page. Sticky + its own
        scroll keeps "Build a Function" reachable without scrolling back up.
      */}
      <div className='w-1/3 sticky top-4 max-h-screen overflow-y-auto flex items-start justify-start flex-col'>
        <FunctionBuilderPanel
          sourceUrl={url}
          groupMatchCount={groupMatchCount}
          detectedFields={detectedFields}
          onAddDetectedFields={addDetectedFields}
          repeatHint={repeatHint}
          canRun={Boolean(siteValue)}
          onRun={runFunctions}
          extractionResult={extractionResult}
          draftName={draftName}
          setDraftName={setDraftName}
          draftCategory={draftCategory}
          onCategoryChange={changeCategory}
          draftConfig={draftConfig}
          setDraftConfig={setDraftConfig}
          pickTarget={pickTarget}
          onStartPickMain={() => { setLayerPick(null); setPickTarget(p => p === 'main' ? null : 'main') }}
          onStartPickField={() => { setLayerPick(null); setPickTarget(p => p === 'field' ? null : 'field') }}
          layerPick={layerPick}
          onLayerSelectLevel={layerSelectLevel}
          onLayerDescend={layerDescend}
          onLayerExtractChange={layerExtractChange}
          onLayerConfirm={layerConfirm}
          onLayerCancel={layerCancel}
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
          onClearAll={clearAllFunctions}
        />
      </div>
    </div>
  )
}

export default SearchBar
