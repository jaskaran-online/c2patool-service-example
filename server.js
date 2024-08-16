/**
 * Copyright 2023 Adobe
 * All Rights Reserved.
 *
 * NOTICE: Adobe permits you to use, modify, and distribute this file in
 * accordance with the terms of the Adobe license agreement accompanying
 * it.
 */

const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const fs = require('fs');
const fsPromises = fs.promises;
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const _ = require('lodash');
const util = require('util');
const child = require('child_process')
let exec = util.promisify(child.exec);

const port = process.env.PORT || 8000;

const app = express();

console.log('Initializing server...');

// serve our web client
app.use(express.static('client'));

// Allow urls from the uploads folder to be served
let imageFolder = 'uploads'
app.use(express.static(imageFolder));

// Create a local folder to hold images in this example.
if(!fs.existsSync(imageFolder)){
  console.log(`Creating image folder: ${imageFolder}`);
  fs.mkdirSync(imageFolder)
}

// Enable files upload.
app.use(fileUpload({
  createParentPath: true,
  limits: { 
      fileSize: 2 * 1024 * 1024 * 1024 // max upload file(s) size
  },
}));

console.log('Configuring middleware...');

// Increase the limit for JSON and URL-encoded bodies
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Increase the limit for raw bodies
app.use(bodyParser.raw({ type: "image/*", limit: '50mb', extended: true }));

// Add other middleware.
app.use(cors());
app.use(morgan('dev'));

console.log('Setting up routes...');

// Runs c2patool to get version info using exec
app.get('/version', async function (req, res) {
  console.log('Received request for c2patool version');
  try {
    let result = await exec('c2patool --version');
    console.log('c2patool version:', result.stdout);
    res.send(result.stdout);
  } catch (err) {
    console.error('Error getting c2patool version:', err);
    res.status(500).send(err);
  }
});

// Uploads a file, adds a C2PA manifest and returns a URL
app.post('/upload', async (req, res) => { 
  console.log('Received file upload request');
  try {
    let fileName = req.query.name;
    let filePath = `${imageFolder}/${fileName}`;
    console.log(`Processing file: ${fileName}`);

    // Get custom data from the request body
    const { name, countryName, countryCode, mobileNumber } = req.body;

    // Create a custom manifest JSON
    // const customManifest = JSON.stringify({
    //   "ta_url": "http://timestamp.digicert.com",
    //   "claim_generator": "CAI_Demo/0.1",
    //   "assertions": [
    //     {
    //       "label": "c2pa.actions",
    //       "data": {
    //         "actions": [
    //           {
    //             "name": name,
    //             "countryName": countryName,
    //             "countryCode": countryCode,
    //             "phone": mobileNumber,
    //             "action": "c2pa.published"
    //           }
    //         ]
    //       }
    //     }
    //   ]
    // });

    const customManifest = JSON.stringify({
      "ta_url": "http://timestamp.digicert.com",
      "claim_generator": "CAI_Demo/0.1",
      "assertions": [
          {
              "label": "c2pa.actions",
              "data": {
                  "actions": [
                      {
                          "action": "c2pa.published"
                      }
                  ]
              }
          },
          {
              "label": "personal.info",
              "data": {
                  "name": name,
                  "countryName": countryName,
                  "countryCode": countryCode,
                  "phone": mobileNumber,
                  "action": "c2pa.published"
              }
          }
      ]
  });



    console.log('Created custom manifest:', customManifest);

    // Write the custom manifest to a temporary file
    const tempManifestPath = path.join(__dirname, 'temp_manifest.json');
    await fsPromises.writeFile(tempManifestPath, customManifest);
    console.log(`Temporary manifest file created: ${tempManifestPath}`);

    // upload the file
    await fsPromises.appendFile(filePath, Buffer.from(req.body.file), { flag: 'w' });
    console.log(`File uploaded to: ${filePath}`);

    // call c2patool to add a manifest using the temporary custom manifest file
    let command = `c2patool "${filePath}" -m "${tempManifestPath}" -o "${filePath}" -f`;
    console.log(`Executing command: ${command}`);
    let result = await exec(command);
    console.log('c2patool execution completed');

    // Clean up the temporary manifest file
    // await fsPromises.unlink(tempManifestPath);
    // console.log('Temporary manifest file cleaned up');

    // get the manifest store report from stdout
    let report = JSON.parse(result.stdout)
    console.log('Manifest store report:', report);
    res.send({
        name: fileName,
        url: `http://localhost:${port}/${fileName}`,
        report
    });
    console.log('Response sent to client');
  } catch (err) {
    console.error('Error during file upload and processing:', err);
    // return errors to the client
    res.status(500).send(err);
  }
});

// the default endpoint is test page for this service
app.get('/', function (req, res) {
  console.log('Serving index.html');
  res.sendFile(path.join(__dirname, 'client/index.html'));
});

// start the http server
app.listen(port, () => 
  console.log(`CAI HTTP server listening on port ${port}.`)
);