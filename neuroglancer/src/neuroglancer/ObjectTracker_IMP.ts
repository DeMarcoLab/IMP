import { SegmentationDisplayState } from "./segmentation_display_state/frontend";
import { SingleMeshLayer } from "./single_mesh/frontend";


interface AvailableLayers {
    [key: string]: any
}
export class ObjectTracker_IMP {

    private activeLayerName: string;
    private currColourBy: number;
    private static instance: ObjectTracker_IMP;
    private visibleSegments: string[];
    //private annotArray: string[]
    private state: any;
    private stateJson: any;
    
    private availableLayers: AvailableLayers;
    private mySegmentationDisplayState: SegmentationDisplayState;

    private colorStorage: any;
   
    private constructor() {
        this.visibleSegments=[];
        this.availableLayers = {};
        this.colorStorage= {};
        this.activeLayerName="Ribosome";//TODO 
        this.currColourBy=0;
    }

    public static getInstance(): ObjectTracker_IMP {
        if (!ObjectTracker_IMP.instance) {
            ObjectTracker_IMP.instance = new ObjectTracker_IMP();
        }

        return ObjectTracker_IMP.instance;
    }

    public addLayer(layer:any, active:boolean){
        //console.log(layer.annotations)
        this.availableLayers[layer.name] = {"layer":layer,"active":active}
       // console.log(layer)
       if(layer.type=="annotation"){
        for(const annotation of layer.annotations) {
            this.colorStorage[annotation["id"]]=annotation["props"];
        }
    }
    }

    public toggleLayer(name:string){
        this.availableLayers[name].active =  !this.availableLayers[name].active;
        this.makeStateJSON()
    }

    public getLayers(){
        return this.availableLayers;
    }
    public makeStateJSON() {

        //create layers array:
        let result = this.state.toJSON() //copy current state
        let layer_res = []
        let found = false;

        //find active layers
        for(let key in this.availableLayers){ 
            if(this.availableLayers[key].active){
                found = false;
                for(let activeLayer of result["layers"]){
                    if(activeLayer.name === key){
                        //this layer is already in the current state, keep as is
                        this.availableLayers[key].layer.visible = activeLayer.visible;
                        if(this.availableLayers[key].layer["segments"]){
                            activeLayer["segments"] = this.availableLayers[key].layer["segments"];
                            activeLayer["segmentColors"] =this.availableLayers[key].layer["segmentColors"]
                        }
  
                        layer_res.push(activeLayer) 
                        found = true;

                        //set colour
                       
                    }
                }
                if(!found){
                    //the available layer is not yet in the state. add it to the layers.
                    layer_res.push(this.availableLayers[key].layer)
                }
            }
        }
        
        //match segment colours with annotation colours
        for(let layer of layer_res){
            if(layer.name===this.activeLayerName+"_mesh"){
                if(layer["segments"]){
                    if(layer["segmentColors"]){
                        for(let key in layer["segmentColors"]){
                            layer["segmentColors"][key] = this.colorStorage[key][this.currColourBy];
                        }
                    } else {
                        layer["segmentColors"]={};
                        for(let col in layer["segments"]){
                            layer["segmentColors"][col]=this.colorStorage[col][this.currColourBy];
                        }
                    }
                }
            }
            if(layer.name===this.activeLayerName){
                layer["shaderControls"] = {
                    "colour_by": this.currColourBy
                }
            }
        }

        //add new active layers to the state, remove others
        let result2= {
            "dimensions": result["dimensions"],
            "position": result["position"],
            "crossSectionScale": result["crossSectionScale"],
            "projectionOrientation": result["projectionOrientation"],
            "projectionScale": result["projectionScale"],
            "layers": layer_res,
            "selectedLayer":  {
                "layer": this.activeLayerName,
                "visible": true
              },
            "layout": result["layout"],
            "partialViewport": result["partialViewport"]

        }
        this.state.reset()
        this.state.restoreState(result2)
    }
    public isSegmentVisible(id:string){
        return this.visibleSegments.indexOf(id)>-1;
    }
    public toggleSegmentFromSegments(id:string){
        if(this.visibleSegments.indexOf(id)>-1){
            this.visibleSegments.splice(this.visibleSegments.indexOf(id),this.visibleSegments.indexOf(id)+1);
        } else {
            this.visibleSegments.push(id);
        }
       // console.log(this.visibleSegments)
    }
    public toggleSegment(name: string, id: string) {
        //first copy over the current state
        let layer = this.getLayer(name + "_mesh");
        if(this.visibleSegments.indexOf(id)>-1){
            this.visibleSegments.splice(this.visibleSegments.indexOf(id),this.visibleSegments.indexOf(id)+1);
        } else {
            this.visibleSegments.push(id);
        }
        //console.log(this.visibleSegments)
        if (layer !== null) {
            if (layer["segments"]) {
                let ind = layer["segments"].indexOf(id);
                if (ind > -1) {
                    //segment is currently visible, remove.
                    layer["segments"].splice(ind, ind+1);
                    delete layer["segmentColors"][id];
                    this.setLayer(name + "_mesh", layer);
                    return false;
                    //layer["segments"] = lay
                } else {
                    layer["segments"].push(id)
                    layer["segmentColors"][id] = this.colorStorage[id][this.currColourBy]; //tODO change to whatever is active
                    this.setLayer(name + "_mesh", layer);
                    return true;
                }
            } else {
                layer["segments"] = [id];
                layer["segmentColors"] = {};
                layer["segmentColors"][id] = this.colorStorage[id][this.currColourBy];
                this.setLayer(name + "_mesh", layer);
                return true;
            }
  
        } else {
         
            console.log(name + "_mesh layer does not exist.")
            return false;
        }
    }

    public updateAttribute(val:number){
        //finds the current colour of the annotation
        //0: by colour 1: by cc, 2: by test
        this.currColourBy=val;
        this.makeStateJSON();
    }
    public reset(){
        this.availableLayers={}
        if(this.state){
            this.state.reset();
        }
    }
    private setLayer(name: string, layer: any) {
  
        this.availableLayers[name].layer = layer;
        this.makeStateJSON();
    }

    private getLayer(name: string) {
        return this.availableLayers[name].layer
    }
    public setState(state: any) {
        this.state = state;
    }
 
    public setSegmentationDisplayState(obj: SegmentationDisplayState) {
        this.mySegmentationDisplayState = obj;
        //console.log(obj)
    }
    public getSegmentationDisplayState() {
        return this.mySegmentationDisplayState;
    }

}
