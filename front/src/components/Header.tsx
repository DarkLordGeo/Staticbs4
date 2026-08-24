import { Link } from 'react-router'

const Header = () => {
  return (
    <div
      className="
        flex items-center justify-between px-6 py-3.5
        bg-[linear-gradient(180deg,#d8dbe0_0%,#b6bac1_45%,#9a9ea6_46%,#babdc4_100%)]
        border-b border-[#6f727a]
        shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-3px_6px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.25)]
      "
    >
      <Link to="/" className="flex items-center gap-2.5">
        <span
          className="
            w-1.5 h-1.5 rounded-full
            bg-[radial-gradient(circle_at_35%_30%,#8be8ab,#2f9e5c_60%,#14532d_100%)]
            shadow-[0_0_3px_1px_rgba(74,222,128,0.7),0_1px_1px_rgba(0,0,0,0.4)]
          "
        />
        <span
          className="
            font-sans font-extrabold text-[15px] tracking-[0.14em] uppercase
            text-[#3a3d42]
            [text-shadow:0_1px_0_rgba(255,255,255,0.7),0_-1px_0_rgba(0,0,0,0.15)]
          "
        >
          Site Inspector
        </span>
      </Link>

      <div
        className="
          flex items-center gap-2 px-2.5 py-1 rounded
          bg-[linear-gradient(180deg,#1e2b23,#0f1811)]
          border border-[#0a120d]
          shadow-[inset_0_1px_3px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.15)]
        "
      >
        <span
          className="
            w-2 h-2 rounded-full bg-[#4ade80]
            shadow-[0_0_4px_1px_#4ade80,0_0_8px_2px_rgba(74,222,128,0.6),inset_0_-1px_1px_rgba(0,0,0,0.3)]
          "
        />
        <span
          className="
            font-mono text-[10px] tracking-[0.08em] text-[#9be8ab]
            [text-shadow:0_0_4px_rgba(74,222,128,0.5)]
          "
        >
          READY
        </span>
      </div>
    </div>
  )
}

export default Header
