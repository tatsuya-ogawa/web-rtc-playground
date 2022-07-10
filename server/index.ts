import http from 'http';
import socketio from 'socket.io';
import {Service} from "./service";

const service = new Service();
const server: http.Server = http.createServer()
const store:{[key:string]:any} = {

}
server.on("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Request-Method', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.writeHead(200, {'Content-Type': 'application/json'});
    switch(req.url){
        case "/signaling":
            res.write(JSON.stringify({domain:"localhost:4000",secure:false}));
            break;
        case "/list":
            res.write(JSON.stringify(Object.keys(store)))
            break;
    }
    res.end();
})
const io: socketio.Server = new socketio.Server(server, {
    cors: {
        origin: '*',
        methods: '*',
        allowedHeaders: '*',
        credentials: true,
    }
});
io.of("/").on('connection', (socket: socketio.Socket) => {
    ["OFFER","ANSWER","CANDIDATE"].forEach((message)=>{
        socket.on(`SEND_${message}`, (data: any) => {
            // socket.broadcast.emit(message, data);
            socket.to(store[data.dst]).emit(message, data);
        });
    })
    store[socket.handshake.query.peerId as string] = socket.id
    socket.emit('OPEN',service.getOpenMessage(socket.handshake.query.peerId as string))
});


const port = parseInt(process.env["PORT"] || "4000");
server.listen(port, () => console.log(`app listening on port ${port}`));