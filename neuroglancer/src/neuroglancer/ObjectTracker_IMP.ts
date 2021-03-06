
import { cmapData, evaluate_cmap } from "./util/js-colormaps.js";

interface AvailableLayers {
    [key: string]: any
}
export class ObjectTracker_IMP {
    
    private currColorBy: number;
    private colorByStrings: string[]
    private static instance: ObjectTracker_IMP;
    private visibleSegments: string[];
    //private annotArray: string[]

    //private stateJson: any;
    private state: any;
    private availableLayers: AvailableLayers;

    private colorStorage: any;
    private firstRun: boolean;
    private position: number[];
    private dimensions: any[];

    private showsLicense: boolean;

    private nameColorMap: Map<string, string>;
    private idNameMap: Map<string, string>;
    private idPositionMap: Map<string, number[]>;
    private normalisedFields: Map<string, any>;
    private currColorMap = "";

    private areaModeOn: boolean;
    private drawingCoordinates: any[]

    private isDrawingMode: boolean;
    private isGroupingMode: boolean;
    private currGroup: string[];
    private layerToBeAdded: any;
    private annotationShaderString: string;

 //  private segmentationDisplayState: SegmentationDisplayState;
    private lastColorId: any[];
    /*private xDrawings: Map<string, Drawing>;
    private yDrawings: Map<string, Drawing>;
    private zDrawings: Map<string, Drawing>;

    private currZDrawing: Drawing;
    private currYDrawing: Drawing;
    private currZDrawing:Drawing;

    private xCanvas: HTMLCanvasElement;
    private yCanvas: HTMLCanvasElement;
    private zCanvas: HTMLCanvasElement;*/
    private constructor() {
        this.availableLayers = {};
        this.colorStorage = {};
        this.currColorBy = 0;
        this.colorByStrings = [];
        this.colorByStrings.push('type');
        this.firstRun = true;
        this.showsLicense = false;
        this.nameColorMap = new Map<string, string>();
        this.idNameMap = new Map<string, string>();
        this.normalisedFields = new Map<string, any>();
        this.idPositionMap = new Map<string, number[]>();
        this.currColorMap = "jet";
        this.dimensions = [];
        this.areaModeOn = false;
        this.drawingCoordinates = [[], []];
        this.isDrawingMode = false;
        this.isGroupingMode = false;
        this.currGroup = [];
        this.layerToBeAdded = null;
        this.annotationShaderString= "";
        this.lastColorId = []
        /*  this.xDrawings = new Map<string, Drawing>();
          this.yDrawings = new Map<string, Drawing>();
          this.zDrawings = new Map<string, Drawing>();
  
          this.xCanvas = document.createElement("canvas");
          this.yCanvas = document.createElement("canvas");
          this.zCanvas = document.createElement("canvas");
          this.xCanvas.id = "yz_canv";
          this.yCanvas.id = "xz_canv";
          this.zCanvas.id = "xy_canv";
  
          this.xCanvas.style.pointerEvents = "none";
          this.yCanvas.style.pointerEvents = "none";
          this.zCanvas.style.pointerEvents = "none";
          document.getElementById("neuroglancer-container")?.appendChild(this.xCanvas);
          document.getElementById("neuroglancer-container")?.appendChild(this.yCanvas);
          document.getElementById("neuroglancer-container")?.appendChild(this.zCanvas);*/
    }

    /*private activateCanvas(dim: string){
       switch(dim){
           case "x":
               break;
            case "y":
                break;
            case "z":
                break;
            default:
       }
        
    }*/

  
  
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



    public updateScale() {
        let result = this.state.toJSON();
        console.log(result["crossSectionScale"]);
        let str = result["crossSectionScale"] + ""
        let num;
        num = str === "1" ? 9 : parseInt(str.charAt(2));
        console.log(num)

        console.log("New size: " + 1024 * (10 - (num % 2 === 0 ? num - 1 : num)))
        let newsize = 1024 * (10 - (num % 2 === 0 ? num - 1 : num))
        if (newsize === result["layout"]["crossSections"]["a"]["height"]) {
            console.log("no change")
            return;
        }
        result["layout"] = {
            "type": result["layout"]["type"],
            "crossSections": {
                "a":
                    { "height": newsize, "width": newsize },

                "b":
                    { "height": newsize, "width": newsize },

                "c":
                    { "height": newsize, "width": newsize }
            }
        }

        this.state.reset();
        this.state.restoreState(result);
    }
    private showMeshesInBox() {
        //console.log(this.drawingCoordinates);
        let group = []
        console.log(this.idPositionMap.size)
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
        console.log(group.length);
        this.makeStateJSON(false, "", null, false, group);
    }


