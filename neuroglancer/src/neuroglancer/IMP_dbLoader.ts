import { getCachedJson } from "./util/trackable";

//class that manages IMP database interaction
export class IMP_dbLoader {

    private static instance: IMP_dbLoader;
    private default_DB_url = 'https://webdev.imp-db.cloud.edu.au:3005/tomosets/';
    private currDataset: any;
    private user_id: string;
    private constructor() {
        //this.default_DB_url = 
    }

    public static getInstance(): IMP_dbLoader {
        if (!IMP_dbLoader.instance) {
            IMP_dbLoader.instance = new IMP_dbLoader();
        }

        return IMP_dbLoader.instance;
    }

    public setUserId(userID:string){
        this.user_id=userID;
    }
    public setDataset(dataset:any){
        this.currDataset=dataset;
    }
    async getDataset(url: string): Promise<any[]> {
        const axios = require('axios').default;

        axios.get(url).then((response: any) => {
            return response.data;
     
        })
            .catch((error: any) => {
                console.error(error);
                return [];

            })
        return [];
    }

     getSaveStates(): any{
        return Object.keys(this.currDataset["saveStates"])
    }

    loadSaveState(stateName: string){
        return this.currDataset["saveStates"][stateName];
    }

    //the state is already managed by neuroglancer. we just take a jsonified object of that state and pass it to the database. It will get stored by name within the same 
    //object as the dataset itself. 
    //with a proper database setup that someone has put some thought into, it is probably better to have the states in its own table identified by the id or name of the dataset

    async saveState(name:string, state:any, overwrite:boolean): Promise<string>{
  
        const axios = require('axios').default;
        axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*'
        
        let jsonState = JSON.parse(JSON.stringify( getCachedJson(state).value, null))
        if(this.currDataset["saveStates"]){
            if(!overwrite && this.currDataset["saveStates"][name]){
                //console.log("Save state of this name already exists. Tick overwrite if you want to overwrite, or pick a different name.")
                return("Save state of this name already exists. Tick overwrite if you want to overwrite, or pick a different name.");
            } else {
                this.currDataset["saveStates"][name]=jsonState
            }
        } else {
            this.currDataset["saveStates"] = {};
            this.currDataset["saveStates"][name] = jsonState
  
        }

        let response = await axios.put(this.default_DB_url + this.currDataset["name"], {"saveStates":this.currDataset["saveStates"]}, {headers: {
            "Content-Type": "application/json"}});
        return response.data;
    }

    async getEntriesInDatabase(): Promise<any> {
     
        const axios = require('axios').default;
        axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*'
        //console.log(this.default_DB_url)
        let response = await axios.get(this.default_DB_url);
       // console.log(response.data)
        return response;
    }



    async tryFetchByName(selected_name: string): Promise<any[]> {
        //console.log(selected_id)
        const axios = require('axios').default;
        axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*'
        let response = await axios.get(this.default_DB_url+"/getOne/"+selected_name);
        console.log(response.data)
        return response;
    }

    //provides complete URL to the dataset, used for local hosting
    async tryFetchByURL(url: string): Promise<any[]> {
        const axios = require('axios').default;
        axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*'
        console.log(url)
        let response = await axios.get(url);
        console.log(response.data)
        return response;
    }

}