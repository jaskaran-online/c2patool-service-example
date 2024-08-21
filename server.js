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
const winston = require('winston');

const port = process.env.PORT || 3000;

const app = express();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log' })
  ]
});

logger.info('Initializing server...');

// serve our web client
app.use(express.static('client'));

// Allow urls from the uploads folder to be served
let imageFolder = 'uploads'
app.use(express.static(imageFolder));

// Create a local folder to hold images in this example.
if(!fs.existsSync(imageFolder)){
  logger.info(`Creating image folder: ${imageFolder}`);
  fs.mkdirSync(imageFolder)
}

// Enable files upload.
app.use(fileUpload({
  createParentPath: true,
  limits: { 
      fileSize: 2 * 1024 * 1024 * 1024 // max upload file(s) size
  },
}));

logger.info('Configuring middleware...');

// Increase the limit for JSON and URL-encoded bodies
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Increase the limit for raw bodies
app.use(bodyParser.raw({ type: "image/*", limit: '50mb', extended: true }));

// Add other middleware.
app.use(cors());
app.use(morgan('dev'));

logger.info('Setting up routes...');

// Runs c2patool to get version info using exec
app.get('/version', async function (req, res) {
  logger.info('Received request for c2patool version');
  try {
    let result = await exec('c2patool --version');
    logger.info(`c2patool version: ${result.stdout}`);
    res.send(result.stdout);
  } catch (err) {
    logger.error('Error getting c2patool version:', err);
    res.status(500).send(err);
  }
});

// Uploads a file, adds a C2PA manifest and returns a URL
app.post('/upload', async (req, res) => { 
  logger.info('Received file upload request');
  try {
    let fileName = req.query.name;
    let filePath = `${imageFolder}/${fileName}`;
    logger.info(`Processing file: ${fileName}`);

    // Get custom data from the request body
    const { name, countryName, countryCode, mobileNumber } = req.body;

    // Create a custom manifest JSON
    logger.info('Creating custom manifest...');

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
                  "countryCode": `+{countryCode}`,
                  "phone": mobileNumber,
                  "action": "c2pa.published"
              }
          }
      ]
  });



    logger.info('Created custom manifest:', customManifest);

    // Write the custom manifest to a temporary file
    const tempManifestPath = path.join(__dirname, 'temp_manifest.json');
    await fsPromises.writeFile(tempManifestPath, customManifest);
    logger.info(`Temporary manifest file created: ${tempManifestPath}`);

    // upload the file
    await fsPromises.appendFile(filePath, Buffer.from(req.body.file), { flag: 'w' });
    logger.info(`File uploaded to: ${filePath}`);

    // call c2patool to add a manifest using the temporary custom manifest file
    let command = `c2patool "${filePath}" -m "${tempManifestPath}" -o "${filePath}" -f`;
    logger.info(`Executing command: ${command}`);
    let result = await exec(command);
    logger.info('c2patool execution completed');

    // Clean up the temporary manifest file
    await fsPromises.unlink(tempManifestPath);
    logger.info('Temporary manifest file cleaned up');

    // get the manifest store report from stdout
    let report = JSON.parse(result.stdout)
    logger.info('Manifest store report:', report);
    res.send({
        name: fileName,
        url: `https://c2patool-service-example.onrender.com/${fileName}`,
        report
    });
    logger.info('Response sent to client');
  } catch (err) {
    logger.error('Error during file upload and processing:', err);
    // return errors to the client
    res.status(500).send(err);
  }
});

// the default endpoint is test page for this service
app.get('/', function (req, res) {
  logger.info('Serving index.html');
  res.sendFile(path.join(__dirname, 'client/index.html'));
});

// start the http server
app.listen(port, () => 
  logger.info(`CAI HTTP server listening on port ${port}.`)
);