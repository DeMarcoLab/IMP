import { cmapData, evaluate_cmap } from "./util/js-colormaps.js"; //small library that provides a list of well known colour maps

//class to manage colouring of meshes and annotations
export default class IMP_ColorTracker {
    private currColorBy: number;  //what are we colouring by (radio buttons at the top bar)
    private colorByStrings: string[]
    private nameColorMap: Map<string, string>;
    private colorStorage: any;
    private highlightedList: string[];
    private normalisedFields:    Map<string, any>;

    private currColorMap: string;
    public constructor(){
        this.colorStorage = {};
        this.currColorBy = 0;
        this.colorByStrings = [];
        this.colorByStrings.push('type');
        this.nameColorMap = new Map<string, string>();
        this.highlightedList = [];
        this.currColorMap = "jet";
        this.normalisedFields = new Map<string, any>();
    }

    public addNameColour(name: string, colour: string) {

        if (!this.nameColorMap.has(name)) {
            //console.log(id)
            //console.log(name)
            this.nameColorMap.set(name, colour)
        }
    }

    public deleteID(id:string){
        delete this.colorStorage[id];
        this.normalisedFields.delete(id);
    }
    public addColorToStorage(id:string,col:string){
        this.colorStorage[id]=col;
    }

    public addNameColorMapEntry(name:string,prop:string){
        if (!this.nameColorMap.has(name)) {
            this.nameColorMap.set(name, prop)
        }
    }

    public getColorFromID(id:string){
        return this.colorStorage[id][this.currColorBy];
    }

    public setCurrColorBy(col:number){
        console.log("Colour by is now: " + col)
        this.currColorBy = col;
    }
    public getCurrColorBy(){
        return this.currColorBy;
    }
    public setDefaultColorForLayerName(name:string,col:string){
        if (!this.nameColorMap.has(name)) {
            this.nameColorMap.set(name, col)
        }
    }

    public addNormalisedField(id:string, fields:any){
        this.normalisedFields.set(id, fields)
    }
    private ColorToHex(color: number) {
        var hexadecimal = color.toString(16);
        return hexadecimal.length == 1 ? "0" + hexadecimal : hexadecimal;
    }

    private ConvertRGBtoHex(rgb: number[]) {
        return "#" + this.ColorToHex(rgb[0]) + this.ColorToHex(rgb[1]) + this.ColorToHex(rgb[2]);
    }

    public initColorByStrings(){
        let tempEntry = this.normalisedFields.entries().next().value;
        //console.log(tempEntry[1])
        if (tempEntry) {
            for (let i = 0; i < Object.keys(tempEntry[1]).length; i++) {
                //console.log(Object.keys(tempEntry[1])[i])
                this.colorByStrings.push(Object.keys(tempEntry[1])[i]);
            }
        }
    }

    public colorSegment( id:string){
        if (this.currColorBy!==0) {

            let val = this.normalisedFields.get(id)[this.colorByStrings[this.currColorBy]]
            return this.ConvertRGBtoHex(evaluate_cmap(val, this.currColorMap, false));
        }
        return "";
    }

    public getHexVal(id:string){
        let val = this.normalisedFields.get(id)[this.colorByStrings[this.currColorBy]]
        return this.ConvertRGBtoHex(evaluate_cmap(val, this.currColorMap, false));
    }

    //getters and setters
    public setCurrColorMap(cmap:string){
        this.currColorMap=cmap;
    }
    public getColorMapKeys(){
        return Object.keys(cmapData);
    }
    public getColorName(name:string){
        return this.nameColorMap.get(name);
    }

    public getColorForId(id: string) {
        return this.colorStorage[id][this.currColorBy];
    }
    public getPropsFromStorage(id:string){
        return this.colorStorage[id];
    }
    public reset(){
        this.normalisedFields = new Map<string, any>();
        this.currColorMap = "jet";
    }

    public setHighlightedList(id:string){
        if(this.highlightedList.includes(id)){
            this.highlightedList.splice(this.highlightedList.indexOf(id),1);
        } else {
            this.highlightedList.push(id)
        }
    }
}