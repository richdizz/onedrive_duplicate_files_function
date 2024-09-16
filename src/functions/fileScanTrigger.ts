import { app, EventGridEvent, InvocationContext } from "@azure/functions";
import { Client, ClientOptions } from "@microsoft/microsoft-graph-client";
import CustomAuthProvider from "../util/customAuthProvider";
import Dictionary from "../entities/Dictionary";
import { CosmosClient } from "@azure/cosmos";
import File from "../entities/File";
import config from "../util/config";


export async function fileScanTrigger(event: EventGridEvent, context: InvocationContext): Promise<void> {
    context.log('Event grid function processed event:', event);
  
    // setup graph client...access token should be on the event.data.token from eventgrid
    let clientOptions: ClientOptions = {
      authProvider: new CustomAuthProvider(event.data.token as string),
    };
    const client = Client.initWithMiddleware(clientOptions);

    // setup connection to Cosmos
    const cosmosClient = new CosmosClient(config.cosmosConnectionString);
    
    // query root items
    let rootItems = await client.api("/me/drive/root/children").get();
    let files:Dictionary<File[]> = {};

    // recursively process entire drive
    await processLevel(rootItems.value, files, client, context, "/Documents/");
    context.log("Done processing files");

    // write scan results to CosmosDB
    const { database } = await cosmosClient.databases.createIfNotExists({ id: config.cosmosDatabaseName });
    const { container } = await database.containers.createIfNotExists({ id: config.cosmosCollectionName });
    
    // get the active scan from database
    const { resources: [item] } = await container.items
      .query({ query: "SELECT * from c WHERE c.id=@id", parameters: [{ name: "@id", value: (event.data.scanId as string) }] })
      .fetchAll();

    // look for duplicates
    let totalFiles = 0;
    let totalDups = 0;
    for (let key in files) {
      if (files[key].length > 1) {
        totalDups++;
        totalFiles += files[key].length;
        const parts = key.split("|");
        item.duplicates.push({
          fileName: parts[0],
          fileExt: parts[0].substring(parts[0].indexOf(".")),
          size: parseInt(parts[2]),
          locations: files[key],
          fileToKeep: true
        });
      }
    };

    // update the scan record
    item.status = "complete";
    await container.items.upsert(item);
}

async function processLevel(items:any[], files:Dictionary<File[]>, client:Client, context: InvocationContext, path:string) {
  // loop through all items at this level
  for (var i = 0; i < items.length; i++) {
    const item = items[i];

    context.log(`Processing OneDrive item ${item.name}`);
    if (item.file) {
      // create key that combines filename, hash, and size delimited by a pipe "|"
      const uniqueKey:string = `${item.name}|${item.file.hashes.quickXorHash}|${item.size}`

      // check if this is a new unique file or its a duplicate
      if (uniqueKey in files) {
        // key already exists, so push the duplicate in
        files[uniqueKey].push({path: `${path}${item.name}`, id: item.id, keep: true });
      }
      else {
        // this is a unique key
        files[uniqueKey] = [{path: `${path}${item.name}`, id: item.id, keep: true }];
      }
    }
    else if (item.folder) {
      // this is a folder, so we need to process the next level
      if (item.folder.childCount > 0) {
        // query the graph for items in folder and recurse
        let folderItems = await client.api(`/me/drive/items/${item.id}/children`).get();
        await processLevel(folderItems.value, files, client, context, `${path}${item.name}/`);
      }
    } 
  }
}

app.eventGrid('fileScanTrigger', {
    handler: fileScanTrigger
});
