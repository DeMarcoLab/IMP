
//import { Position } from "./navigation_state.js";i

import IMP_ColorTracker from './IMP_ColorTracker'


//class to  initially initiate all the custom layers (passed in from makeUI in viewer)
// also manages "modes" of interaction that aren't from neuroglancer, like grouping meshes together in a new layer and drawing a box to display meshes within.

/*
Note: This class is old and while working on the project, 
I iteratively found out more about how to use Neuroglancer directly, rather than storing information in this class.
Some of the stuff in here could probably be rewritten more elegantly using the functionalities Neuroglancer provides. 
That would imply quite a bit of work though, so I went with "if it works don't touch it".

*/
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

    //maps segment/annotation IDs to the name of its own layer
    private idNameMap: Map<string, string>;
    //maps id of a segment/annotation to its own position
    private idPositionMap: Map<string, number[]>;

    private originalSegmentList: any;

    private areaModeOn: boolean;
    private drawingCoordinates: any[]

    private isDrawingMode: boolean;
    private isGroupingMode: boolean;
    private currGroup: string[];
    private layerToBeAdded: any;
    private annotationShaderString: string;
/*
    private xDimWidget: HTMLElement;
    private yDimWidget: HTMLElement;
    private zDimWidget: HTMLElement;
*/
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
        console.log(this.drawingCoordinates)
        if (this.drawingCoordinates[0].length === 0) {
            this.drawingCoordinates[0] = [position[0], position[1], position[2]];
        } else {
            this.drawingCoordinates[1] = [position[0], position[1], position[2]];
            this.showMeshesInBox();
            this.drawingCoordinates = [[], []];
            // this.areaModeOn = false;


        }
    }
