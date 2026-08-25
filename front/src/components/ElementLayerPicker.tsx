// Shown right after a click in the preview, before it's applied to a
// function's target/field. A click only ever gives you the exact element
// under the cursor — this lets you move up to an ancestor (the <a> wrapping
// what you clicked) or down into a child (the <img> inside it) before
// committing, and — when relevant — choose exactly what to pull out of
// whichever level you land on: text, inner HTML, or one specific attribute.

import { childElementCandidates, attributeNamesOf } from '../lib/elementLayers'
import { applyExtract } from '../lib/extract'
import type { ExtractMode } from '../types/builder'

const describeElement = (el: Element): string => {
    if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`
    const cls = Array.from(el.classList)[0]
    return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase()
}

const truncate = (s: string, max = 60): string => (s.length > max ? s.slice(0, max) + '…' : s)

interface Props {
    chain: Element[]
    // null when this category doesn't have a choosable extraction (e.g. the
    // list item boundary, the links container, the table root) — the level
    // picker (breadcrumb + contains-chips) still applies, just not this part.
    extract: ExtractMode | null
    onSelectLevel: (index: number) => void
    onDescend: (child: Element) => void
    onExtractChange: (mode: ExtractMode) => void
    onConfirm: () => void
    onCancel: () => void
}

const chipClass = `
    text-xs font-mono px-2 py-1 rounded-md border transition-colors
    bg-[linear-gradient(180deg,#f7f8f7_0%,#e2e6e3_100%)]
    border-[#b9c0ba] text-gray-700 hover:brightness-105
`

const ElementLayerPicker = ({ chain, extract, onSelectLevel, onDescend, onExtractChange, onConfirm, onCancel }: Props) => {
    const current = chain[chain.length - 1]
    const children = childElementCandidates(current)
    const attrs = attributeNamesOf(current)
    const preview = extract ? applyExtract(current, extract) : null

    return (
        <div className='flex flex-col gap-2 p-3 rounded-lg border border-[#b9c0ba] bg-[#eef1ee]'>
            <div className='font-sans font-extrabold text-xs tracking-[0.12em] uppercase text-[#3a3d42]'>
                Refine element
            </div>

            <div>
                <div className='text-[10px] font-semibold text-gray-500 mb-1'>Layers (click to move up)</div>
                <div className='flex flex-wrap items-center gap-1'>
                    {chain.map((el, i) => (
                        <span key={i} className='flex items-center gap-1'>
                            {i > 0 && <span className='text-gray-400 text-xs'>›</span>}
                            <button
                                onClick={() => onSelectLevel(i)}
                                className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                    i === chain.length - 1
                                        ? 'bg-[#2b6b3f] text-white font-bold'
                                        : 'text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {describeElement(el)}
                            </button>
                        </span>
                    ))}
                </div>
            </div>

            {children.length > 0 && (
                <div>
                    <div className='text-[10px] font-semibold text-gray-500 mb-1'>Contains (click to descend)</div>
                    <div className='flex flex-wrap gap-1.5'>
                        {children.map((child, i) => (
                            <button key={i} onClick={() => onDescend(child)} className={chipClass}>
                                {describeElement(child)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {extract && (
                <div>
                    <div className='text-[10px] font-semibold text-gray-500 mb-1'>Extract</div>
                    <div className='flex flex-wrap gap-1.5'>
                        <button
                            onClick={() => onExtractChange({ kind: 'text' })}
                            className={`${chipClass} ${extract.kind === 'text' ? '!bg-[#2b6b3f] !text-white !border-[#1e4d2c]' : ''}`}
                        >
                            Text
                        </button>
                        <button
                            onClick={() => onExtractChange({ kind: 'html' })}
                            className={`${chipClass} ${extract.kind === 'html' ? '!bg-[#2b6b3f] !text-white !border-[#1e4d2c]' : ''}`}
                        >
                            Inner HTML
                        </button>
                        {attrs.map(name => (
                            <button
                                key={name}
                                onClick={() => onExtractChange({ kind: 'attr', name })}
                                className={`${chipClass} ${extract.kind === 'attr' && extract.name === name ? '!bg-[#2b6b3f] !text-white !border-[#1e4d2c]' : ''}`}
                            >
                                attr: {name}
                            </button>
                        ))}
                        <input
                            placeholder='other attribute…'
                            value={extract.kind === 'attr' && !attrs.includes(extract.name) ? extract.name : ''}
                            onChange={e => onExtractChange({ kind: 'attr', name: e.target.value })}
                            className='text-xs font-mono px-2 py-1 rounded-md border border-[#b9c0ba] w-28'
                        />
                    </div>
                </div>
            )}

            <div className='text-[10px] font-mono text-gray-500 bg-white/60 rounded px-2 py-1 border border-[#d6dad7]'>
                {extract ? `→ ${JSON.stringify(preview)}` : truncate(current.outerHTML)}
            </div>

            <div className='flex items-center gap-2 justify-end'>
                <button
                    onClick={onCancel}
                    className='text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#b9c0ba] text-gray-600 hover:brightness-105'
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className='
                        text-xs font-bold px-3 py-1.5 rounded-lg text-white
                        bg-[linear-gradient(180deg,#4ade80_0%,#22a55e_50%,#15803d_51%,#22a55e_100%)]
                        border border-[#14532d] hover:brightness-110
                    '
                >
                    Use this
                </button>
            </div>
        </div>
    )
}

export default ElementLayerPicker
