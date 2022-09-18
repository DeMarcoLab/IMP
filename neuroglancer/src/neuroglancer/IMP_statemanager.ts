
//import { Position } from "./navigation_state.js";

import IMP_ColorTracker from './IMP_ColorTracker'
import { SegmentationDisplayState } from './segmentation_display_state/frontend';
import { Uint64 } from './util/uint64';
interface AvailableLayers {
    [key: string]: any
}
export default class IMP_StateManager {

    private imp_colortracker: IMP_ColorTracker;
    private static instance: IMP_StateManager;
    private visibleSegments: string[];
    //private annotArray: string[]

    //private stateJson: any;
    private state: any;
    private availableLayers: AvailableLayers;

    private firstRun: boolean;
    private position: number[];
    private dimensions: any[];

    private showsLicense: boolean;


    private idNameMap: Map<string, string>;
    private idPositionMap: Map<string, number[]>;

    private originalSegmentList: any;

    private areaModeOn: boolean;
    private drawingCoordinates: any[]

    private isDrawingMode: boolean;
    private isGroupingMode: boolean;
    private currGroup: string[];
    private layerToBeAdded: any;
    private annotationShaderString: string;
    private displayState: SegmentationDisplayState;

    private highlightColour: string;
    //  private segmentationDisplayState: SegmentationDisplayState;

    /*private xDrawings: Map<string, Drawing>;
    private yDrawings: Map<string, Drawing>;
    private zDrawings: Map<string, Drawing>;

    private currZDrawing: Drawing;
    private currYDrawing: Drawing;
    private currZDrawing:Drawing;

    private xCanvas: HTMLCanvasElement;
    private yCanvas: HTMLCanvasElement;
    private zCanvas: HTMLCanvasElement;*/

    private xDimWidget: HTMLElement;
    private yDimWidget: HTMLElement;
    private zDimWidget: HTMLElement;

    private colorpickerDiv: HTMLElement;

    private constructor() {
        this.availableLayers = {};

        this.firstRun = true;
        this.showsLicense = false;

        this.idNameMap = new Map<string, string>();

        this.idPositionMap = new Map<string, number[]>();

        this.dimensions = [];
        this.areaModeOn = false;
        this.drawingCoordinates = [[], []];
        this.isDrawingMode = false;
        this.isGroupingMode = false;
        this.currGroup = [];
        this.layerToBeAdded = null;
        this.annotationShaderString = "";

        this.imp_colortracker = new IMP_ColorTracker();
        this.highlightColour = "highlight";
        this.colorpickerDiv = document.createElement('div');
        this.colorpickerDiv.className = 'imp-color-picker-container';



        document.getElementById("neuroglancer-container")!.appendChild(this.colorpickerDiv);


    }




    public getIsDrawingMode() {
        return this.isDrawingMode;
    }
    public toggleIsDrawingMode() {
        this.isDrawingMode = !this.isDrawingMode;

        console.log("is Drawing mode: " + this.isDrawingMode)
    }
    public toggleAreaMode() {
        this.areaModeOn = !this.areaModeOn;
        console.log("areaModeOn: " + this.areaModeOn);
        if (this.areaModeOn) this.makeStateJSON(false, "", null, false, [], true);
    }
    public isAreaMode() {
        return this.areaModeOn;
    }
    public setCornerDrawing(position: Float32Array) {
        console.log(position)
        if (this.drawingCoordinates[0].length === 0) {
            this.drawingCoordinates[0] = [position[0], position[1], position[2]];
        } else {
            this.drawingCoordinates[1] = [position[0], position[1], position[2]];
            this.showMeshesInBox();
            this.drawingCoordinates = [[], []];
            // this.areaModeOn = false;


        }
    }

    public loadedDimsCallback(widget: HTMLDivElement, dim: string) {

        switch (dim) {
            case "x":
                this.xDimWidget = widget;

                break;
            case "y":
                this.yDimWidget = widget;

                break;
            case "z":
                this.zDimWidget = widget;

                break;
        }
    }
    public addDimWidgets(panel: HTMLElement, dim: string) {
        switch (dim) {
            case "x":
                panel.appendChild(this.xDimWidget)
                break;
            case "y":
                panel.appendChild(this.yDimWidget)

                break;
            case "z":
                panel.appendChild(this.zDimWidget)
                break;
        }


    }

