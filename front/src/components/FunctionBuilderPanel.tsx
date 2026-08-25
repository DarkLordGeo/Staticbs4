import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ElementRef, ExtractMode, FnCategory, FnConfig, FnGroup } from '../types/builder'
import { CATEGORY_LABELS, MAIN_SLOT_LABELS, summarizeFn } from '../types/builder'
import { generatePythonCode } from '../lib/codegen'
import type { ExtractionResult } from '../lib/extract'
import type { FieldCandidate } from '../lib/autoFields'
import { suggestUrlTemplate } from '../lib/urlPattern'
import ElementLayerPicker from './ElementLayerPicker'

const truncateHtml = (html: string, max = 50) =>
    html.length > max ? html.slice(0, max) + '…' : html

// Pretty-print a result value, capping long lists so one big scrape doesn't
// blow up the panel — this is a sanity check, not a full data browser.
const formatResult = (value: unknown, max = 5): string => {
    if (value === null) return '(no match)'
    if (Array.isArray(value) && value.length > max) {
        return JSON.stringify(value.slice(0, max), null, 2) + `\n… and ${value.length - max} more`
    }
    return JSON.stringify(value, null, 2)
}

const inputClass = `
    border border-[#c7cdc9] rounded-lg px-2 py-1 text-sm bg-white
    shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)]
    focus:outline-none focus:border-[#2f9e5c] focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.12),0_0_0_2px_rgba(74,222,128,0.35)]
`

const glossyGreenButtonClass = `
    font-sans font-bold text-xs tracking-[0.06em] uppercase text-white
    bg-[linear-gradient(180deg,#4ade80_0%,#22a55e_50%,#15803d_51%,#22a55e_100%)]
    border border-[#14532d] rounded-lg
    shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.35),0_2px_4px_rgba(0,0,0,0.25)]
    transition-[filter,transform] hover:enabled:brightness-110
    active:enabled:translate-y-px active:enabled:shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]
    disabled:opacity-40 disabled:cursor-not-allowed
`

const ElementPreview = ({ el }: { el: ElementRef }) => (
    <div className='mt-1 flex flex-col gap-0.5 text-xs'>
        <div className='flex items-center gap-1.5'>
            <span className='px-1.5 py-0.5 rounded-full bg-[#dcf3e4] text-[#166534] font-mono border border-[#b8e2c6]'>{el.tag}</span>
            <span className='text-gray-400 font-mono truncate'>{truncateHtml(el.html)}</span>
        </div>
        <span className='text-gray-400 font-mono truncate' title={el.selector}>{el.selector}</span>
    </div>
)

type DetectedEntry = FieldCandidate & { checked: boolean; name: string }

// A bulk checklist for auto-suggested fields, offered right after picking a
// list item — check/uncheck and rename before adding them all at once,
// instead of manually picking each column/field one at a time. Keyed by its
// candidate set at the call site so it gets a fresh internal state (all
// checked, names reset to the suggestions) whenever a new item is picked.
const DetectedFieldsPicker = ({
    candidates,
    onAdd,
}: {
    candidates: FieldCandidate[]
    onAdd: (selected: { tag: string; selector: string; name: string; extract: ExtractMode }[]) => void
}) => {
    const [entries, setEntries] = useState<DetectedEntry[]>(
        () => candidates.map(c => ({ ...c, checked: true, name: c.suggestedName }))
    )

    const toggle = (i: number) => setEntries(prev => prev.map((e, idx) => (idx === i ? { ...e, checked: !e.checked } : e)))
    const rename = (i: number, name: string) => setEntries(prev => prev.map((e, idx) => (idx === i ? { ...e, name } : e)))
    const selected = entries.filter(e => e.checked)

    return (
        <div className='flex flex-col gap-2 rounded-lg p-2.5 bg-white border border-[#c7cdc9] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]'>
            <p className='text-xs text-gray-500'>
                Detected {entries.length} possible field{entries.length === 1 ? '' : 's'} — uncheck any you don't want, rename the rest:
            </p>
            <div className='flex flex-col gap-1.5 max-h-56 overflow-y-auto'>
                {entries.map((e, i) => (
                    <label key={i} className='flex items-center gap-2 text-xs'>
                        <input type='checkbox' checked={e.checked} onChange={() => toggle(i)} className='accent-[#22a55e] shrink-0' />
                        <span className='px-1 py-0.5 rounded bg-[#dcf3e4] text-[#166534] font-mono border border-[#b8e2c6] shrink-0'>{e.tag}</span>
                        {e.extract.kind === 'attr' && (
                            <span className='px-1 py-0.5 rounded bg-[#e0e7ff] text-[#3730a3] font-mono border border-[#c7d2fe] shrink-0'>attr:{e.extract.name}</span>
                        )}
                        <input
                            value={e.name}
                            onChange={(ev) => rename(i, ev.target.value)}
                            className='font-mono border border-[#c7cdc9] rounded px-1 py-0.5 w-24 shrink-0'
                        />
                        <span className='text-gray-400 truncate'>{e.preview}</span>
                    </label>
                ))}
            </div>
            <button
                onClick={() => onAdd(selected.map(e => ({ tag: e.tag, selector: e.selector, name: e.name.trim() || e.suggestedName, extract: e.extract })))}
                disabled={selected.length === 0}
                className={`px-3 py-1.5 ${glossyGreenButtonClass}`}
            >
                Add selected ({selected.length})
            </button>
        </div>
    )
}

