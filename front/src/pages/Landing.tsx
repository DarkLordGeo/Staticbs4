import { Link } from 'react-router'

const Landing = () => {
    return (
        <div
            className="
                min-h-screen w-full flex items-center justify-center px-6
                bg-[linear-gradient(180deg,#eef0f2_0%,#dcdfe3_100%)]
            "
        >
            <div
                className="
                    w-full max-w-xl flex flex-col items-center text-center gap-6
                    rounded-2xl px-10 py-12
                    bg-[linear-gradient(180deg,#e4e6e9_0%,#c7cad0_45%,#aeb2b9_46%,#cfd2d7_100%)]
                    border border-[#8f939b]
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-4px_10px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.25)]
                "
            >
                <div className="flex items-center gap-2.5">
                    <span
                        className="
                            w-2 h-2 rounded-full
                            bg-[radial-gradient(circle_at_35%_30%,#f2f2f2,#8a8d94_60%,#55575c_100%)]
                            shadow-[0_1px_1px_rgba(0,0,0,0.4)]
                        "
                    />
                    <span
                        className="
                            font-sans font-extrabold text-xs tracking-[0.18em] uppercase
                            text-[#5a5d64]
                        "
                    >
                        Site Inspector
                    </span>
                </div>

                <h1
                    className="
                        font-sans font-extrabold text-3xl sm:text-4xl tracking-tight uppercase
                        text-[#3a3d42]
                        [text-shadow:0_1px_0_rgba(255,255,255,0.7),0_-1px_0_rgba(0,0,0,0.15)]
                    "
                >
                    Turn any static site<br />into a scraper
                </h1>

                <p className="text-sm sm:text-base leading-relaxed text-[#54575e] max-w-md">
                    Paste a URL, pick the elements you care about right on the live page,
                    and get back working BeautifulSoup code — no manual selector hunting.
                </p>

                <Link
                    to="/search"
                    className="
                        mt-2 px-8 py-3 rounded-lg
                        font-sans font-bold text-sm tracking-[0.08em] uppercase
                        text-white
                        bg-[linear-gradient(180deg,#4ade80_0%,#22a55e_50%,#15803d_51%,#22a55e_100%)]
                        border border-[#14532d]
                        shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.3)]
                        transition-[filter,transform]
                        hover:brightness-110
                        active:translate-y-px
                        active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]
                    "
                >
                    Launch Inspector
                </Link>

                <Link
                    to="/docs"
                    className="text-xs font-sans font-semibold tracking-widest uppercase text-[#54575e] hover:text-[#166534]"
                >
                    Read the docs
                </Link>
            </div>
        </div>
    )
}

export default Landing
