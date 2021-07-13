/*https://viz.neurodata.io/#!%7B%22dimensions%22:%7B%22x%22:%5B0.000003363538%2C%22m%22%5D%2C%22y%22:%5B0.0000032511860000000004%2C%22m%22%5D%2C%22z%22:%5B0.000001313114%2C%22m%22%5D%7D%2C%22
position%22:%5B995.503662109375%2C975.8992309570312%2C360.5%5D%2C%22crossSectionScale%22:7.389056098930651%2C%22projectionOrientation%22:%5B0%2C0.0021816599182784557%2C0%2C0.999997615814209%5D%2C%22
projectionScale%22:8192%2C%22layers%22:%5B%7B%22type%22:%22image%22%2C%22source%22:%22precomputed://gs://publiccave2.appspot.com/8bit_big%22%2C%22tab%22:%22source%22%2C%22name%22:%228bit_big%22%7D%2C%7B%22
type%22:%22annotation%22%2C%22source%22:%22precomputed://gs://publiccave2.appspot.com/nucleosomes%22%2C%22tab%22:%22
source%22%2C%22name%22:%22Nucleosomes%22%7D%2C%7B%22type%22:%22annotation%22%2C%22source%22:%22precomputed://gs://publiccave2.appspot.com/ribosomes%22%2C%22tab%22:%22source%22%2C%22
annotationColor%22:%22#0400ff%22%2C%22name%22:%22ribosomes%22%7D%2C%7B%22type%22:%22annotation%22%2C%22source%22:%7B%22url%22:%22local://annotations%22%2C%22transform%22:%7B%22
outputDimensions%22:%7B%22x%22:%5B0.000003363538%2C%22m%22%5D%2C%22y%22:%5B0.0000032511860000000004%2C%22m%22%5D%2C%22z%22:%5B0.000001313114%2C%22m%22%5D%7D%7D%7D%2C%22tool%22:%22
annotateSphere%22%2C%22annotationColor%22:%22#ff00f7%22%2C%22annotations%22:%5B%7B%22center%22:%5B652%2C1067%2C312%5D%2C%22radii%22:%5B133.76177978515625%2C96.955810546875%2C48.503387451171875%5D%2C%22
type%22:%22ellipsoid%22%2C%22id%22:%2259086a370294538ae4b6e4cb371ea9c2f20571ca%22%2C%22description%22:%22Pink%20blob%5Cn%22%7D%5D%2C%22name%22:%22new%20layer%22%7D%5D%2C%22selectedLayer%22:%7B%22
layer%22:%22new%20layer%22%2C%22visible%22:true%7D%2C%22layout%22:%22xy-3d%22%2C%22selection%22:%7B%22layers%22:%7B%22new%20layer%22:%7B%22annotationId%22:%2259086a370294538ae4b6e4cb371ea9c2f20571ca%22%2C%22
annotationSource%22:0%2C%22annotationSubsource%22:%22default%22%7D%7D%7D%2C%22partialViewport%22:%5B0%2C0%2C1%2C1%5D%7D*/

import React, { Fragment, forwardRef, useEffect } from 'react';

export const NeuroglancerViewer = forwardRef((props, ref) => {

    useEffect(() => {
        console.log(props.setID)
    }, [props.setID])

    return (
  
         
            <div id="vis-panel" style={{ minHeight: props.height }} className={props.menuFocus ? "noInteraction" : ""}>
                {props.filePath ?
                    <Fragment>
                        <h3>Showing <span className="fileNameString">{props.setID} </span></h3>
                        <span> Press [h] to view controls</span>
                        <iframe ref={ref} seamless sandbox="allow-same-origin allow-scripts allow-downloads" title="Neuroglancer Viewer" id="frame1" className={`"resized" ${props.menuFocus ? "noInteraction" : ""}`} src={props.filePath} style={{ border: 'none', width: '100%', height: '100%', minHeight: props.height - 100 }}>
                        </iframe>
                    </Fragment>
                    :
                    <div className="selectPrompt"> Please select a file </div>
                }
            </div>
 
    )



})