// The created-functions list — reorderable via native HTML5 drag-and-drop
// (no extra dependency needed for something this simple), and each entry
// opens back into the builder above for editing instead of only ever being
// delete-and-recreate.
const FunctionList = ({
    functions, editingId, onEditFunction, onDeleteFunction, onReorderFunctions,
}: {
    functions: FnGroup[]
    editingId: string | null
    onEditFunction: (fn: FnGroup) => void
    onDeleteFunction: (id: string) => void
    onReorderFunctions: (fromId: string, toId: string) => void
}) => {
    const [dragOverId, setDragOverId] = useState<string | null>(null)

    return (
        <>
            {functions.map(fn => (
                <div
                    key={fn.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', fn.id)}
                    onDragOver={e => { e.preventDefault(); setDragOverId(fn.id) }}
                    onDragLeave={() => setDragOverId(prev => (prev === fn.id ? null : prev))}
                    onDrop={e => {
                        e.preventDefault()
                        setDragOverId(null)
                        const fromId = e.dataTransfer.getData('text/plain')
                        if (fromId) onReorderFunctions(fromId, fn.id)
                    }}
                    className={`
                        rounded-xl p-2.5 cursor-grab active:cursor-grabbing
                        bg-[linear-gradient(180deg,#f7f9f7_0%,#eaeeeb_100%)]
                        border shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.08)]
                        ${fn.id === editingId ? 'border-[#2f9e5c] ring-1 ring-[#2f9e5c]' : 'border-[#c3c9c4]'}
                        ${dragOverId === fn.id ? 'border-dashed border-2 border-[#2f9e5c]' : ''}
                    `}
                >
                    <div className='flex items-center gap-2'>
                        <span className='text-gray-400 select-none' title='Drag to reorder'>⠿</span>
                        <span className='font-mono font-semibold'>{fn.name}()</span>
                        <span className='text-xs px-1.5 py-0.5 rounded-full bg-[#dcf3e4] text-[#166534] border border-[#b8e2c6]'>{CATEGORY_LABELS[fn.config.category]}</span>
                        <button onClick={() => onEditFunction(fn)} className='ml-auto text-gray-400 hover:text-[#2f9e5c] text-xs'>edit</button>
                        <button onClick={() => onDeleteFunction(fn.id)} className='text-gray-400 hover:text-red-500 text-xs'>delete</button>
                    </div>
                    <div className='text-xs text-gray-500 mt-1'>{summarizeFn(fn)}</div>
                </div>
            ))}
        </>
    )
}

const PickButton = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors
            shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.15)]
            ${active
                ? 'bg-[linear-gradient(180deg,#f87171_0%,#dc2626_100%)] border-[#7f1d1d] text-white'
                : 'bg-[linear-gradient(180deg,#f7f8f7_0%,#e2e6e3_100%)] border-[#b9c0ba] text-gray-700 hover:brightness-105'}`}
    >
        {active ? 'Click an element…' : label}
    </button>
)

// A persistent choice between two strategies, not a momentary "now click an
// element" action — green when selected (the app's usual "active" color),
// not PickButton's red (which specifically means "picking mode is live").
const ModeButton = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors
            shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.15)]
            ${active
                ? 'bg-[linear-gradient(180deg,#4ade80_0%,#22a55e_50%,#15803d_51%,#22a55e_100%)] border-[#14532d] text-white'
                : 'bg-[linear-gradient(180deg,#f7f8f7_0%,#e2e6e3_100%)] border-[#b9c0ba] text-gray-700 hover:brightness-105'}`}
    >
        {label}
    </button>
)

