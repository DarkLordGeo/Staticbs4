
import React, { useEffect } from 'react'

interface Props {
    siteValue: string
}




const RenderHTML: React.FC<Props> = ({ siteValue }) => {

 
    // const applyHtml = (html: any) => {
        
    //     console.log(element)
    //     element.innerHTML = html
    // }
    
    useEffect(() => {
        const element: HTMLElement = document.body.querySelector(".element")!
        element.innerHTML = siteValue
        // applyHtml(children)
    }, [siteValue])

    return <>
        <div className='element'>
            {/* {children} */}
        </div>
    </>
}

export default RenderHTML
