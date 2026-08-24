import React from 'react'

interface Props {
    children: React.ReactNode
}
const HomeLayout: React.FC<Props> = ({ children }) => {
    return (
        <div className='min-h-screen w-full bg-[linear-gradient(180deg,#eef2ef_0%,#dde4de_100%)]'>
            <div className='w-full py-2 px-12 mx-auto flex items-stretch justify-center gap-2 flex-col'>
                {children}
            </div>
        </div>
    )
}

export default HomeLayout