    //take list of active meshes and download it in the same format as initially provided (i.e. with location/rotation)
    public downloadActiveSegments() {
        let currVisibleSegments: string[] = []

        const currLayers = this.state.toJSON().layers;
        for (let i = 0; i < currLayers.length; i++) {
            if (currLayers[i].type === "segmentation") {
                currVisibleSegments = currVisibleSegments.concat(currLayers[i].segments)
            }
        }
        let newPositionList: any = []
        for (let i = 0; i < currVisibleSegments.length; i++) {
            const pos = this.idPositionMap.get(currVisibleSegments[i]);
            //match the position of each visible segment with the originalFile list. 
            if (pos !== undefined) {
                for (let j = 0; j < this.originalSegmentList.length; j++) {
                    const entry = this.originalSegmentList[j];
                    if (entry["x"] === (pos[0] + "") && entry["y"] === (pos[1] + "") && entry["z"] === (pos[2] + "")) {
                        newPositionList.push(entry)
                    }
                }
            }

        }
        //console.log(this.originalSegmentList.length);
        //console.log(newPositionList.length);
        const header = Object.keys(newPositionList[0])
        const replacer = (key: any, value: any) => value === null ? '' : value // specify how you want to handle null values here
        const csvString = [
            header
            ,
            ...newPositionList.map((row: { [x: string]: any; }) => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
        ].join('\r\n')


        //console.log(csvString)
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(csvString));
        element.setAttribute('download', "visible_particles.csv");

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }
    private showMeshesInBox() {
        //console.log(this.drawingCoordinates);
        let group = []
        //console.log(this.idPositionMap.size)
        let minX = this.drawingCoordinates[0][0] < this.drawingCoordinates[1][0] ? this.drawingCoordinates[0][0] : this.drawingCoordinates[1][0];
        let minY = this.drawingCoordinates[0][1] < this.drawingCoordinates[1][1] ? this.drawingCoordinates[0][1] : this.drawingCoordinates[1][1];
        let minZ = this.drawingCoordinates[0][2] < this.drawingCoordinates[1][2] ? this.drawingCoordinates[0][2] : this.drawingCoordinates[1][2];
        let maxX = this.drawingCoordinates[0][0] > this.drawingCoordinates[1][0] ? this.drawingCoordinates[0][0] : this.drawingCoordinates[1][0];
        let maxY = this.drawingCoordinates[0][1] > this.drawingCoordinates[1][1] ? this.drawingCoordinates[0][1] : this.drawingCoordinates[1][1];
        let maxZ = this.drawingCoordinates[0][2] > this.drawingCoordinates[1][2] ? this.drawingCoordinates[0][2] : this.drawingCoordinates[1][2];
        for (let [key, value] of this.idPositionMap.entries()) {
            if (value[0] >= minX && value[0] <= maxX && value[1] >= minY && value[1] <= maxY && value[2] >= minZ && value[2] <= maxZ) {
                //console.log(key);
                group.push(key)

            }
        }
        // console.log(group.length);
        this.makeStateJSON(false, "", null, false, group);
    }


    public static getInstance(): IMP_StateManager {
        if (!IMP_StateManager.instance) {
            IMP_StateManager.instance = new IMP_StateManager();
        }

        return IMP_StateManager.instance;
    }

