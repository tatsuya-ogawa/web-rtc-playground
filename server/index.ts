import http from 'http';
import socketio from 'socket.io';
import {Service} from "./service";

const service = new Service();
const server: http.Server = http.createServer()
const store: { [key: string]: { socket: socketio.Socket } } = {}
server.on("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Request-Method', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    const parse = (req: http.IncomingMessage): string | undefined => {
        if (req.url == "/signaling") {
            return JSON.stringify({domain: "localhost:4000", protocol: "http"});
        } else if (req.url?.match(/\/api\/apikeys\/(key)\/clients\//)) {
            return JSON.stringify(Object.keys(store));
        } else {
            return undefined;
        }
    }
    const body = parse(req)
    if (body) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.write(body)
    } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.write("{}")
    }
    res.end();
})
const io: socketio.Server = new socketio.Server(server, {
    cors: {
        origin: '*',
        methods: '*',
        allowedHeaders: '*',
        credentials: true,
    },
    allowEIO3: true
});
io.of("/").on('connection', (socket: socketio.Socket) => {
    ["OFFER", "ANSWER", "CANDIDATE"].forEach((message) => {
        socket.on(`SEND_${message}`, (data: any) => {
            // socket.broadcast.emit(message, data);
            console.log(data)
            socket.to(store[data.dst].socket.id).emit(message, data);
        });
    })
    console.log(socket.handshake.query)
    store[socket.handshake.query.peerId as string] = {socket}
    socket.emit('OPEN', service.getOpenMessage(socket.handshake.query.peerId as string)
    )
});


const port = parseInt(process.env["PORT"] || "4000");
server.listen(port, () => console.log(`app listening on port ${port}`));