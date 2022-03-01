
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
    private state: any;
    //private stateJson: any;

    private availableLayers: AvailableLayers;

    private colorStorage: any;
    private firstRun: boolean;
    private position: number[];
    private dimensions: any[];

    private showsLicense: boolean;

    private nameColorMap: Map<string, string>;
    private idNameMap: Map<string, string>;
    private normalisedFields: Map<string, any>;
    private currColorMap = "";

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
        this.currColorMap = "jet";
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

            }
            if (!this.nameColorMap.has(layer['name'])) {
                this.nameColorMap.set(layer['name'], layer.annotations[0].props[0])
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
        }
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

    public setPosAndDim(position: any, dimensions: any) {
        this.position = position;
        this.dimensions = dimensions;
    }
    public makeStateJSON(colorByChanged: boolean = false, togglingSegment: string = "", highlightSegment: any = null, colorMapChanged: boolean = false) {
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
                archivedLayer["archived"] = true
                layer_res.push(archivedLayer)
            }
            let tempEntry = this.normalisedFields.entries().next().value;
            //console.log(tempEntry[1])
            for (let i = 0; i < Object.keys(tempEntry[1]).length; i++) {
                //console.log(Object.keys(tempEntry[1])[i])
                this.colorByStrings.push(Object.keys(tempEntry[1])[i]);
            }
        } else {
            layer_res = result.layers;
        }
        //match segment colours with annotation colours
        for (let layer of layer_res) {

            if (layer.type == "annotation") {
                layer["shaderControls"] = {
                    "colour_by": this.currColorBy
                }
            }
            if (colorByChanged || colorMapChanged) {

                if (layer.type == "segmentation") {
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
            if (togglingSegment !== "") {
                let layerName = this.idNameMap.get(togglingSegment);
                if (layer.type == "segmentation" && layer.name.split("_")[0] == layerName) {
                    if(layer["archived"]){
                        layer["segments"]=[togglingSegment];
                        layer["archived"]=false;
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

            if (highlightSegment !== null) {
                let layerName = this.idNameMap.get(highlightSegment.id);
                if (layer.type == "segmentation" && layer.name.split("_")[0] == layerName) {
                    layer["segmentColors"][highlightSegment.id] = highlightSegment.color == layer["segmentColors"][highlightSegment.id] ? layer["segmentDefaultColor"] : highlightSegment.color;

                }
                if(layer.type == "annotation" && layer.name == layerName){
                    
                    for (const annotation of layer.annotations) {
                        //layer["segmentColors"][annotation["id"]] = this.colorStorage[annotation["id"]][this.currColorBy];
                        if(annotation.id===highlightSegment.id){
                            annotation["props"][this.currColorBy] = highlightSegment.color;
                        }
                        
                        //function evaluate_cmap(x, name, reverse) {
                        //update annotation colour ball

                        
                    }
                }
            }
        }
        console.log(this.normalisedFields);
        //console.log(layer_res)
        //add new active layers to the state, remove others
        let result2 = {
            "dimensions": this.firstRun ? this.dimensions : result["dimensions"],
            "position": this.firstRun ? this.position : result["position"],
            "crossSectionScale": result["crossSectionScale"],
            "projectionOrientation": result["projectionOrientation"],
            "projectionScale": result["projectionScale"],
            "layers": layer_res,
            "selectedLayer": result["selectedLayer"],
            "layout": result["layout"],
            "partialViewport": result["partialViewport"],
            "layerListPanel": this.firstRun ? {
                "visible": true
            }
                : result["layerListPanel"],
            "showSlices": result["showSlices"]


        }
        this.firstRun = false;
        this.state.reset()
        this.state.restoreState(result2)
        this.makeColourBoxes();


    }

  
    public isSegmentVisible(id: string) {
        return this.visibleSegments.indexOf(id) > -1;
    }

    public updateColormap(cmap_id: string) {
        console.log(cmap_id);
        this.currColorMap = cmap_id;
        this.makeStateJSON(false, "", false, true);
    }

    public doClickReaction(clickType:string,event: MouseEvent){
        //doClickReactions are called in mouse_bindings.ts as reactions on click. that is where default reactions can be disabled as well.
        switch(clickType){
            case 'dblClick':
                console.log("dblClick");
                const allActiveLayers = document.getElementsByClassName('neuroglancer-layer-item-value');
                for(let i = 0; i < allActiveLayers.length; i++){
                    if(allActiveLayers[i].textContent!.indexOf("#")<0 && allActiveLayers[i].textContent!.indexOf(".")<0 && allActiveLayers[i].textContent! !==""){
                        //mesh was double clicked
                        //make colour picker
                        let id = allActiveLayers[i].textContent;
                        let colorpickerDiv = document.createElement('div');
                        colorpickerDiv.className = 'imp-color-picker-container';
                        
                        let colorpicker = document.createElement('input');
                        colorpicker.type = 'color';
                        console.log(event.pageX);
                        colorpickerDiv.setAttribute("style", "left:"+event.pageX+"px; top:"+event.pageY+"px;")//  style.left=event.pageX +'';
                        //colorpickerDiv.style.top = event.pageY + '';
                        colorpickerDiv.appendChild(colorpicker);
                        let closeButton = document.createElement('button');
                        closeButton.textContent="X";
                        closeButton.addEventListener("click", ()=> {
                            //console.log("...")
                            this.changeSegmentColor(colorpicker.value,id);
                            colorpickerDiv.textContent='';
                        })

                        colorpickerDiv.appendChild(closeButton);
                        document.getElementById("neuroglancer-container")!.appendChild(colorpickerDiv);
                        
                    }
      }
        }
    }

    public getColormapKeys(){
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
            if(this.nameColorMap.get(name)!==undefined){
            div.setAttribute("style", "background:" + this.nameColorMap.get(name))
            } else {
                div.setAttribute("style","color:#aaa");
                
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

        //console.log(this.visibleSegments)
        this.makeStateJSON(false, id)
    }

    public changeSegmentColor(color: string, id: string) {
        // console.log(color + " - " + id)
        this.makeStateJSON(false, "", { "color": color, "id": id })
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
}