interface Props {
    sourceUrl: string
    groupMatchCount: number | null
    detectedFields: FieldCandidate[] | null
    onAddDetectedFields: (selected: { tag: string; selector: string; name: string; extract: ExtractMode }[]) => void
    repeatHint: number | null
    draftName: string
    setDraftName: (v: string) => void
    draftCategory: FnCategory
    onCategoryChange: (c: FnCategory) => void
    draftConfig: FnConfig
    setDraftConfig: Dispatch<SetStateAction<FnConfig>>
    pickTarget: 'main' | 'field' | null
    onStartPickMain: () => void
    onStartPickField: () => void
    layerPick: { chain: Element[]; extract: ExtractMode | null } | null
    onLayerSelectLevel: (index: number) => void
    onLayerDescend: (child: Element) => void
    onLayerExtractChange: (mode: ExtractMode) => void
    onLayerConfirm: () => void
    onLayerCancel: () => void
    naming: { ref: ElementRef; extract: ExtractMode } | null
    nameInput: string
    setNameInput: (v: string) => void
    onConfirmField: () => void
    onCancelNaming: () => void
    onRemoveField: (id: string) => void
    canCreate: boolean
    onCreate: () => void
    editingId: string | null
    onEditFunction: (fn: FnGroup) => void
    onCancelEdit: () => void
    onReorderFunctions: (fromId: string, toId: string) => void
    functions: FnGroup[]
    onDeleteFunction: (id: string) => void
    onClearAll: () => void
    canRun: boolean
    onRun: () => void
    extractionResult: Record<string, ExtractionResult> | null
}

