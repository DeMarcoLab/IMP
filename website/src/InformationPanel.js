import React, { useRef, useState, useEffect } from 'react';

import { VisViewer } from './VisViewer.js'
export const InformationPanel = () => {
    const [inputFile, setInputFile] = useState()
    const [fileList, setFileList] = useState([])
    const [fileData, setFileData] = useState()
    const [proteinData, setProteomics] = useState()
    const size = useWindowSize();

    useEffect(() => {
        //fetches a list of files to display for the user for selection. in the database, there will probably be a job to run to create a file, or several if several sources, like this as well.
        // currently these are just testing files located in the public folder.

        let fetchstring = process.env.PUBLIC_URL + '/data/listOfFiles.json';
        console.log('Fetching ' + fetchstring);
        fetch(fetchstring, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        }).then(response => response.json())
            .then(data => setFileList(data.files));

    }, []) //does this only once on load


    const changeInputFile = (newFile) => {
        console.log(newFile)
        let obj = fileList.find(o => o.name === newFile);
        //set the new file data
        setFileData(obj)
        setInputFile("data/" + newFile)


        //load the proteomics data
        let fetchstring = process.env.PUBLIC_URL + '/data/proteomics/' + newFile.split(".")[0] + ".json";  //loads the available data for the file, with the matching name --- should probably be a unique ID instead!
        fetch(fetchstring, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        }).then(response => response.json())
            .then(data => setProteomics(data));
    }

    return (
        <div id="root" className="flex">
            <div id="menu">
                <DataPanelSection fileList={fileList} fileCallback={changeInputFile} inputFile={inputFile} fileData={fileData} />
                <ProteomicsPanelSection proteinData={proteinData} />

            </div>
            <VisViewer filePath={inputFile} height={size.height} />
        </div>
    )


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

const DataPanelSection = ({ fileList, fileCallback, fileData }) => {


    const selectRef = useRef();
    const onChange = () => {
        //console.log(selectRef.current.value)
        fileCallback(selectRef.current.value)
    }

    return (
        <aside className="infoPanelSection">
            <h3>File</h3>

            <select
                className="dropdown-medium"

                onChange={onChange}
                ref={selectRef}
            >
                {fileList.map((file, i) => (

                    <option key={'file' + i} value={file.name}>

                        {file.name}
                    </option>
                ))}
            </select>
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
            <h3>Proteomics</h3>
            {proteinData ?
                <table className="proteinList">
                    <tr><th>Protein</th><th>#</th> <th>Probability</th></tr>
                    {proteinData.map((protein, i) => (

                       <tr className="proteinListElement" key={'file' + i} value={protein.name}>
                                <td>{protein.name}</td>
                                <td>{protein.num}</td>
                                <td>{protein.probability}</td>
                        </tr>
                    ))}
                </table>
                : ""}
        </aside>
    )
}