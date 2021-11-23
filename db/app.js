const {MongoClient} = require('mongodb');

// ref 
// https://www.mongodb.com/blog/post/quick-start-nodejs-mongodb-how-to-get-connected-to-your-database
// https://www.mongodb.com/developer/quickstart/node-crud-tutorial/

console.log("Hello DB App");


async function main() {

    const uri = "mongodb://localhost:27017/"
    const client = new MongoClient(uri);
    try {
        await client.connect();
    
        await listDatabases(client);

        await readDatabase(client);
     
    } catch (e) {
        console.error(e);
    }

    finally {
        await client.close();
    }
}

main().catch(console.error);

async function listDatabases(client){
    databasesList = await client.db().admin().listDatabases();
 
    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
};


async function readDatabase(client) {
    const cursor = await client.db("bio_db").collection("user").find({});
    const result = await cursor.toArray();

    if (result.length > 0){
        
        result.forEach((result, i) => {
            console.log(result);
        })
        // console.log(result);

    }
}