    public setOriginalSegmentList(original: any) {
        this.originalSegmentList = JSON.parse(original);
    }
    public addIdName(id: string, name: string) {
        this.idNameMap.set(id, name);

    }
    public addNameColour(name: string, colour: string) {
        this.imp_colortracker.addNameColour(name, colour)

    }
    public addLayer(layer: any, archived: boolean) {

        if (layer.type == "annotation") {
            for (const annotation of layer.annotations) {
                //         console.log(annotation["props"])
                this.imp_colortracker.addColorToStorage(annotation["id"], annotation["props"])
                this.imp_colortracker.addNormalisedField(annotation["id"], annotation["fields"])
                this.idPositionMap.set(annotation["id"], annotation["point"]);
            }

            this.imp_colortracker.addNameColorMapEntry(layer['name'], layer.annotations[0].props[0])

            if (this.annotationShaderString === "") {
                this.annotationShaderString = layer.shader;
            }

        }
        //colour the segmentation the same as annotation.
        if (layer.type == "segmentation") {
            let annotLayer = this.availableLayers[layer.name.split("_")[0]]
            if (annotLayer) {

                layer["segmentColors"] = {}
                for (const annotation of annotLayer.layer.annotations) {
                    layer["segments"].push(annotation["id"]) //display all segments per default.
                    layer["segmentColors"][annotation["id"]] = this.imp_colortracker.getColorFromID(annotation["id"])
                }
            }
            //
            this.imp_colortracker.setDefaultColorForLayerName(layer['name'], layer.segmentDefaultColor);

        }
        //console.log(layer)
        this.availableLayers[layer.name] = { "layer": layer, "archived": archived }
        //  console.log(this.colorStorage)
    }



    public getLayers() {
        return this.availableLayers;
    }
    public getPosition() {
        return this.position;
    }
    public setPosAndDim(position: any, dimensions: any) {
        this.position = position;
        this.dimensions = dimensions;
    }


