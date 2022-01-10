import { SegmentationDisplayState } from "./segmentation_display_state/frontend";
import { SingleMeshLayer } from "./single_mesh/frontend";


interface AvailableLayers {
    [key: string]: any
}
export class ObjectTracker_IMP {

   
    
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


    public setAnnotationColors(colourBy: string){

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

        //cases:
    
        //find active layers
        for(let key in this.availableLayers){ 
            if(this.availableLayers[key].active){
                found = false;
                for(let activeLayer of result["layers"]){
                    if(activeLayer.name === key){
                        //this layer is already in the current state, keep as is
                        this.availableLayers[key].layer.visible = activeLayer.visible;

                     
                        layer_res.push(this.availableLayers[key].layer) 
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
        

        //add new active layers to the state, remove others
        let result2= {
            "dimensions": this.stateJson["dimensions"],
            "position": this.stateJson["position"],
            "crossSectionScale": this.stateJson["crossSectionScale"],
            "projectionOrientation": this.stateJson["projectionOrientation"],
            "projectionScale": this.stateJson["projectionScale"],
            "layers": layer_res,
            "selectedLayer": this.stateJson["selectedLayer"],
            "layout": this.stateJson["layout"],
            "partialViewport": this.stateJson["partialViewport"]

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
        this.stateJson = this.state.toJSON();
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
                    layer["segmentColors"][id] = this.colorStorage[id][0]; //tODO change to whatever is active
                    this.setLayer(name + "_mesh", layer);
                    return true;
                }
            } else {
                layer["segments"] = [id];
                layer["segmentColors"] = {};
                layer["segmentColors"][id] = this.colorStorage[id][0];
                this.setLayer(name + "_mesh", layer);
                return true;
            }
  
        } else {
         
            console.log(name + "_mesh layer does not exist.")
            return false;
        }
    }

    private getAnnotationColor(name:string,bid:string){
        //finds the current colour of the annotation

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
    public setStateJSON(js: any) {
        this.stateJson = js;
       
    }
    public restoreState() {
        this.state.restoreState(this.stateJson)
    }
    public setSegmentationDisplayState(obj: SegmentationDisplayState) {
        this.mySegmentationDisplayState = obj;
        //console.log(obj)
    }
    public getSegmentationDisplayState() {
        return this.mySegmentationDisplayState;
    }

}
