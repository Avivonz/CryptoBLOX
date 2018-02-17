'use strict';

const Hapi              = require('hapi');
const Joi               = require('joi');
const fs                = require('fs');
const Web3              = require('web3');
const PNG               = require('pngjs').PNG;
const Datastore         = require('nedb');
var contract            = require("truffle-contract");
var images              = require('images');
const PixelsContract    = require('./wrappers/Pixels.json');
var ipfsAPI             = require('ipfs-api')



/*
***************************Web3 INIT***************************
*/
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

const pixels = contract(PixelsContract);
pixels.setProvider(web3.currentProvider)
var pixelsInstance = null;
var CONTRACT_ADDR = '0x4e292bf8751b52a18f82dfd81b2e100b20ff504a';
/*
***************************************************************
*/

var ipfs                = ipfsAPI('localhost', '5001', {protocol: 'http'})
var rankings = [];
var noChangeCounter = {};
watchOnBlock();
var db = new Datastore({filename : "owners", autoload: true});

/*
***************************HAPI INIT***************************
*/

var tls = {
  key: fs.readFileSync('/etc/letsencrypt/live/cryptoblox.co/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/cryptoblox.co/cert.pem')
};

const server        = new Hapi.Server({ port: 3030, host: '0.0.0.0', tls:tls });

const options = {
    ops: {
        interval: 1000
    },
    reporters: {
        myFileReporter: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ response: '*', logs: '*' }]
        }, {
            module: 'good-squeeze',
            name: 'SafeJson'
        }, {
            module: 'good-file',
            args: ['./access.log']
        }],
    }
};

var corsHeaders = {
    origin: ["*"],
    headers: ["Access-Control-Allow-Origin","Access-Control-Allow-Headers","Origin, X-Requested-With, Content-Type", "CORELATION_ID"],
    credentials: true
};
/*
***************************************************************
*/


/*
***************************Utils*******************************
*/
const Promisify = (inner) =>
new Promise((resolve, reject) =>
    inner((err, res) => {
        if (err) {
            reject(err);
        } else {
            resolve(res);
        }}))


function findOne(db, opt) {
  return new Promise(function(resolve, reject) {
    db.findOne(opt, function(err, doc) {
      if (err) {
        reject(err)
    } else {
        resolve(doc)
    }
})
})
}

var heatMapColors = {
    0 : [255, 255, 255],
    1 : [255,186,186],
    2 : [255,123,123],
    3 : [255,82,82],
    4 : [255,0,0],
    5 : [167,0,0],
    6 : [0,0,0],
}


function flattenArray(arr)
{
    return [].concat.apply([], arr);
}

/*
***************************************************************
*/

async function getUsername(address){

    var doc = await findOne(db, {
        address: address
    });
    if (doc)
        return doc['owner'];

    return null;
}

async function addUsername(address, user){
    if(await getUsername(address) === null) {
        db.insert({address : address, owner : user}, function (err, newDocs){
            // console.log(newDocs);
        });
    }
}