    public makeStateJSON(colorByChanged: boolean = false, togglingSegment: string = "", highlightSegment: any = null, colorMapChanged: boolean = false, togglingGroup: string[] = [], selectionMode: boolean = false) {
        //console.log(this.availableLayers)
        //create layers array:
        let result = this.state.toJSON() //copy current state
        let layer_res = []

        //find active layers
        if (this.firstRun) {
            //copy the available layers over to the state.
            for (let key in this.availableLayers) {

                //the available layer is not yet in the state. add it to the layers.
                let archivedLayer = this.availableLayers[key].layer
                
                archivedLayer["archived"] =  archivedLayer.type === "image" ? false :true;

                if (archivedLayer.type === "annotation") {
                    archivedLayer["annotation_relationships"] = [archivedLayer["name"] + "_mesh"];
                }
                //            console.log(archivedLayer)
                layer_res.push(archivedLayer)
            }

            this.imp_colortracker.initColorByStrings()

            //selection layer to display meshes within a drawn box.
            layer_res.push({
                "type": "annotation", "source": "local://annotations", "tab": "annotations", "name": "selections",
                "archived": false,
                "tool": "annotateBoundingBox",
            });
        } else {
            layer_res = result.layers;
        }
        if (this.layerToBeAdded !== null) {
            layer_res.push(this.layerToBeAdded);
        }
        for (let layer of layer_res) {

            if (layer.type === "annotation") {
                layer["shaderControls"] = {
                    "colour_by": this.imp_colortracker.getCurrColorBy()
                }
            }
            if (colorByChanged || colorMapChanged) {

                if (layer.type === "segmentation") {
                    console.log(layer)
                    //        if (layer.hasAnnoConnection) {
                    let annotLayer = this.availableLayers[layer.name.split("_")[0]]
                    if (annotLayer) {

                        layer["segmentColors"] = {}

                        for (const annotation of annotLayer.layer.annotations) {
                            //  layer["segments"].push(annotation["id"])
                            let col = this.imp_colortracker.colorSegment(annotation["id"])
                            layer.segmentColors[annotation["id"]] = col !== "" ?
                                col :
                                annotation["props"][0]

                        }

                        //     }
                    }
                }

                if (layer.type == "annotation") {

                    //  layr["segments"].push(annotation["id"])
                    if (this.imp_colortracker.getCurrColorBy() !== 0) {
                        for (const annotation of layer.annotations) {
                            //layer["segmentColors"][annotation["id"]] = this.colorStorage[annotation["id"]][this.currColorBy];
                            let hexval = this.imp_colortracker.getHexVal(annotation["id"]);
                            annotation["props"][this.imp_colortracker.getCurrColorBy()] = hexval;
                        }
                    }
                }
            }
            let toggling_group: string[] = [];
            if (layer.imp_type === "group") {
                //this is an annotation layer, and we always want to display all corresponding meshes.
                for (let i = 0; i < layer.annotations.length; i++) {
                    /*let annot = {
                    "point": this.idPositionMap.get(this.currGroup[i]),
                    "type": "point",
                    "id": this.currGroup[i],
                    "description": this.currGroup[i],
                    "prop*/
                    toggling_group.push(layer.annotations[i].id);
                }
            }
            if (togglingSegment !== "") {
                let layerName = this.idNameMap.get(togglingSegment);
                if (layer.type == "segmentation" && layer.name.split("_")[0] == layerName) {
                    if (layer["archived"]) {
                        layer["segments"] = [togglingSegment];
                        layer["archived"] = true;
                    } else {
                        if (layer["segments"]) {
                            if (layer["segments"].indexOf(togglingSegment) >= 0) {
                                layer["segments"].splice(layer["segments"].indexOf(togglingSegment), 1)
                            } else {
                                layer["segments"].push(togglingSegment);
                            }
                        } else {
                            layer["segments"] = [togglingSegment]
                        }
                        break;
                    }
                }
            }
            if (togglingGroup.toString() !== "" || toggling_group.toString() !== "") {
                let groupToUse = []
                if (togglingGroup.toString() !== "") {
                    groupToUse = togglingGroup;
                } else {
                    groupToUse = toggling_group;
                }
                if (layer.name === "selections") {
                    //remove the box annotation from the view.
                    layer.annotations = [];
                }
                //console.log(groupToUse.toString())
                for (let i = 0; i < groupToUse.length; i++) {
                    let segm = groupToUse[i];
                    //console.log(segm)
                    let layerName = this.idNameMap.get(segm);
                    if (layer.type === "segmentation" && layer.name.split("_")[0] === layerName) {
                        if (layer["archived"]) {
                            layer["archived"] = true;
                            //if it was archived, this has not been selected before, so we delete all the segments and only toggle the desired ones.
                            layer["segments"] = [];

                            //TODO: discuss what to do if it is already visible - do we remove the segments around the selected area?
                        }
                        if (layer["segments"]) {
                            if (layer["segments"].indexOf(segm) < 0) {
                                layer["segments"].push(segm);
                            }
                        } else {
                            layer["segments"] = [segm]
                        }
                    }
                }
            }
            if (highlightSegment !== null) {
                let layerName = this.idNameMap.get(highlightSegment.id);
                if (layer.type == "segmentation" && layer.name.split("_")[0] == layerName) {
                    layer["segmentColors"][highlightSegment.id] = highlightSegment.color == layer["segmentColors"][highlightSegment.id] ? layer["segmentDefaultColor"] : highlightSegment.color;

                }
                if (layer.type == "annotation" && layer.name == layerName) {

                    for (const annotation of layer.annotations) {
                        //layer["segmentColors"][annotation["id"]] = this.colorStorage[annotation["id"]][this.currColorBy];
                        if (annotation.id === highlightSegment.id) {
                            annotation["props"][this.imp_colortracker.getCurrColorBy()] = highlightSegment.color;
                        }

                    }
                }
            }
        }

        let result2 = {
            "dimensions": this.firstRun ? this.dimensions : result["dimensions"],
            "position": this.firstRun ? this.position : result["position"],
            "crossSectionScale": result["crossSectionScale"],
            "projectionOrientation": result["projectionOrientation"],
            "projectionScale": result["projectionScale"],
            "layers": layer_res,
            "selectedLayer": selectionMode ? {
                "visible": true,
                "layer": "selections"
            } : result["selectedLayer"],
            "layout": {
                "type": result["layout"]["type"] ? result["layout"]["type"] : "4panel" /*, "crossSections": {
                    "a": {
                        "width": 1000,
                        "height": 1500
                    }
                }*/
            },
            "partialViewport": result["partialViewport"],
            "layerListPanel": this.firstRun ? {
                "visible": true
            }
                : result["layerListPanel"],
            "showSlices": result["showSlices"]
        }

        this.firstRun = false;
        this.state.reset()
        //this.state.set(result2)
        // this.state.layers = result2.layers;
        this.state.restoreState(result2)

        this.makeColourBoxes();


    }


