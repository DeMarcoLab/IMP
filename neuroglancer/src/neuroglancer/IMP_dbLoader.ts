export class IMP_dbLoader {

    private static instance: IMP_dbLoader;
    private default_DB_url = 'https://webdev.imp-db.cloud.edu.au:3005/tomosets/';
    private constructor() {
        //this.default_DB_url = 
    }

    public static getInstance(): IMP_dbLoader {
        if (!IMP_dbLoader.instance) {
            IMP_dbLoader.instance = new IMP_dbLoader();
        }

        return IMP_dbLoader.instance;
    }

    async getDataset(url: string): Promise<any[]> {
        const axios = require('axios').default;
        //const url: string = 'https://webdev.imp-db.cloud.edu.au:3005/tomosets/' + selected_name;
        //let self = this
        axios.get(url).then((response: any) => {
            return response.data;
            //self.loadDBsetIntoNeuroglancer(response.data)
        })
            .catch((error: any) => {
                console.error(error);
                return [];

            })
        return [];
    }
    async getEntriesInDatabase(): Promise<any> {
     
        const axios = require('axios').default;
        axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*'
        console.log(this.default_DB_url)
        let response = await axios.get(this.default_DB_url);
        console.log(response.data)
        return response;
    }



    async tryFetchByName(selected_name: string): Promise<any[]> {
        //console.log(selected_id)
        const axios = require('axios').default;
        axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*'
        let response = await axios.get(this.default_DB_url+selected_name);
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