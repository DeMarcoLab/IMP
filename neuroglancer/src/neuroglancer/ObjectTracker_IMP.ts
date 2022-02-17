

interface AvailableLayers {
    [key: string]: any
}
export class ObjectTracker_IMP {

    private currColourBy: number;
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
    private idNameMap: Map<string,string>;
    private constructor() {
        this.availableLayers = {};
        this.colorStorage = {};
        this.currColourBy = 0;
        this.firstRun = true;
        this.showsLicense = false;
        this.nameColorMap = new Map<string, string>();
        this.idNameMap = new Map<string,string>();
    }

  
    public static getInstance(): ObjectTracker_IMP {
        if (!ObjectTracker_IMP.instance) {
            ObjectTracker_IMP.instance = new ObjectTracker_IMP();
        }

        return ObjectTracker_IMP.instance;
    }

    public addIdName(id:string,name:string){
        this.idNameMap.set(id,name);
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
            }
            if(!this.nameColorMap.has(layer['name'])){
                this.nameColorMap.set(layer['name'],layer.annotations[0].props[0])
            }
        }
        //colour the segmentation the same as annotation.
        if (layer.type == "segmentation") {
            let annotLayer = this.availableLayers[layer.name.split("_")[0]]
            if (annotLayer) {

                layer["segmentColors"] = {}
                for (const annotation of annotLayer.layer.annotations) {
                    layer["segments"].push(annotation["id"]) //display all segments per default.
                    layer["segmentColors"][annotation["id"]] = this.colorStorage[annotation["id"]][this.currColourBy];
                }
            }
   //         console.log(layer)
        }
        this.availableLayers[layer.name] = { "layer": layer, "archived": archived }
        //  console.log(this.colorStorage)
    }



    public getLayers() {
        return this.availableLayers;
    }

    public setPosAndDim(position: any, dimensions: any) {
        this.position = position;
        this.dimensions = dimensions;
    }
    public makeStateJSON(colourByChanged: boolean = false, togglingSegment: string = "") {
        console.log(this.availableLayers)
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
        } else {
            layer_res = result.layers;
        }
        //match segment colours with annotation colours
        for (let layer of layer_res) {

            if (layer.type =="annotation") {
                layer["shaderControls"] = {
                    "colour_by": this.currColourBy
                }
            }
            if(colourByChanged){
                if (layer.type == "segmentation") {
                    let annotLayer = this.availableLayers[layer.name.split("_")[0]]
                    if (annotLayer) {
        
                        layer["segmentColors"] = {}
                        for (const annotation of annotLayer.layer.annotations) {
                            //  layer["segments"].push(annotation["id"])
        
                            layer["segmentColors"][annotation["id"]] = this.colorStorage[annotation["id"]][this.currColourBy];
                        }
                    }
                    //console.log(layer)
                }
            }
            if(togglingSegment!==""){
                let layerName = this.idNameMap.get(togglingSegment);
                if(layer.type =="segmentation" && layer.name.split("_")[0] == layerName){
                    if(layer["segments"]){
                        if(layer["segments"].indexOf(togglingSegment)>=0){
                            layer["segments"].splice(layer["segments"].indexOf(togglingSegment),1)
                        } else {
                            layer["segments"].push(togglingSegment);
                        }
                    } else {
                        layer["segments"]=[togglingSegment]
                    }
                    break;
                } 
            }
        }
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
            "layerListPanel":  this.firstRun ?  {
                "visible": true
              }
             : result["layerListPanel"]
            

        }
        this.firstRun = false;
        this.state.reset()
        this.state.restoreState(result2)

        

    }
    public isSegmentVisible(id: string) {
        return this.visibleSegments.indexOf(id) > -1;
    }

    public makeColourBoxes(){
     
        let elements = document.getElementsByClassName("neuroglancer-layer-item-label") as HTMLCollection;
        //console.log(elements)
        //console.log(this.nameColorMap)
        for(var i = 0; i < elements.length; i++){
            var div = elements[i]
            let name = div.innerHTML
            if(div.innerHTML.indexOf("mesh")>0){
                name = div.innerHTML.split("_")[0]
            }
            div.setAttribute("style","background:" + this.nameColorMap.get(name))
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
        this.makeStateJSON(false,id)
    }

    public updateAttribute(name:string,value:number, ev:any) {
        //finds the current colour of the annotation
        //0: by colour 1: by cc, 2: by test
        console.log(value)
        console.log(ev)
        console.log(name)
        this.currColourBy = value;
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
