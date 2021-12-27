import { SegmentationDisplayState } from "./segmentation_display_state/frontend";
import { SingleMeshLayer } from "./single_mesh/frontend";

export class ObjectTracker_IMP {
    private static instance: ObjectTracker_IMP;

    private myMesh: SingleMeshLayer;
    private mySegmentationDisplayState: SegmentationDisplayState
    /**
     * The Singleton's constructor should always be private to prevent direct
     * construction calls with the `new` operator.
     */
    private constructor() { }

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

    public setSegmentationDisplayState(obj:SegmentationDisplayState){
        this.mySegmentationDisplayState = obj;
        console.log(obj)
    }
    public getSegmentationDisplayState(){
        return this.mySegmentationDisplayState;
    }
    /**
     * Finally, any singleton should define some business logic, which can be
     * executed on its instance.
     */
    public setMesh(obj:SingleMeshLayer){
        console.log("setting mesh.. ")
        console.log(obj)
        this.myMesh=obj;
    }

    public getMesh(){
        return this.myMesh;
    }

    public transformMesh( newtransform: any) {
            console.log(newtransform)
        //his.myMesh.transform = [1,0,0,10,0,1,0,5,0,0,1,4]
        this.myMesh.userLayer?.transformPickedValue([1,0,0,10,0,1,0,5,0,0,1,4])
        

    }
}