    public isSegmentVisible(id: string) {
        return this.visibleSegments.indexOf(id) > -1;
    }

    public updateColormap(cmap_id: string) {
        //console.log(cmap_id);
        this.imp_colortracker.setCurrColorMap(cmap_id);
        this.makeStateJSON(false, "", false, true);
    }


    private getMeshIDFromElement() {
        const allActiveLayers = document.getElementsByClassName('neuroglancer-layer-item-value');
        for (let i = 0; i < allActiveLayers.length; i++) {
            if (allActiveLayers[i].textContent!.indexOf("#") < 0 && allActiveLayers[i].textContent!.indexOf(".") < 0 && allActiveLayers[i].textContent! !== "") {
                //mesh was double clicked
                //make colour picker
                return (allActiveLayers[i].textContent);
            }
        }
        return null;
    }
    public doClickReaction(clickType: string, mouseX: number, mouseY: number) {
        //doClickReactions are called in mouse_bindings.ts as reactions on click. that is where default reactions can be disabled as well.
        switch (clickType) {
            case 'dblClick':
                //console.log("dblClick");
                //mesh was double clicked
                //make colour picker
                let id = this.getMeshIDFromElement();
                if (id == null) {
                    return;
                }
       
                this.changeSegmentColor(id!);
            


        }
    }

    public getColormapKeys() {
        return this.imp_colortracker.getColorMapKeys();
    }
    public makeColourBoxes() {
        console.log("colourbox")
        /*.neuroglancer-layer-list-panel-item[data-archived=false]*/
        let elements = document.getElementsByClassName("neuroglancer-layer-side-panel-name") as HTMLCollection;
        //console.log(elements)
        //console.log(this.nameColorMap)
        for (var i = 0; i < elements.length; i++) {
            var div = elements[i] as HTMLInputElement
  
            let name = div.value;

            if (name.indexOf("mesh") > 0) {
                name = name.split("_")[0]
            }
            const colorName = this.imp_colortracker.getColorName(name);
            const parentElement = div.parentElement!;
            const inputNodes = parentElement.getElementsByTagName('input');
            let checkBEl;
            for(let i = 0; i < inputNodes.length; i++){
                if(inputNodes[i].type == "checkbox"){
                    checkBEl = inputNodes[i] as HTMLInputElement;
                    break;
                }
            }
            if (colorName !== undefined) {
                if(checkBEl && checkBEl.checked){
                    div.parentElement!.setAttribute("style", "background: " + colorName + " !important")
                } else {
                    div.parentElement!.setAttribute("style", "background: white !important")
                }
            } 
            //element.style.background = // element.innerHTML + "<div className='colorSquare' style='background:"+ this.nameColorMap.get(element.innerHTML)+";' />";
        }
    }
    public toggleSegmentFromSegments(id: string) {
        if (this.visibleSegments.indexOf(id) > -1) {
            this.visibleSegments.splice(this.visibleSegments.indexOf(id), this.visibleSegments.indexOf(id) + 1);
        } else {
            this.visibleSegments.push(id);
        }
        // console.log(this.visibleSegments)
    }

    public setSegmentationDisplayState(displayState: SegmentationDisplayState) {
       // console.log(displayState);
        this.displayState = displayState;

    }
    public toggleSegment(idString: string) {
        //console.log(id);
        const tempStatedColor = new Uint64();
        const id = tempStatedColor;
        id.tryParseString(idString);

        const { visibleSegments } = this.displayState.segmentationGroupState.value;
        visibleSegments.set(id, !visibleSegments.has(id));

        //console.log(this.visibleSegments)
        //this.makeStateJSON(false, id)
    }

