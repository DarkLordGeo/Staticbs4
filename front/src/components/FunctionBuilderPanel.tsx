import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ElementRef, FnCategory, FnConfig, FnGroup } from '../types/builder'
import { CATEGORY_LABELS, MAIN_SLOT_LABELS, summarizeFn } from '../types/builder'
import { generatePythonCode } from '../lib/codegen'

const truncateHtml = (html: string, max = 50) =>
    html.length > max ? html.slice(0, max) + '…' : html

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

interface Props {
    sourceUrl: string
    groupMatchCount: number | null
    draftName: string
    setDraftName: (v: string) => void
    draftCategory: FnCategory
    onCategoryChange: (c: FnCategory) => void
    draftConfig: FnConfig
    setDraftConfig: Dispatch<SetStateAction<FnConfig>>
    pickTarget: 'main' | 'field' | null
    onStartPickMain: () => void
    onStartPickField: () => void
    naming: ElementRef | null
    nameInput: string
    setNameInput: (v: string) => void
    onConfirmField: () => void
    onCancelNaming: () => void
    onRemoveField: (id: string) => void
    canCreate: boolean
    onCreate: () => void
    functions: FnGroup[]
    onDeleteFunction: (id: string) => void
}

const FunctionBuilderPanel = ({
    sourceUrl,
    groupMatchCount,
    draftName, setDraftName,
    draftCategory, onCategoryChange,
    draftConfig, setDraftConfig,
    pickTarget, onStartPickMain, onStartPickField,
    naming, nameInput, setNameInput, onConfirmField, onCancelNaming, onRemoveField,
    canCreate, onCreate,
    functions, onDeleteFunction,
}: Props) => {
    const code = useMemo(() => generatePythonCode(functions, sourceUrl), [functions, sourceUrl])
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

                {/* Main target slot — every category has exactly one */}
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

                {/* Category-specific extra options */}
                {draftConfig.category === 'text' && (
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs text-gray-500'>Extract</label>
                        <select
                            value={draftConfig.mode}
                            onChange={(e) => setDraftConfig(prev =>
                                prev.category === 'text' ? { ...prev, mode: e.target.value as 'text' | 'html' } : prev
                            )}
                            className={inputClass}
                        >
                            <option value='text'>Text only</option>
                            <option value='html'>Inner HTML</option>
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
                        <span className='text-xs text-gray-500'>Name this &lt;{naming.tag}&gt; field:</span>
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

                <button
                    onClick={onCreate}
                    disabled={!canCreate}
                    className={`mt-1 px-3 py-1.5 ${glossyGreenButtonClass}`}
                >
                    Create function
                </button>
            </div>

            {functions.length > 0 && (
                <div className='mt-4 flex flex-col gap-2'>
                    <div className='font-sans font-extrabold text-xs tracking-[0.12em] uppercase text-[#3a3d42]'>Functions</div>
                    {functions.map(fn => (
                        <div
                            key={fn.id}
                            className='
                                rounded-xl p-2.5
                                bg-[linear-gradient(180deg,#f7f9f7_0%,#eaeeeb_100%)]
                                border border-[#c3c9c4]
                                shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.08)]
                            '
                        >
                            <div className='flex items-center gap-2'>
                                <span className='font-mono font-semibold'>{fn.name}()</span>
                                <span className='text-xs px-1.5 py-0.5 rounded-full bg-[#dcf3e4] text-[#166534] border border-[#b8e2c6]'>{CATEGORY_LABELS[fn.config.category]}</span>
                                <button onClick={() => onDeleteFunction(fn.id)} className='ml-auto text-gray-400 hover:text-red-500 text-xs'>delete</button>
                            </div>
                            <div className='text-xs text-gray-500 mt-1'>{summarizeFn(fn)}</div>
                        </div>
                    ))}
                </div>
            )}

            {functions.length > 0 && (
                <div className='mt-4 flex flex-col gap-2'>
                    <div className='flex items-center justify-between'>
                        <div className='font-sans font-extrabold text-xs tracking-[0.12em] uppercase text-[#3a3d42]'>Generated Python</div>
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
        case 'pagination': return config.next
    }
}

export default FunctionBuilderPanel