const FunctionBuilderPanel = ({
    sourceUrl,
    groupMatchCount,
    detectedFields, onAddDetectedFields, repeatHint,
    draftName, setDraftName,
    draftCategory, onCategoryChange,
    draftConfig, setDraftConfig,
    pickTarget, onStartPickMain, onStartPickField,
    layerPick, onLayerSelectLevel, onLayerDescend, onLayerExtractChange, onLayerConfirm, onLayerCancel,
    naming, nameInput, setNameInput, onConfirmField, onCancelNaming, onRemoveField,
    canCreate, onCreate,
    editingId, onEditFunction, onCancelEdit, onReorderFunctions,
    functions, onDeleteFunction, onClearAll,
    canRun, onRun, extractionResult,
}: Props) => {
    const [exportJson, setExportJson] = useState(false)
    const [exportXlsx, setExportXlsx] = useState(false)
    const [perPageJson, setPerPageJson] = useState(false)
    // Per-page JSON only means anything once a List function is actually
    // being crawled across multiple pages by a Pagination function.
    const crawlMode = functions.some(fn => fn.config.category === 'pagination')
        && functions.some(fn => fn.config.category === 'list')
    const exportOptions = useMemo(
        () => ({ json: exportJson, xlsx: exportXlsx, perPageJson: perPageJson && crawlMode }),
        [exportJson, exportXlsx, perPageJson, crawlMode]
    )
    const code = useMemo(() => generatePythonCode(functions, sourceUrl, exportOptions), [functions, sourceUrl, exportOptions])
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            // clipboard API unavailable/blocked (e.g. insecure context) — nothing to recover to
        }
    }

    const handleDownload = () => {
        const filename = (() => {
            try {
                const host = new URL(sourceUrl).hostname.replace(/[^a-zA-Z0-9]+/g, '_')
                return `${host || 'scraper'}.py`
            } catch {
                return 'scraper.py'
            }
        })()
        const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/x-python' }))
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = filename
        a.click()
        URL.revokeObjectURL(blobUrl)
    }

    return (
        <div className='w-full text-sm py-6'>
            <div className='flex items-center gap-2 mb-2'>
                <span
                    className='w-1.5 h-1.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#8be8ab,#2f9e5c_60%,#14532d_100%)] shadow-[0_0_3px_1px_rgba(74,222,128,0.6)]'
                />
                <span className='font-sans font-extrabold text-xs tracking-[0.12em] uppercase text-[#3a3d42]'>Build a function</span>
            </div>

            <div
                className='
                    flex flex-col gap-3 rounded-xl p-3
                    bg-[linear-gradient(180deg,#eef1ef_0%,#dfe4e0_100%)]
                    border border-[#c3c9c4]
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_5px_rgba(0,0,0,0.06)]
                '
            >
                <div className='flex flex-col gap-1'>
                    <label className='text-xs text-gray-500'>Function name</label>
                    <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder='get_header'
                        className={`font-mono ${inputClass}`}
                    />
                </div>

                <div className='flex flex-col gap-1'>
                    <label className='text-xs text-gray-500'>Type</label>
                    <select
                        value={draftCategory}
                        onChange={(e) => onCategoryChange(e.target.value as FnCategory)}
                        className={inputClass}
                    >
                        {(Object.keys(CATEGORY_LABELS) as FnCategory[]).map(cat => (
                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                        ))}
                    </select>
                </div>

                {layerPick && (
                    <ElementLayerPicker
                        chain={layerPick.chain}
                        extract={layerPick.extract}
                        onSelectLevel={onLayerSelectLevel}
                        onDescend={onLayerDescend}
                        onExtractChange={onLayerExtractChange}
                        onConfirm={onLayerConfirm}
                        onCancel={onLayerCancel}
                    />
                )}

                {/* Pagination has two independent strategies — pick the mode before
                    anything else, since it decides whether there's even an element
                    to pick (url_pattern has none: a template + page range instead). */}
                {draftConfig.category === 'pagination' && (
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs text-gray-500'>Pagination strategy</label>
                        <div className='flex gap-1'>
                            <ModeButton
                                label='Next-page link'
                                active={draftConfig.mode === 'link'}
                                onClick={() => {
                                    if (pickTarget === 'main') onStartPickMain() // cancel any in-flight pick before switching modes
                                    setDraftConfig({ category: 'pagination', mode: 'link', next: null })
                                }}
                            />
                            <ModeButton
                                label='URL pattern'
                                active={draftConfig.mode === 'url_pattern'}
                                onClick={() => {
                                    if (pickTarget === 'main') onStartPickMain()
                                    setDraftConfig({
                                        category: 'pagination',
                                        mode: 'url_pattern',
                                        urlTemplate: suggestUrlTemplate(sourceUrl) ?? '',
                                        startPage: 1,
                                        endPage: 10,
                                    })
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Main target slot — every category has exactly one, except
                    pagination's url_pattern mode, which has its own form below. */}
                {!(draftConfig.category === 'pagination' && draftConfig.mode === 'url_pattern') && (
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs text-gray-500'>{MAIN_SLOT_LABELS[draftCategory]}</label>
                        <div>
                            <PickButton
                                label={mainTargetOf(draftConfig) ? 'Change element' : 'Pick element'}
                                active={pickTarget === 'main'}
                                onClick={onStartPickMain}
                            />
                        </div>
                        {mainTargetOf(draftConfig) && <ElementPreview el={mainTargetOf(draftConfig)!} />}
                        {draftConfig.category !== 'list' && repeatHint !== null && (
                            <div className='text-xs text-amber-600'>
                                ⚠ this element repeats {repeatHint} times on the page — its text will all get
                                concatenated into one blob. Switch Type to "List" to extract each one as
                                structured fields instead.
                            </div>
                        )}
                        {draftConfig.category === 'list' && draftConfig.item && groupMatchCount !== null && (
                            <div className={`text-xs font-mono ${groupMatchCount > 1 ? 'text-[#166534]' : 'text-amber-600'}`}>
                                {groupMatchCount > 1
                                    ? `✓ ${groupMatchCount} matching items found — selected as a group`
                                    : groupMatchCount === 1
                                        ? '⚠ only 1 match — pick a less specific element so the whole group is captured'
                                        : '⚠ no matches for this selector'}
                            </div>
                        )}
                    </div>
                )}

                {draftConfig.category === 'pagination' && draftConfig.mode === 'url_pattern' && (
                    <div className='flex flex-col gap-2'>
                        <div className='flex flex-col gap-1'>
                            <label className='text-xs text-gray-500'>URL template — use <code>{'{page}'}</code> as the placeholder</label>
                            <input
                                value={draftConfig.urlTemplate}
                                onChange={(e) => setDraftConfig(prev =>
                                    prev.category === 'pagination' && prev.mode === 'url_pattern'
                                        ? { ...prev, urlTemplate: e.target.value } : prev
                                )}
                                placeholder='https://example.com/page-{page}.html'
                                className={`font-mono ${inputClass}`}
                            />
                            {!draftConfig.urlTemplate.includes('{page}') && draftConfig.urlTemplate.length > 0 && (
                                <span className='text-xs text-amber-600'>needs a {'{page}'} placeholder somewhere</span>
                            )}
                        </div>
                        <div className='flex gap-2'>
                            <div className='flex flex-col gap-1 flex-1'>
                                <label className='text-xs text-gray-500'>Start page</label>
                                <input
                                    type='number'
                                    min={0}
                                    value={draftConfig.startPage}
                                    onChange={(e) => setDraftConfig(prev =>
                                        prev.category === 'pagination' && prev.mode === 'url_pattern'
                                            ? { ...prev, startPage: Number(e.target.value) } : prev
                                    )}
                                    className={inputClass}
                                />
                            </div>
                            <div className='flex flex-col gap-1 flex-1'>
                                <label className='text-xs text-gray-500'>End page</label>
                                <input
                                    type='number'
                                    min={draftConfig.startPage}
                                    value={draftConfig.endPage}
                                    onChange={(e) => setDraftConfig(prev =>
                                        prev.category === 'pagination' && prev.mode === 'url_pattern'
                                            ? { ...prev, endPage: Number(e.target.value) } : prev
                                    )}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Category-specific extra options. The layer picker above already
                    offers this choice at pick time — this is the "change your mind
                    afterward without re-picking" path, reading candidate attribute
                    names back out of the target's stored outerHTML. */}
                {(draftConfig.category === 'text' || draftConfig.category === 'header') && (
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs text-gray-500'>Extract</label>
                        <select
                            value={draftConfig.extract.kind === 'attr' ? `attr:${draftConfig.extract.name}` : draftConfig.extract.kind}
                            onChange={(e) => setDraftConfig(prev => {
                                if (prev.category !== 'text' && prev.category !== 'header') return prev
                                const v = e.target.value
                                const extract: ExtractMode = v.startsWith('attr:')
                                    ? { kind: 'attr', name: v.slice('attr:'.length) }
                                    : { kind: v as 'text' | 'html' }
                                return { ...prev, extract }
                            })}
                            className={inputClass}
                        >
                            <option value='text'>Text only</option>
                            <option value='html'>Inner HTML</option>
                            {attributesFromHtml(mainTargetOf(draftConfig)?.html ?? '').map(name => (
                                <option key={name} value={`attr:${name}`}>Attribute: {name}</option>
                            ))}
                            {draftConfig.extract.kind === 'attr' && !attributesFromHtml(mainTargetOf(draftConfig)?.html ?? '').includes(draftConfig.extract.name) && (
                                <option value={`attr:${draftConfig.extract.name}`}>Attribute: {draftConfig.extract.name}</option>
                            )}
                        </select>
                    </div>
                )}

                {draftConfig.category === 'links' && (
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs text-gray-500'>Extract from each &lt;a&gt;</label>
                        <select
                            value={draftConfig.extract}
                            onChange={(e) => setDraftConfig(prev =>
                                prev.category === 'links' ? { ...prev, extract: e.target.value as 'text' | 'href' | 'both' } : prev
                            )}
                            className={inputClass}
                        >
                            <option value='text'>Text only</option>
                            <option value='href'>href only</option>
                            <option value='both'>Text + href</option>
                        </select>
                    </div>
                )}

                {draftConfig.category === 'table' && (
                    <label className='flex items-center gap-2 text-xs text-gray-600'>
                        <input
                            type='checkbox'
                            checked={draftConfig.firstRowIsHeader}
                            onChange={(e) => setDraftConfig(prev =>
                                prev.category === 'table' ? { ...prev, firstRowIsHeader: e.target.checked } : prev
                            )}
                            className='accent-[#22a55e]'
                        />
                        First row is header
                    </label>
                )}

                {draftConfig.category === 'list' && (
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs text-gray-500'>Fields inside each item</label>
                        {detectedFields && detectedFields.length > 0 && (
                            <DetectedFieldsPicker
                                key={detectedFields.map(f => f.selector).join('|')}
                                candidates={detectedFields}
                                onAdd={onAddDetectedFields}
                            />
                        )}
                        {draftConfig.fields.map(f => (
                            <div key={f.id} className='flex items-center gap-2 text-xs bg-white border border-[#c7cdc9] rounded-lg px-2 py-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]'>
                                <span className='font-semibold'>{f.name}</span>
                                <span className='px-1 py-0.5 rounded-full bg-[#dcf3e4] text-[#166534] font-mono border border-[#b8e2c6]'>{f.ref.tag}</span>
                                <button onClick={() => onRemoveField(f.id)} className='ml-auto text-gray-400 hover:text-red-500'>×</button>
                            </div>
                        ))}
                        <div>
                            <PickButton
                                label='+ Add field'
                                active={pickTarget === 'field'}
                                onClick={onStartPickField}
                            />
                        </div>
                        {!draftConfig.item && (
                            <span className='text-xs text-gray-400'>Pick the item element first.</span>
                        )}
                    </div>
                )}

                {naming && (
                    <div className='flex items-center gap-2 mt-1'>
                        <span className='text-xs text-gray-500'>Name this &lt;{naming.ref.tag}&gt; field:</span>
                        <input
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            className={`text-xs ${inputClass}`}
                            autoFocus
                        />
                        <button onClick={onConfirmField} className={`px-2 py-1 ${glossyGreenButtonClass}`}>Add</button>
                        <button onClick={onCancelNaming} className='text-xs text-gray-400'>Cancel</button>
                    </div>
                )}

                <div className='flex items-center gap-2 mt-1'>
                    <button
                        onClick={onCreate}
                        disabled={!canCreate}
                        className={`px-3 py-1.5 ${glossyGreenButtonClass}`}
                    >
                        {editingId ? 'Update function' : 'Create function'}
                    </button>
                    {editingId && (
                        <button onClick={onCancelEdit} className='text-xs text-gray-400 hover:text-gray-600'>Cancel edit</button>
                    )}
                </div>
            </div>

            {functions.length > 0 && (
                <div className='mt-4 flex flex-col gap-2'>
                    <div className='flex items-center justify-between'>
                        <div className='font-sans font-extrabold text-xs tracking-[0.12em] uppercase text-[#3a3d42]'>Functions</div>
                        <button onClick={onClearAll} className='text-xs text-gray-400 hover:text-red-500'>Clear all</button>
                    </div>
                    <p className='text-[10px] text-gray-400 -mt-1'>Drag ⠿ to reorder — generated code and crawl order follow this list.</p>
                    <FunctionList
                        functions={functions}
                        editingId={editingId}
                        onEditFunction={onEditFunction}
                        onDeleteFunction={onDeleteFunction}
                        onReorderFunctions={onReorderFunctions}
                    />
                </div>
            )}

            {functions.length > 0 && (
                <div className='mt-4 flex flex-col gap-2'>
                    <div className='flex items-center justify-between'>
                        <div className='font-sans font-extrabold text-xs tracking-[0.12em] uppercase text-[#3a3d42]'>Test Extraction</div>
                        <button
                            onClick={onRun}
                            disabled={!canRun}
                            className={`px-3 py-1.5 ${glossyGreenButtonClass}`}
                        >
                            Run
                        </button>
                    </div>
                    {!extractionResult && (
                        <p className='text-xs text-gray-400'>
                            {canRun ? 'Run to see what each function actually extracts from the live preview.' : 'Fetch a page first.'}
                        </p>
                    )}
                    {extractionResult && (
                        <div className='flex flex-col gap-2 max-h-72 overflow-y-auto'>
                            {functions.map(fn => {
                                const result = extractionResult[fn.name]
                                if (!result) return null
                                return (
                                    <div
                                        key={fn.id}
                                        className='
                                            rounded-lg p-2.5 bg-white
                                            border border-[#c7cdc9]
                                            shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]
                                        '
                                    >
                                        <div className='flex items-center gap-2'>
                                            <span className='font-mono font-semibold text-xs'>{fn.name}()</span>
                                            {!result.ok && <span className='text-xs text-red-600'>error</span>}
                                        </div>
                                        {result.ok ? (
                                            <pre className='mt-1 font-mono text-[11px] text-gray-600 whitespace-pre-wrap wrap-break-word'>{formatResult(result.value)}</pre>
                                        ) : (
                                            <p className='mt-1 text-xs text-red-600'>{result.error}</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {functions.length > 0 && (
                <div className='mt-4 flex flex-col gap-2'>
                    <div className='flex items-center justify-between flex-wrap gap-y-1'>
                        <div className='font-sans font-extrabold text-xs tracking-[0.12em] uppercase text-[#3a3d42]'>Generated Python</div>
                        <div className='flex items-center gap-3'>
                            <label className='flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer select-none'>
                                <input
                                    type='checkbox'
                                    checked={exportJson}
                                    onChange={e => setExportJson(e.target.checked)}
                                    className='accent-[#2b6b3f]'
                                />
                                Also write JSON
                            </label>
                            {exportJson && crawlMode && (
                                <label className='flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer select-none'>
                                    <input
                                        type='checkbox'
                                        checked={perPageJson}
                                        onChange={e => setPerPageJson(e.target.checked)}
                                        className='accent-[#2b6b3f]'
                                    />
                                    Group by page
                                </label>
                            )}
                            <label className='flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer select-none'>
                                <input
                                    type='checkbox'
                                    checked={exportXlsx}
                                    onChange={e => setExportXlsx(e.target.checked)}
                                    className='accent-[#2b6b3f]'
                                />
                                Also write XLSX
                            </label>
                        </div>
                    </div>
                    <pre
                        className='
                            font-mono text-[11px] leading-relaxed text-[#9be8ab] whitespace-pre-wrap wrap-break-word
                            rounded-xl p-3 max-h-72 overflow-y-auto
                            bg-[linear-gradient(180deg,#1e2b23_0%,#0f1811_100%)]
                            border border-[#1f3a28]
                            shadow-[inset_0_1px_3px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.15)]
                        '
                    >
                        {code}
                    </pre>
                    <div className='flex items-center gap-2 justify-end'>
                        <button
                            onClick={handleDownload}
                            className='
                                text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors
                                shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.15)]
                                bg-[linear-gradient(180deg,#f7f8f7_0%,#e2e6e3_100%)]
                                border-[#b9c0ba] text-gray-700 hover:brightness-105
                            '
                        >
                            Download
                        </button>
                        <button
                            onClick={handleCopy}
                            className='
                                text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors
                                shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.15)]
                                bg-[linear-gradient(180deg,#f7f8f7_0%,#e2e6e3_100%)]
                                border-[#b9c0ba] text-gray-700 hover:brightness-105
                            '
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// Pulls whatever the "main" element ref is out of a config, regardless of category.
function mainTargetOf(config: FnConfig): ElementRef | null {
    switch (config.category) {
        case 'header': return config.target
        case 'text': return config.target
        case 'links': return config.container
        case 'list': return config.item
        case 'table': return config.table
        case 'pagination': return config.mode === 'link' ? config.next : null
    }
}

// Recovers attribute names from a target's stored outerHTML, for the
// post-hoc "Extract" dropdown — the target itself is long gone (it lived in
// the iframe's now-possibly-reloaded document), but its full outerHTML was
// captured at pick time and survives in the ElementRef.
function attributesFromHtml(html: string): string[] {
    if (!html) return []
    try {
        const el = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild
        return el ? Array.from(el.attributes).map(a => a.name) : []
    } catch {
        return []
    }
}

export default FunctionBuilderPanel
