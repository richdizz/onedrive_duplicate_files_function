# OneDrive Duplicate Files Function
This project contains an Azure Function that is triggered by EventGrid to process duplicate files on a users OneDrive. It only identifies duplicates and needs a separate process to resolve duplicates.

## Getting Started
Make a copy of the `local.settings.json.template` and rename to `local.settings.json`. You need to update the `CosmosConnectionString`, `CosmosDatabaseName`, and `CosmosCollectionName` settings with your CosmosDB details. Once set, you should deploy this to an Azure Function and connect it to a Azure Event Grid Topic. This can be debugged locally, but requires ngrok or a devtunnel. However, this repo is not setup to do this automatically in the .vscode tasks.