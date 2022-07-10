import http from 'http';
import socketio from 'socket.io';
import {Service} from "./service";

const service = new Service();
const server: http.Server = http.createServer()
server.on("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Request-Method', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(service.getOpenMessage("test")));
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

io.of("/signaling").on('connection', (socket: socketio.Socket) => {
    ["OFFER","ANSWER","CANDIDATE"].forEach((message)=>{
        socket.on(`SEND_${message}`, (data: any) => {
            socket.broadcast.emit(message, data);
        });
    })
    socket.emit('OPEN',service.getOpenMessage(socket.data["peerId"]))
});


const port = parseInt(process.env["PORT"] || "4000");
server.listen(port, () => console.log(`app listening on port ${port}`));