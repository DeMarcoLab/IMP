import { SegmentationDisplayState } from "./segmentation_display_state/frontend";
import { SingleMeshLayer } from "./single_mesh/frontend";

export class ObjectTracker_IMP {
    private static instance: ObjectTracker_IMP;
    private layers: {
        type: string,
        name: string,
        source: string,
        tab: string,
        shader: string,
        annotations: { point: number[], type: "string", id: string, description: string, props: string[] }[],
        annotationProperties: { id: string, type: string, default: string }[],
        visible: boolean,
        segments: string[]
    }[];
    private visibleSegments: string[];
    //private annotArray: string[]
    private state: any;
    private stateJson: any;
    private myMesh: SingleMeshLayer;
    private mySegmentationDisplayState: SegmentationDisplayState
    /**
     * The Singleton's constructor should always be private to prevent direct
     * construction calls with the `new` operator.
     */
    private constructor() {
        this.layers = []
        this.visibleSegments=[]
    }

    /**
     * The static method that controls the access to the singleton instance.
     *
     * This implementation let you subclass the Singleton class while keeping
     * just one instance of each subclass around.
     */
    public static getInstance(): ObjectTracker_IMP {
        if (!ObjectTracker_IMP.instance) {
            ObjectTracker_IMP.instance = new ObjectTracker_IMP();
        }

        return ObjectTracker_IMP.instance;
    }

    private async makeStateJSON() {

        let result = {
            "dimensions": this.stateJson["dimensions"],
            "position": this.stateJson["position"],
            "crossSectionScale": this.stateJson["crossSectionScale"],
            "projectionOrientation": this.stateJson["projectionOrientation"],
            "projectionScale": this.stateJson["projectionScale"],
            "layers": this.layers,
            "selectedLayer": this.stateJson["selectedLayer"],
            "layout": this.stateJson["layout"],
            "partialViewport": this.stateJson["partialViewport"]

        }
        
        this.state.restoreState(result)
        //colour the annotations based on which segments are visible

        //first, colour all black based on className
        
    }

    public isSegmentVisible(id:string){
        return this.visibleSegments.indexOf(id)>-1;
    }
    public toggleSegment(name: string, id: string) {
        //first copy over the current state
        this.stateJson = this.state.toJSON();
        this.layers = this.stateJson["layers"]
        let layer = this.getLayer(name + "_mesh");
        if(this.visibleSegments.indexOf(id)>-1){
            this.visibleSegments.splice(this.visibleSegments.indexOf(id),this.visibleSegments.indexOf(id)+1);
        } else {
            this.visibleSegments.push(id);
        }
        if (layer !== null) {
            if (layer["segments"]) {
                let ind = layer["segments"].indexOf(id);
                if (ind > -1) {
                    //segment is currently visible, remove.
                    layer["segments"].splice(ind, ind+1)
                    this.setLayer(name + "_mesh", layer);
                    return false;
                    //layer["segments"] = lay
                } else {
                    layer["segments"].push(id)
                    this.setLayer(name + "_mesh", layer);
                    return true;
                }
            } else {
                layer["segments"] = [id];

                this.setLayer(name + "_mesh", layer);
                return true;
            }
  
        } else {
         
            console.log(name + "_mesh layer does not exist.")
            return false;
        }
    }

    private setLayer(name: string, layer: any) {
        for (let item of this.layers) {
            if (item["name"] === name) {
                item = layer;
            }
        }
        this.makeStateJSON();
    }


    private getLayer(name: string) {
        for (let item of this.layers) {
            if (item["name"] === name) {
                return item;
            }
        }
        return null;
    }
    public setState(state: any) {
        this.state = state;
    }
    public setStateJSON(js: any) {
        this.stateJson = js;
        this.layers = js["layers"]
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
    /**
     * Finally, any singleton should define some business logic, which can be
     * executed on its instance.
     */
    public setMesh(obj: SingleMeshLayer) {
        console.log("setting mesh.. ")
        console.log(obj)
        this.myMesh = obj;
    }

    public getMesh() {
        return this.myMesh;
    }

    public transformMesh(newtransform: any) {
        console.log(newtransform)
        //his.myMesh.transform = [1,0,0,10,0,1,0,5,0,0,1,4]
        this.myMesh.userLayer?.transformPickedValue([1, 0, 0, 10, 0, 1, 0, 5, 0, 0, 1, 4])


    }
}