    //double click a segment, take its color and save it for the next double click.
    public changeSegmentColor( id: string) {
        console.log("Changing color of " + id)
        var tinycolor = require("tinycolor2");
        

        let newColor = tinycolor(this.imp_colortracker.getColorForId(id)).brighten(40).toString();
        this.makeStateJSON(false, "", { "color": newColor, "id": id })
        this.imp_colortracker.setHighlightedList(id);
        
      

    }
    public updateAttribute(value: number) {
        this.imp_colortracker.setCurrColorBy(value)
        this.makeStateJSON(true);
    }
    public reset() {
        this.availableLayers = {}
        if (this.state) {
            this.state.reset();
        }
        this.firstRun = true;
        this.showsLicense = false;
        this.idNameMap = new Map<string, string>();
        this.imp_colortracker.reset();

    }

    public setState(state: any) {
        this.state = state;
    }

    public hasLicense() {
        return this.showsLicense;
    }
    public setLicense(license: boolean) {
        this.showsLicense = license;
    }


    public toggleGroupingMode() {
        this.isGroupingMode = !this.isGroupingMode;
        console.log("Grouping mode : " + this.isGroupingMode)
        if (!this.isGroupingMode && this.currGroup.length > 0) {
            //build an annotation layer with the selected ids

            let annotArr: any[] = [];
            for (let i = 0; i < this.currGroup.length; i++) {
                let annot = {
                    "point": this.idPositionMap.get(this.currGroup[i]),
                    "type": "point",
                    "id": this.currGroup[i],
                    "description": this.currGroup[i] + " - " + this.idNameMap.get(this.currGroup[i]),
                    "props": this.imp_colortracker.getPropsFromStorage(this.currGroup[i])
                };

                annotArr.push(annot);
            }

            this.layerToBeAdded = {
                "type": "annotation",
                "imp_type": "group",
                "source": "local://annotations",
                "tab": "annotations",
                "annotationProperties": [{
                    "id": "color",
                    "type": "rgb",
                    "default": "#ff0000"
                },
                {
                    "id": "cc",
                    "type": "rgb",
                    "default": "#ffff00"
                }],
                "shader": this.annotationShaderString,
                "name": "Group",
                "visible": true,
                "annotations": annotArr
            };
            this.makeStateJSON(true, "", null, false, [], false);
            this.layerToBeAdded = null;
            this.currGroup = [];
        }
    }

    public getColorForId(id: string) {
        return this.imp_colortracker.getColorForId(id);
    }
    public tryAddToGroup() {
        let id = this.getMeshIDFromElement();
        if (id === null) {
            return;
        }
        if (this.currGroup.indexOf(id) >= 0) {
            this.currGroup.splice(this.currGroup.indexOf(id), 1)
        } else if (id.length > 1) {
            this.currGroup.push(id);
        }
        console.log(this.currGroup);
    }
    public isGrouping() {
        return this.isGroupingMode;
    }
    //   public addDrawing(axis: string) {
    /*   console.log("adding drawing on axis: " + axis);
       console.log("Dim Value: ");
       let dimVal = "";
       let els = document.getElementsByClassName("neuroglancer-position-dimension-coordinate");
       let el;
       let map;
       switch (axis) {
           case "xy":
               el = els[2] as HTMLInputElement;
               map = this.zDrawings;
               break;
           case "xz":
               el = els[1] as HTMLInputElement;
               map = this.yDrawings;
               break;
           case "yz":
               el = els[0] as HTMLInputElement;
               map = this.xDrawings;
               break;
           default:
               el = null;
               map = null;
               console.log(axis + " not valid. ")
       }
       if (el !== null) {
           dimVal = el.value.toString();
       } else {
           return;
       }
       if (map !== null) {
           if (map.has(dimVal)) {
               map.get(dimVal)!.show();
           } else {
               let drawing = new Drawing(document.getElementsByTagName("canvas")[0], document.getElementById(axis)!, axis, dimVal);
               map.set(dimVal, drawing);
           }
       }
 
       console.log(map)*/
    //  }
}