async function getRankings(latestBlockEvents) {
    var tmpRankings = {};

    for (var block in latestBlockEvents){
        tmpRankings[latestBlockEvents[block].owner] = (tmpRankings[latestBlockEvents[block].owner] || 0) + 1; 
    }
    
    //console.log(tmpRankings);

    var sortedRankings = [];

    var oldRankings = rankings;

    // Iterate over DB and get amount of blocks for each user
    for (let key in tmpRankings){
        var doc = await findOne(db, {
            address: key
        });

        if(doc){
            let owner = doc['owner'];
            sortedRankings.push([owner, tmpRankings[key], 0]);
        }
    }

    // Sort it
    sortedRankings.sort(function(a, b) {
        return a[1] - b[1];
    });
    sortedRankings = sortedRankings.reverse();

    // First run
    if(oldRankings.length > 0)
    {
        // Check against old rankings and find change
        for(var i = 0; i < sortedRankings.length; i++){

            // Find old rankings index of corresponding user
            let oldIndex = oldRankings.findIndex(function(rank){
                return rank[0] == sortedRankings[i][0]
            })
            // Calculate change
            let change = oldIndex - i;

            // Increment block counter per change
            if(change == 0){
                sortedRankings[i][2] = oldRankings[i][2];
                noChangeCounter[sortedRankings[i][0]] = (noChangeCounter[sortedRankings[i][0]] || 0) + 1;
            }

            // (If he had a change in rankings, and he had no change in 10 blocks) or (He had a change)
            if((noChangeCounter[sortedRankings[i][0]] == 10) || (change != 0)){
                noChangeCounter[sortedRankings[i][2]] = 0;
                sortedRankings[i][2] = change;
            }
        }
    }
    // Set Global variable
    rankings = sortedRankings;

    //console.log(rankings);
    return sortedRankings;
}

function watchOnBlock() {

    var filter = web3.eth.filter('latest');
    //console.log(filter);
    filter.watch(async function(error, result){
        var block = web3.eth.getBlock(result, true);

        // console.log('current block #' + block.number);

        // Initiate instance at existing address
        pixelsInstance = await pixels.at(CONTRACT_ADDR);
        //console.log(pixelsInstance);
        // Create Event listener
        var BlockBoughtEvent = pixelsInstance.blockBought({}, { fromBlock: 0, toBlock: 'latest'});

        // Get all previous
        const blockBoughtResults   = await Promisify(cb => BlockBoughtEvent.get(cb));

        var blocksBoughtJSON = JSON.parse(JSON.stringify(blockBoughtResults.map(a => a.args)));
        var latestBlockEvents = {};

        for (var i = 0; i < blocksBoughtJSON.length; i++) {
            latestBlockEvents[blocksBoughtJSON[i].blockNumber] = blocksBoughtJSON[i]; 
        }

        getRankings(latestBlockEvents);
        // pinIPFS(latestBlockEvents);
        generateGrid(latestBlockEvents);
        generateHeatMap(blocksBoughtJSON);
    });
}

var to_b58 = function(B,A="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"){var d=[],s="",i,j,c,n;for(var i in B){j=0,c=B[i];s+=c||s.length^i?"":1;while(j in d||c){n=d[j];n=n?n*256+c:c;c=n/58|0;d[j]=n%58;j++}}while(j--)s+=A[d[j]];return s};

function bytes32ToIpfsHash(bytes32) {
    bytes32 = bytes32.split("0x")[1].match(/.{1,2}/g).map(function(v){
        return parseInt(v, 16);
    });
    bytes32 = [18, 32].concat(bytes32)
    var encoded_b58 = to_b58(bytes32);
    return encoded_b58;
}

function blockNumToCords(blockNum){
    return {x : Math.floor(blockNum % 100) * 10, y : Math.floor(blockNum / 100) * 10};
}

// function pinIPFS(latestBlockEvents) {
//     console.log("Pinning");
//     var obj = {};
//     for (var i in latestBlockEvents) {
//         console.log("Pinning " + latestBlockEvents[i].ipfsImageHash);
//         ipfs.pin.add(bytes32ToIpfsHash(latestBlockEvents[i].ipfsImageHash), (err, ipfsResponse) => {
//             if (err) { 
//                 console.error(err);
//                 next(err); 
//                 return; 
//             }
//             console.log('Pinned hash', hashToPin);
//         });
//     }
// }

async function generateGrid(latestBlockEvents){

    var obj = {};
    for (var i in latestBlockEvents) {
        // getFromIPFSAndDraw(latestBlockEvents[i]);
        obj[i] = ipfs.cat(bytes32ToIpfsHash(latestBlockEvents[i].ipfsImageHash));
    }
    var buffers = (await Promise.all(Object.values(obj)));

    var imgObjs = [];
    Object.keys(obj).forEach((key, i) => imgObjs.push({img : buffers[i],
        x : blockNumToCords(key).x,
        y: blockNumToCords(key).y
    }));

    images("clean_grid.png")
    .size(1000)
    .draws(imgObjs)
    .save("dirty_grid.png", {
        quality : 100
    });
    console.log("Grid generated");
}

