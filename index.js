// Place your server entry point code here
const minimist = require('minimist')
const express = require('express')
const app = express()
const fs = require('fs')
const morgan = require('morgan')

const db = require("./src/services/database.js")
const args = minimist(process.argv.slice(2))

app.use(express.json());
app.use(express.static("./public"));

args["help", "port", "debug", "log"]

if (args.help || args.h) {
    const help = (`
    server.js [options]
    
    --port	Set the port number for the server to listen on. Must be an integer
                between 1 and 65535.
    
    --debug	If set to true, creates endlpoints /app/log/access/ which returns
                a JSON access log from the database and /app/error which throws 
                an error with the message "Error test successful." Defaults to 
                false.
    
    --log		If set to false, no log files are written. Defaults to true.
                Logs are always written to database.
    
    --help	Return this message and exit.
    `)
    console.log(help)
    process.exit(0)
}

var HTTP_PORT = args.port || process.env.PORT || 5555
const debug = args.debug || false
const log = args.log || true 

const server = app.listen(HTTP_PORT, () => {
    console.log("Server running on port %PORT%".replace("%PORT%",HTTP_PORT))
});

if (log != "false") {
    const accesslog = fs.createWriteStream('access.log', { flags: 'a' })
    app.use(morgan('combined', { stream: accesslog }))
}

app.use((req, res, next) => {
    let logdata = {
            remoteaddr: req.ip,
            remoteuser: req.user,
            time: Date.now(),
            method: req.method,
            url: req.url,
            protocol: req.protocol,
            httpversion: req.httpVersion,
            status: res.statusCode,
            referer: req.headers['referer'],
            useragent: req.headers['user-agent']
        };
        const stmt = db.prepare('INSERT INTO accesslog (remoteaddr, remoteuser, time, method, url, protocol, httpversion, status, referer, useragent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        const table_info = stmt.run(String(logdata.remoteaddr), String(logdata.remoteuser), String(logdata.time), String(logdata.method), String(logdata.url), String(logdata.protocol), String(logdata.httpversion), String(logdata.status), String(logdata.referrer), String(logdata.useragent))
        next();
    });

//flip functions 
function coinFlip() {
    return (Math.floor(Math.random() * 2) == 0) ? 'heads' : 'tails';
  }

function coinFlips(flips) {
    let f = [];
    for (var i = 0; i < flips; i++) {
      let flip = coinFlip();
      f[i] = flip;
    }
    return f;
  }

function countFlips(array) {
    let heads_count = 0;
    let tails_count = 0;
    for (var i = 0; i < array.length; i++) {
      if (array[i] == 'heads') {
        heads_count ++;
      } else if (array[i] == 'tails') {
        tails_count ++;
      }
    }
    if (heads_count == 0) {
      return {"tails": tails_count};
    }
    else if (tails_count == 0) {
      return {"heads": heads_count};
    }
    return {"heads": heads_count, "tails": tails_count};
  }
  
function flipACoin(call) {
    let coin_flip = coinFlip();
    let match = "";
    if (coin_flip == call) {
      match = "win";
    } else if (coin_flip != call) {
      match = "lose";
    }
    return {"call": call, "flip": coin_flip, "result": match};
  }

// endpoints
app.get('/app/', (req, res) => {
    res.statusCode = 200;
    res.statusMessage = 'OK';
    res.writeHead( res.statusCode, { 'Content-Type' : 'text/plain' });
    res.end(res.statusCode+ ' ' +res.statusMessage)
})

app.get('/app/flip/', (req, res) => {
    res.status(200).json({'flip': coinFlip()})
})
app.get('/app/flips/:number/', (req, res) => {
    res.status(200).json({'raw': coinFlips(req.params.number), 
    'summary': countFlips(coinFlips(req.params.number))})
})
app.get('/app/flip/call/tails/', (req, res) => {
    res.status(200).json(flipACoin('tails'))
})
app.get('/app/flip/call/heads/', (req, res) => {
    res.status(200).json(flipACoin('heads'))
})

app.post('/app/flips/coins/', (req, res, next) => {
    const result = coinFlips(parseInt(req.body.number))
    const count = countFlips(result)
    res.status(200).json({"raw": result, "summary": count})
})

app.post('/app/flip/call/', (req, res, next) => {
    res.status(200).json(flipACoin(req.body.call))
})

if (debug != "false") {
    app.get("/app/log/access", (req, res) => {
        try {
            const stmt = db.prepare('SELECT * FROM accesslog').all();
            res.status(200).json(stmt)
        } catch {
            console.error(e)
        }
    });
    app.get('/app/error', (req, res) => {
        throw new Error('Error test successful.')
    });
}
app.use(function (req, res) {
    res.status(404).send('404 NOT FOUND')
});

process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server stopped')
    })
})