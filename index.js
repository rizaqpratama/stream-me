const express = require('express');
const trackRoute = express.Router();
const multer = require('multer');

const mongodb = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const Server = require('mongodb').Server;
const mm = require('music-metadata');



const { Readable } = require('stream')


const app = express();
app.use('/tracks', trackRoute);

let db;

MongoClient.connect('mongodb://localhost:27017', function(err, client) {  
  if(err) {
    console.log('MongoDB connection error, please make sure that mongodb is running');
    process.exit(1);
}

  db = client.db('trackDB');
});
// var client = new MongoClient(new Server('localhost', 27017), {native_parser: true});
// client.open(function(err, client) {
  
//   db = client.db('trackDB');
//   client.close();
// });

// MongoClient.connect('mongodb://localhost:27017/trackDB',  { useNewUrlParser: true }, (err, database) => {
//   if(err) {
//     console.log('MongoDB connection error, please make sure that mongodb is running');
//     process.exit(1);
//   }
//   db = database;

// });

// define the routes

trackRoute.get('/:trackID', (req, res) => {
  try {
    var trackID = new ObjectID(req.params.trackID);
  } catch(err) {
    return res.status(400).json({ message: "Invalid trackID sent" });
  }
  res.set('content-type', 'audio/mp3');
  res.set('accept-ranges', 'bytes');

  let bucket = new mongodb.GridFSBucket(db, {
    bucketName: 'tracks'
  });

  let downloadStram = bucket.openDownloadStream(trackID);

  downloadStram.on('data', (chunk) => {
    res.write(chunk);
  });

  downloadStram.on('error', () => {
    res.sendStatus(404);
  });

  downloadStram.on('end', () => {
    res.end();
  });
});

trackRoute.post('/', (req,res) => {
  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage, limits: { fields: 1, fieldSize: 20000000, files: 1, parts: 2 }});
  upload.single('track')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: "Upload reqeust validation failed" });
    } else if(!req.body.name) {
      return res.status(400).json({ message: "No track name in request body"});
    }

    let trackName = req.body.name;

    const readableTrackStream = new Readable();
    readableTrackStream.push(req.file.buffer);
    mm.parseStream(readableTrackStream, 'audio/mpeg').then(
      (metadata) => {
        console.log(metadata.common);
      }
    )
    readableTrackStream.push(null);

   

    let bucket = new mongodb.GridFSBucket(db, {
      bucketName: 'tracks'
    });

    let uploadStream = bucket.openUploadStream(trackName);
    let id = uploadStream.id;
    readableTrackStream.pipe(uploadStream);

    uploadStream.on('error', () => {
      return res.status(500).json({ message: "Error uploading file" });
    });

    uploadStream.on('finish', () => {
      return res.status(201).json({ message: "File upload successfully, stored under MongoDb object id "+ id });
    });
  })
});

app.listen(3033, () => {
  console.log("App listening on http://localhost:3033");
});