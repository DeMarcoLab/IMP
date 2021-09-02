import React, { useRef, createRef, useState, useEffect } from 'react';

import { NeuroglancerViewer } from './NeuroglancerViewer.js'
import { VisViewer } from './VisViewer.js'
export const InformationPanel = () => {
    const [inputFileAndID, setInputFileAndID] = useState([])
    const [fileList, setFileList] = useState([])
    const [fileData, setFileData] = useState()
    const [proteinData, setProteomics] = useState()
    const size = useWindowSize();
    const menuRef = useRef()
    const iframeRef = createRef()
    const [menuFocus, setMenuFocus] = useState(true)

    useEffect(() => {
        //fetches a list of files to display for the user for selection. in the database, there will probably be a job to run to create a file, or several if several sources, like this as well.
        // currently these are just testing files located in the public folder.

        let fetchstring = process.env.PUBLIC_URL + '/data/Neuroglancer/idToUrlmapping.json';
        console.log('Fetching ' + fetchstring);
        fetch(fetchstring, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        }).then(response => response.json())
            .then(data =>
                setFileList(data))


    }, []) //does this only once on load

    const setFocus = () => {

        setMenuFocus(true)
    }

    const removeFocus = () => {
        setMenuFocus(false)
    }
    const changeInputFile = (newFile) => {
        
        let obj = fileList[newFile]
        //set the new file data
        setFileData(obj)
        setInputFileAndID([newFile, obj["url"]])
        removeFocus()

        //load the proteomics data
        let fetchstring = process.env.PUBLIC_URL + '/data/proteomics/' + newFile + ".json";  //loads the available data for the file, with the matching name --- should probably be a unique ID instead!
        setProteomics(null)
        fetch(fetchstring, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        }).then(response => response.json())
            .then(function(data) {
                console.log(data[0])
            setProteomics(data) ;
            })
        }
    

    return (
        <div id="root" className="flex">
            <div id="menu" ref={menuRef}  >
                <DataPanelSection onMouseEnter={setFocus} onMouseLeave={removeFocus} fileList={fileList} fileCallback={changeInputFile} inputFile={inputFileAndID[1]} fileData={fileData} />
                <ProteomicsPanelSection proteinData={proteinData} />

            </div>
            {/*<VisViewer filePath={inputFile} height={size.height} /> */}
            <NeuroglancerViewer menuFocus={menuFocus} ref={iframeRef} setID={inputFileAndID[0]} filePath={inputFileAndID[1]} height={size.height} />
        </div>
    )

// https://webdev.imp-db.cloud.edu.au:3001/?json_url=https://json.neurodata.io/v1?NGStateID=4O1ttVfWmNB56Q&proteomics_url=https://webdev.imp-db.cloud.edu.au:3002/YeastWithBubbles/proteomics/data.json
}

function useWindowSize() {
    // Initialize state with undefined width/height so server and client renders match
    // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
    const [windowSize, setWindowSize] = useState({
        width: undefined,
        height: undefined,
    });
    useEffect(() => {
        // Handler to call on window resize
        function handleResize() {
            // Set window width/height to state
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        }
        // Add event listener
        window.addEventListener("resize", handleResize);
        // Call handler right away so state gets updated with initial window size
        handleResize();
        // Remove event listener on cleanup
        return () => window.removeEventListener("resize", handleResize);
    }, []); // Empty array ensures that effect is only run on mount
    return windowSize;
}

const DataPanelSection = ({ fileList, fileCallback, fileData, onMouseEnter, onMouseLeave }) => {


    const selectRef = useRef();
    const onChange = () => {
        //console.log(selectRef.current.value)
        fileCallback(selectRef.current.value)
    }

    return (
        <aside className="infoPanelSection">
            <div className="menu-row">
                <p>File</p>

                <select
                    className="dropdown-medium"
                    onMouseDown={onMouseEnter} onMouseLeave={onMouseLeave}
                    onChange={onChange}
                    ref={selectRef}
                >
                    {Object.keys(fileList).map((file, i) => (
                        <option key={'file' + i} value={file}>
                            {file}
                        </option>
                    ))}
                </select>
            </div>
            {fileData ?
                <section id="fileInfo">
                    <div className="attributeRow">
                        <span className="attributeLabel">File Size</span>
                        <span className="attributeValue">{fileData.size} {fileData.unit} </span>
                    </div>
                    {fileData.description ?
                        <div className="attributeRow">
                            <span className="attributeLabel"> Description </span>
                            <span className="attributeValue">{fileData.description} </span>
                        </div>
                        : ""}

                </section>
                : ""}
        </aside>
    )
}

const ProteomicsPanelSection = ({ proteinData }) => {
    return (
        <aside className="infoPanelSection">
            <p className="sectionTitle">Proteomics</p>
            {proteinData ?
                <table className="proteinList">
                    <thead>
                        <tr><th>Majority protein ID</th><th>iBAQ</th></tr>
                    </thead>
                    <tbody>
                        {proteinData.map((protein, i) => (

                            <tr className="proteinListElement" key={'file' + i} value={protein["Majority protein ID"]}>
                                <td>{protein["Majority protein ID"]}</td>
                                <td>{protein.iBAQ}</td>

                            </tr>
                        ))}
                    </tbody>
                </table>
                : ""}
        </aside>
    )
}