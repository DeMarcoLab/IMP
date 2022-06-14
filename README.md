# IMP
Integrated Microscopy and Proteomics

This is a modified version of neuroglancer. 

## Installation
Clone repository. Go to the neuroglancer directory and run npm install

## Local server
npm run dev-server  (see package.json for more commands).

This will start a neuroglancer instance to use in your browser. Default url is http://127.0.0.1:8080 .
You can load any hosted neuroglancer compatbile dataset through the normal neuroglancer interface.

## Loading a "IMP"-compatible dataset
The dataset you want to load must:
-  be hosted and not just a local file. You can use a service such as nginx to host data. We provided a nginx config file in our preprocessing pipeline repository [https://github.com/DeMarcoLab/imp_preprocessing_pipelines](here.)
-  follow the expected format also described in the repository.

In the little menu at the top right, click local file and provide the url to the top folder of the files you want to load.

## Features
- colours in the layer menu match the colours of the data
- annotations and meshes for the same object are linked, and have the same colour. Clicking the dot annotation lets you display the mesh at that location
- select and change colourmap
- select parameter to colour by, if available
- select area in the vis in which meshes should be displayed
- group objects and add them to their own new layer