async function generateHeatMap(blocksBoughtJSON){
    var heatMap = [];

    for(var i = 0; i < 10000; i++)
        heatMap[i] = 0;

    
    blocksBoughtJSON.forEach(function(x) { 
        heatMap[x.blockNumber]++;
    }); 
    
    var bytesArr = [];
    heatMap.forEach(
        (value) => bytesArr.push(heatMapColors[value])
        );

    var png = new PNG({
        width: 1000,
        height: 1000,
        filterType: -1
    });

    for (var y = 0; y < png.height; y = y + 10) {
        for (var x = 0; x < png.width; x = x + 10) {

            for (var z = 0; z < 10; z++) {
                for (var t = 0; t < 10; t++) {
                    var idx = (png.width * (y + z) + (x + t)) << 2;
                    try{
                        png.data[idx  ] = bytesArr[(png.width / 10) * (y / 10) + (x / 10)][0];
                        png.data[idx+1] = bytesArr[(png.width / 10) * (y / 10) + (x / 10)][1];
                        png.data[idx+2] = bytesArr[(png.width / 10) * (y / 10) + (x / 10)][2];

                        // Opacity
                        png.data[idx+3] = 255;
                    }
                    catch (ex) {
                        console.log("======================================================");
                        console.log(x + "," + y);
                        console.log((png.width / 10) * (y / 10) + (x / 10));
                        console.log("======================================================");
                    }
                }   
            }
        }
    }

    console.log("Generated Heat Map");
    png.pack().pipe(fs.createWriteStream('heatmap.png'));
}

// server.route({
//     method: ['GET', 'POST'],
//        path: '/',
//     handler: function (request, h) {
//         // console.log(web3);
//         return "Kaki";
//     }
// });

server.route({
    method: ['GET', 'POST'],
    path: '/getAllRankings',
    config: {cors: corsHeaders},
    handler: async function (request, h) {

        // rankings is a global variable set on every block mined
        return h.response(rankings);

    }
});

server.route({
    method: ['POST'],
    path: '/getUsername',
    config: {cors: corsHeaders},
    handler: async function (request, h) {

        var username = await getUsername(request.payload.address);

        return h.response(username);

    }
});

server.route({
    method: ['POST'],
    path: '/addUsername',
    handler: async function (request, h) {

        var username = await addUsername(request.payload.address, request.payload.user);

        return h.response(200);

    },
    config: {
        cors: corsHeaders,
        validate: {
            payload: {
                user       : Joi.string().max(15),
                address     : Joi.string().regex(/0[xX][0-9a-fA-F]+/)
            }
        }
    }
});

server.route({
    method: ['GET', 'POST'],
    path: '/getGrid',
    config: {cors: corsHeaders},
    handler: async function (request, h) {

        // The heatmap file is generated on every mined block
        var heatMap = fs.readFileSync("dirty_grid.png");
        return h.response(heatMap).header('Content-Disposition','inline').header('Content-type','image/png');

    }
});

server.route({
    method: ['GET', 'POST'],
    path: '/getHeatMap',
    config: {cors: corsHeaders},
    handler: async function (request, h) {

        // The heatmap file is generated on every mined block
        var heatMap = fs.readFileSync("heatmap.png");
        return h.response(heatMap).header('Content-Disposition','inline').header('Content-type','image/png');

    }
});

async function initServer() {
    await server.register({
        plugin: require('good'),
        options,
    });

    server.start((err) => {
        console.info(`Server started at ${ server.info.uri }`);
        if (err) {
            throw err;
        }
    });
}

initServer();