/*
    tried to improve dimension widget position, failed because I could never pinpoint the exact moment when the dim widgets get loaded.
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

    */

    //user can download either the visible annotations ("dots") or meshes (function below this). It uses the saved initial particles csv the user provides to keep the format and
    //just delete entries that are currently not visible.
    public downloadVisibleAnnotations() {
        let currVisibleAnnotations: any[] = []

        const currLayers = this.state.toJSON().layers;
        for (let i = 0; i < currLayers.length; i++) {
            if (currLayers[i].type === "annotation") {
                currVisibleAnnotations = currVisibleAnnotations.concat(currLayers[i].annotations)
            }
        }
        let newPositionList: any = []
        for (let i = 0; i < currVisibleAnnotations.length; i++) {
            let annot = currVisibleAnnotations[i] as any;
            const pos = annot["point"];

            //match the position of each visible segment with the originalFile list. 
            if (pos !== undefined) {
                for (let j = 0; j < this.originalSegmentList.length; j++) {
                    const entry = this.originalSegmentList[j];
                    if (entry["x"] === (pos[0] + "") && entry["y"] === (pos[1] + "") && entry["z"] === (pos[2] + "")) {
                        newPositionList.push(entry)
                        continue;
                    }
                }
            }

        }
        this.downloadCSV(newPositionList)
    }
    //take list of active meshes and download it in the same format as initially provided
    public downloadActiveSegments() {
        let currVisibleSegments: string[] = []

        const currLayers = this.state.toJSON().layers;
        for (let i = 0; i < currLayers.length; i++) {
            if (currLayers[i].type === "segmentation") {
                currVisibleSegments = currVisibleSegments.concat(currLayers[i].segments)
            }
        }
       // console.log(currVisibleSegments)
        let newPositionList: any = []
        for (let i = 0; i < currVisibleSegments.length; i++) {
            const pos = this.idPositionMap.get(currVisibleSegments[i]);
            //match the position of each visible segment with the originalFile list. 
            if (pos !== undefined) {
                for (let j = 0; j < this.originalSegmentList.length; j++) {
                    const entry = this.originalSegmentList[j];
                    if (entry["x"] === (pos[0] + "") && entry["y"] === (pos[1] + "") && entry["z"] === (pos[2] + "")) {
                        newPositionList.push(entry)
                        continue;
                    }
                }
            }

        }
        this.downloadCSV(newPositionList)
    }

    //do the actual download of the csv (simulates a click on a download button)
    private downloadCSV(data:any){
         //console.log(this.originalSegmentList.length);
         let csvString = ""
         let header = Object.keys(data[0]).join(',');
         let values = data.map((o: { [s: string]: unknown; } | ArrayLike<unknown>) => Object.values(o).join(',')).join('\n');
 
         csvString += header + '\n' + values;
 
         var element = document.createElement('a');
         element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(csvString));
         element.setAttribute('download', "visible_particles.csv");
 
         element.style.display = 'none';
         document.body.appendChild(element);
 
         element.click(); //click to start the download of the file.
 
         document.body.removeChild(element);
    }


    //the user can draw a box using "drawing Mode" and the meshes within that box get displayed.
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
        //find elemens inside the bounding box.
        for (let [key, value] of this.idPositionMap.entries()) {
            if (value[0] >= minX && value[0] <= maxX && value[1] >= minY && value[1] <= maxY && value[2] >= minZ && value[2] <= maxZ) {
                //console.log(key);
                group.push(key)

            }
        }
        console.log(group.length);
        this.makeStateJSON(false, "", null, false, group);
    }

    //"singleton" 
    public static getInstance(): IMP_StateManager {
        if (!IMP_StateManager.instance) {
            IMP_StateManager.instance = new IMP_StateManager();
        }

        return IMP_StateManager.instance;
    }

    //saves the original csv data for particle postions as json, could be used later to download visible segments/annots
    public setOriginalSegmentList(original: any) {
        this.originalSegmentList = JSON.parse(original);
    }


    public addIdName(id: string, name: string) {
        this.idNameMap.set(id, name);

    }
    public addNameColour(name: string, colour: string) {
        this.imp_colortracker.addNameColour(name, colour)

    }

    //adds a layer
    public addLayer(layer: any, archived: boolean) {

        if (layer.type == "annotation") {
            for (const annotation of layer.annotations) {
                //save the annotation ID along with its colours (in props) and things it could be coloured by (in fields)
                this.imp_colortracker.addColorToStorage(annotation["id"], annotation["props"])
                this.imp_colortracker.addNormalisedField(annotation["id"], annotation["fields"])
                //save the position of this id
                this.idPositionMap.set(annotation["id"], annotation["point"]);
            }
            //save the layer name along with the first entry of props which is always "type" which is always present. 
            this.imp_colortracker.addNameColorMapEntry(layer['name'], layer.annotations[0].props[0])

            if (this.annotationShaderString === "") {
                this.annotationShaderString = layer.shader;
            }

        }
        //colour the segmentation the same as annotation.
        if (layer.type == "segmentation") {
            let annotLayer = this.availableLayers[layer.name.split("_")[0]]
            if (annotLayer) {
                //neuroglancer uses the fields "segments" and "segmentColors" to display individual segments. We therefore push all the segments into those fields and
                //set the colour to whatever the annotation of that ID is.
                //note, this blows up the size of the state quite a bit, and sharing neuroglancer URLs gets impossible due to the length of it.
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

    //this creates the new state with all the custom layers we created by calling "addLayer" for each layer that was passed to the app.
    //this will also get called if the colour by or the colourmap changes or other functions are used that affect the state of the layers (like adding a layer or changing one)
    public makeStateJSON(colorByChanged: boolean = false, togglingSegment: string = "", highlightSegment: any = null, colorMapChanged: boolean = false, togglingGroup: string[] = [], selectionMode: boolean = false) {
       // console.log("makeStateJSON")
        //create layers array:
        let result = this.state.toJSON() //copy current state
        let layer_res = []

      
        if (this.firstRun) {
            //copy the available layers over to the state.
            for (let key in this.availableLayers) {

                //the available layer is not yet in the state. add it to the layers.
                let archivedLayer = this.availableLayers[key].layer

                archivedLayer["archived"] = archivedLayer.type === "image" ? false : true;

                if (archivedLayer.type === "annotation") {
                    archivedLayer["annotation_relationships"] = [archivedLayer["name"] + "_mesh"];
                }
                //            console.log(archivedLayer)
                layer_res.push(archivedLayer)
            }

            this.imp_colortracker.initColorByStrings()

            //selection layer to display meshes within a drawn box "drawing mode"
            layer_res.push({
                "type": "annotation", "source": "local://annotations", "tab": "annotations", "name": "selections",
                "archived": false,
                "tool": "annotateBoundingBox",
            });
        } else {
            layer_res = result.layers; //if it's not the first run, we just take the layers of the state as they are.
        }
        //this layerToBeAdded is populated if a group was created
        if (this.layerToBeAdded !== null) {
            console.log(this.layerToBeAdded)
            layer_res.push(this.layerToBeAdded);
            //this.layerToBeAdded(null);
        }
        for (let layer of layer_res) {

            if (layer.type === "annotation") {
                layer["shaderControls"] = {
                    "colour_by": this.imp_colortracker.getCurrColorBy()
                }
            }

            //colours changed
            if (colorByChanged || colorMapChanged) {
                //update layers with currColorBy colour.
                if (layer.type === "segmentation") {
                    //console.log(layer)
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
               
                    }
                }

                if (layer.type == "annotation") {

                    if (this.imp_colortracker.getCurrColorBy() !== 0) {
                        for (const annotation of layer.annotations) {

                            let hexval = this.imp_colortracker.getHexVal(annotation["id"]);
                            annotation["props"][this.imp_colortracker.getCurrColorBy()] = hexval;
                        }
                    }
                }
            }
          /*  let toggling_group: string[] = [];
            if (layer.imp_type === "group") {
                for (let i = 0; i < layer.annotations.length; i++) {
                    /*let annot = {
                    "point": this.idPositionMap.get(this.currGroup[i]),
                    "type": "point",
                    "id": this.currGroup[i],
                    "description": this.currGroup[i],
                    "prop
                    toggling_group.push(layer.annotations[i].id);
                }
            }*/
            /* if (togglingSegment !== "") {
                 let layerName = this.idNameMap.get(togglingSegment);
                 if (layer.type === "segmentation" && layer.name.split("_")[0] === layerName) {
 
                         if(layer["archived"]){
                             layer["segments"]=[togglingSegment];
                             layer["archived"]=false;
                         }
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
             }*/
            if (togglingGroup.toString() !== "" ) {
                let groupToUse  = togglingGroup;
                console.log(groupToUse.toString())
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
                            layer["archived"]=false; //unarchive the layer to make it visible
                            //if the layer was archived, it hasn't been selected before. per default, all segments would be visible. since this is part of the
                            //specific area selection, we empty the array here and fill it in the later steps with only the segments within the area.
                            layer["segments"] = [];

                        }
                        //put the segments in the list if it's not there yet
                        if (layer["segments"]) {
                            if (layer["segments"].indexOf(segm) < 0) {
                                layer["segments"].push(segm);
                            }
                        } else {
                            //create prop segments with new segm inside
                            layer["segments"] = [segm]
                        }
                    }
                }
            }

            //when double clicking a mesh, that mesh changes the colour to be "highlighted" (it becomes lighter from the basecolour, tinycolor library takes care of that)
            //double clicking again removes the highlighting and goes back to the colour before.
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

        //create the new state object
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
        //force the new state on the neuroglancer state object
        this.state.restoreState(result2)

        //sets the background colour of the layers displayed in the menu to be the same as the colour in the vis.
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


    public doClickReaction(clickType: string, id: string) {
        //doClickReactions are called in mouse_bindings.ts as reactions on click. that is where default reactions can be disabled as well.
        switch (clickType) {
            case 'dblClick':

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
            for (let i = 0; i < inputNodes.length; i++) {
                if (inputNodes[i].type == "checkbox") {
                    checkBEl = inputNodes[i] as HTMLInputElement;
                    break;
                }
            }
            if (colorName !== undefined) {
                if (checkBEl && checkBEl.checked) {
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

    //double click a segment, take its color and save it for the next double click.
    public changeSegmentColor(id: string) {
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
                    "point": this.idPositionMap.get(this.currGroup[i]), //draw position for this annotation
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
             /*   {
                    "id": "cc",
                    "type": "rgb",
                    "default": "#ffff00"
                }*/
                ],
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

    public deleteID(id: string) {
        //this annotation has already been deleted, now we also remove the segment data for it.
        this.imp_colortracker.deleteID(id);
        this.idPositionMap.delete(id);

    }
    public getColorForId(id: string) {
        return this.imp_colortracker.getColorForId(id);
    }
    public tryAddToGroup(id: string) {

        if (this.currGroup.indexOf(id) >= 0) {
            this.currGroup.splice(this.currGroup.indexOf(id), 1)
        } else if (id.length > 1) {
            this.currGroup.push(id);
        }
       // console.log(this.currGroup);
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