    public static getInstance(): ObjectTracker_IMP {
        if (!ObjectTracker_IMP.instance) {
            ObjectTracker_IMP.instance = new ObjectTracker_IMP();
        }

        return ObjectTracker_IMP.instance;
    }

    public addIdName(id: string, name: string) {
        this.idNameMap.set(id, name);
   
    }
    public addNameColour(name: string, colour: string) {

        if (!this.nameColorMap.has(name)) {
            //console.log(id)
            //console.log(name)
            this.nameColorMap.set(name, colour)
        }
    }
    public addLayer(layer: any, archived: boolean) {

        if (layer.type == "annotation") {
            for (const annotation of layer.annotations) { //save the colours of this layer 
                //         console.log(annotation["props"])
                this.colorStorage[annotation["id"]] = annotation["props"];
                this.normalisedFields.set(annotation["id"], annotation["fields"])
                this.idPositionMap.set(annotation["id"], annotation["point"]);
            }
            if (!this.nameColorMap.has(layer['name'])) {
                this.nameColorMap.set(layer['name'], layer.annotations[0].props[0])
            }
            if(this.annotationShaderString===""){
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
                    layer["segmentColors"][annotation["id"]] = this.colorStorage[annotation["id"]][this.currColorBy];
                }
            }
            //         console.log(layer)
            if (!this.nameColorMap.has(layer['name'])) {
                this.nameColorMap.set(layer['name'], layer.segmentDefaultColor)
            }
        }
        //console.log(layer)
        this.availableLayers[layer.name] = { "layer": layer, "archived": archived }
        //  console.log(this.colorStorage)
    }

    private ColorToHex(color: number) {
        var hexadecimal = color.toString(16);
        return hexadecimal.length == 1 ? "0" + hexadecimal : hexadecimal;
    }

    private ConvertRGBtoHex(rgb: number[]) {
        return "#" + this.ColorToHex(rgb[0]) + this.ColorToHex(rgb[1]) + this.ColorToHex(rgb[2]);
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
                archivedLayer["archived"] = archivedLayer.type === "image" ? false : true

                if(archivedLayer.type==="annotation"){
                    archivedLayer["annotation_relationships"]=[archivedLayer["name"]+"_mesh"];
                   //archivedLayer["linked_segmentation_layer"]={archivedLayer.name+"_mesh": 'skeletons'};
                    //archivedLayer["filter_by_segmentation"]=[archivedLayer["name"]+"_mesh"];
                    //for(let l = 0; l < archivedLayer.annotations.length;l++){
                    //    archivedLayer.annotations[l]["segments"] = [[archivedLayer.annotations[l].id]]
                    //}
                }
    //            console.log(archivedLayer)
                layer_res.push(archivedLayer)
            }


            let tempEntry = this.normalisedFields.entries().next().value;
            //console.log(tempEntry[1])
            if (tempEntry) {
                for (let i = 0; i < Object.keys(tempEntry[1]).length; i++) {
                    //console.log(Object.keys(tempEntry[1])[i])
                    this.colorByStrings.push(Object.keys(tempEntry[1])[i]);
                }
            }
            //selection layer to display meshes within a drawn box.
            layer_res.push({
                "type": "annotation", "source": "local://annotations", "tab": "annotations", "name": "selections",
                "archived": false,
                "tool": "annotateBoundingBox",
            });
        } else {
            layer_res = result.layers;
        }
        if(this.layerToBeAdded !== null){
            layer_res.push(this.layerToBeAdded);
        }
        for (let layer of layer_res) {

            if (layer.type === "annotation") {
                layer["shaderControls"] = {
                    "colour_by": this.currColorBy
                }
            }
            if (colorByChanged || colorMapChanged) {

                if (layer.type === "segmentation") {
                    if(layer.hasAnnoConnection){
                    let annotLayer = this.availableLayers[layer.name.split("_")[0]]
                    if (annotLayer) {

                        layer["segmentColors"] = {}

                        for (const annotation of annotLayer.layer.annotations) {
                            //  layer["segments"].push(annotation["id"])
                            if (this.currColorBy !== 0) {
                                //layer["segmentColors"][annotation["id"]] = this.colorStorage[annotation["id"]][this.currColorBy];
                                let val = this.normalisedFields.get(annotation["id"])[this.colorByStrings[this.currColorBy]]
                                //function evaluate_cmap(x, name, reverse) {
                                //update annotation colour ball

                                //update segment colours
                                layer["segmentColors"][annotation["id"]] = this.ConvertRGBtoHex(evaluate_cmap(val, this.currColorMap, false));
                            } else {
                                layer["segmentColors"][annotation["id"]] = annotation["props"][0]
                            }
                        }

                    }
                }
                    //console.log(layer)
                }

                if (layer.type == "annotation") {

                    //  layer["segments"].push(annotation["id"])
                    if (this.currColorBy !== 0) {

                        for (const annotation of layer.annotations) {
                            //layer["segmentColors"][annotation["id"]] = this.colorStorage[annotation["id"]][this.currColorBy];
                            let val = this.normalisedFields.get(annotation["id"])[this.colorByStrings[this.currColorBy]]
                            //function evaluate_cmap(x, name, reverse) {
                            //update annotation colour ball

                            annotation["props"][this.currColorBy] = this.ConvertRGBtoHex(evaluate_cmap(val, this.currColorMap, false));
                        }
                    }

                }

            }
            let toggling_group: string[] = [];
            if(layer.imp_type ==="group"){
                //this is an annotation layer, and we always want to display all corresponding meshes.
                for(let i =0; i < layer.annotations.length; i++){
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
                        layer["archived"] = false;
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
            if (togglingGroup.toString() !== "" || toggling_group.toString()  !== "") {
                let  groupToUse = []
                if(togglingGroup.toString() !== "" ) {
                    groupToUse = togglingGroup;
                } else {
                    groupToUse = toggling_group;
                }
                if (layer.name === "selections") {
                    //remove the box annotation from the view.
                    layer.annotations = [];
                }
                console.log(groupToUse.toString())
                for (let i = 0; i < groupToUse.length; i++) {
                    let segm = groupToUse[i];
                    console.log(segm)
                    let layerName = this.idNameMap.get(segm);
                    if (layer.type === "segmentation" && layer.name.split("_")[0] === layerName) {
                        if (layer["archived"]) {
                            layer["archived"] = false;
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
                            annotation["props"][this.currColorBy] = highlightSegment.color;
                        }

                        //function evaluate_cmap(x, name, reverse) {
                        //update annotation colour ball


                    }
                }
            }

        }


    
        // console.log(this.normalisedFields);
        console.log(layer_res)
        //add new active layers to the state, remove others

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
                "type": result["layout"]["type"] ? result["layout"]["type"] : "4panel", "crossSections": {
                    "a": {
                        "width": 2048,
                        "height": 2048
                    }
                }
            },
            "partialViewport": result["partialViewport"],
            "layerListPanel": this.firstRun ? {
                "visible": true
            }
                : result["layerListPanel"],
            "showSlices": result["showSlices"]


        }

        this.firstRun = false;
        //try {
        this.state.reset()
        this.state.restoreState(result2)
        //  } finally {
        //    this.state.dispose();
        //  }

        this.makeColourBoxes();


    }


    public isSegmentVisible(id: string) {
        return this.visibleSegments.indexOf(id) > -1;
    }

    public updateColormap(cmap_id: string) {
        //console.log(cmap_id);
        this.currColorMap = cmap_id;
        this.makeStateJSON(false, "", false, true);
    }

   // public hoverSegment(id_in:string, goIn:boolean){

   // }
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
                let colorpickerDiv = document.createElement('div');
                colorpickerDiv.className = 'imp-color-picker-container';

                let colorpicker = document.createElement('input');
                colorpicker.type = 'color';
                //console.log(event.pageX);
                colorpickerDiv.setAttribute("style", "left:" + mouseX + "px; top:" + mouseY + "px;")//  style.left=event.pageX +'';
                //colorpickerDiv.style.top = event.pageY + '';
                colorpickerDiv.appendChild(colorpicker);
                let closeButton = document.createElement('button');
                closeButton.textContent = "X";
                closeButton.addEventListener("click", () => {
                    //console.log("...")
                    this.changeSegmentColor(colorpicker.value, id!);
                    colorpickerDiv.textContent = '';
                })

                colorpickerDiv.appendChild(closeButton);
                document.getElementById("neuroglancer-container")!.appendChild(colorpickerDiv);

        }
    }

    public getColormapKeys() {
        return Object.keys(cmapData);
    }
    public makeColourBoxes() {

        let elements = document.getElementsByClassName("neuroglancer-layer-item-label") as HTMLCollection;
        //console.log(elements)
        //console.log(this.nameColorMap)
        for (var i = 0; i < elements.length; i++) {
            var div = elements[i]
            let name = div.innerHTML
            if (div.innerHTML.indexOf("mesh") > 0) {
                name = div.innerHTML.split("_")[0]
            }
            if (this.nameColorMap.get(name) !== undefined) {
                div.parentElement!.setAttribute("style", "background:" + this.nameColorMap.get(name) + " !important")
            } else {
                div.setAttribute("style", "color:#aaa");

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
    public toggleSegment(id: string) {
        console.log(id);
        //console.log(this.visibleSegments)
        this.makeStateJSON(false, id)
    }

    public changeSegmentColor(color: string, id: string) {
        // console.log(color + " - " + id)
        var tinycolor = require("tinycolor2");
        if(color===this.lastColorId[0] && id === this.lastColorId[1]) return;
            
        if(color==="highlight"){
            let newColor = tinycolor(this.getColorForId(id)).brighten(20).toString();
            this.makeStateJSON(false, "", { "color": newColor, "id": id })
            this.lastColorId[0]=color;
            this.lastColorId[1]=id;
        } else {
            this.makeStateJSON(false, "", { "color": color, "id": id })
            this.lastColorId[0]=color;
            this.lastColorId[1]=id;
        }
       
    }
    public updateAttribute(value: number) {
        //finds the current colour of the annotation
        //0: by colour 1: by cc, 2: by test

        this.currColorBy = value;
        this.makeStateJSON(true);
    }
    public reset() {
        this.availableLayers = {}
        if (this.state) {
            this.state.reset();
        }
        this.colorStorage = {};
        this.currColorBy = 0;
        this.colorByStrings = [];
        this.colorByStrings.push('type');
        this.firstRun = true;
        this.showsLicense = false;
        this.nameColorMap = new Map<string, string>();
        this.idNameMap = new Map<string, string>();
        this.normalisedFields = new Map<string, any>();
        this.currColorMap = "jet";
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

   // public updateSlice(dim: string) {
        /*     let els = document.getElementsByClassName("neuroglancer-position-dimension-coordinate");
             let el;
             let map;
             let canvas;
             switch (dim) {
                 case "x":
                     el = els[0] as HTMLInputElement;
                     map = this.xDrawings;
                     canvas = this.xCanvas;
                     can
                     break;
                 case "y":
                     el = els[1] as HTMLInputElement;
                     map = this.yDrawings;
                     canvas = this.yCanvas;
                     break;
                 case "z":
                     el = els[2] as HTMLInputElement;
                     map = this.zDrawings;
                     break;
                 default:
                     el = null;
                     map = null;
                     canvas = this.zCanvas;
                     console.log(dim + " not valid. ")
             }
             if(map?.has(el!.value)){
                 console.log("We have a drawing at " + el!.value);
                 map.get(el!.value)?.show();
             }*/
  //  }

    public getColorForId(id:string){
        return this.colorStorage[id][this.currColorBy];
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
                    "props": this.colorStorage[this.currGroup[i]]
                };
                
                annotArr.push(annot);
            }

             this.layerToBeAdded= {
                "type": "annotation",
                "imp_type": "group",
                "source": "local://annotations",
                "tab": "annotations",
                "annotationProperties":     [  {
                    "id": "color",
                    "type": "rgb",
                    "default": "#ff0000"
                  },
                  {
                    "id": "cc",
                    "type": "rgb",
                    "default": "#ffff00"
                  }],
                "shader":this.annotationShaderString,
                "name": "Group",
                "visible": true,
                "annotations": annotArr
            };
            this.makeStateJSON(true,"",null,false,[],false);
            this.layerToBeAdded = null;
            this.currGroup = [];
        }
    }

    public tryAddToGroup() {
        let id = this.getMeshIDFromElement();
        if(id===null){
            return;
        }
        if (this.currGroup.indexOf(id) >= 0) {
            this.currGroup.splice(this.currGroup.indexOf(id), 1)
        } else if(id.length>1) {
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
