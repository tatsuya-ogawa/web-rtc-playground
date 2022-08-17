import argparse
import asyncio
import json
import logging
import os
import platform
import ssl

from aiohttp import web

from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.contrib.media import MediaPlayer, MediaRelay
from aiortc.rtcrtpsender import RTCRtpSender

ROOT = os.path.dirname(__file__)


async def candidate(request):
    print("on candidate")
    params = await request.json()
    candidate_params = params["candidate"]
    connection_id = params["connectionId"]
    if connection_id in pcs:
        pcs[connection_id]["candidate"] = candidate_params
        if "pc" in pcs[connection_id]:
            await pcs[connection_id]["pc"].addIceCandidate(candidate_params)
    else:
        pcs[connection_id] = {
            "candidate": candidate_params
        }
    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {}
        ),
    )


async def offer(request):
    print("on offer")
    params = await request.json()
    offer_params = params["offer"]
    connection_id = params["connectionId"]
    offer = RTCSessionDescription(sdp=offer_params["sdp"], type=offer_params["type"])

    pc = RTCPeerConnection(RTCConfiguration(iceServers=[RTCIceServer("stun:localhost:3748")]))
    # pc = RTCPeerConnection()
    relay = MediaRelay()
    if connection_id in pcs:
        candidate = pcs[connection_id]["candidate"]
        pcs[connection_id] = {"pc": pc, "tracks": [], "candidate": candidate, "relay": relay}
        await pc.addIceCandidate(candidate)
    else:
        pcs[connection_id] = {"pc": pc, "tracks": [], "relay": relay}

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print(f"state is {pc.connectionState}")
        if pc.connectionState == "failed":
            await pc.close()
            del pcs[connection_id]

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        print("ICE connection state is %s" % pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            await pc.close()
            del pcs[connection_id]

    @pc.on("icecandidate")
    async def on_icecandidate(ice):
        print("ice candidate")

    def add_tracks():
        for key, other_pc in pcs.items():
            if key != connection_id:
                print(f"add track {key} to {connection_id}")
                for track in other_pc["tracks"]:
                    try:
                        pc.addTrack(relay.subscribe(track))
                    except Exception as ex:
                        print(ex)

    @pc.on("track")
    async def on_track(track):
        print(f"on track {connection_id}")
        pcs[connection_id]["tracks"].append(track)
        for key, other_pc in pcs.items():
            if key != connection_id:
                print(f"add track {key} to {connection_id}")
                try:
                    other_pc["pc"].addTrack(relay.subscribe(track))
                except Exception as ex:
                    print(ex)

    await pc.setRemoteDescription(offer)

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    # add_tracks()
    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )


pcs = {}


async def on_shutdown(app):
    # close peer connections
    coros = [pc["pc"].close() for key, pc in pcs.items()]
    await asyncio.gather(*coros)
    pcs.clear()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WebRTC webcam demo")
    parser.add_argument("--cert-file", help="SSL certificate file (for HTTPS)")
    parser.add_argument("--key-file", help="SSL key file (for HTTPS)")
    parser.add_argument("--play-from", help="Read the media from a file and sent it."),
    parser.add_argument(
        "--play-without-decoding",
        help=(
            "Read the media without decoding it (experimental). "
            "For now it only works with an MPEGTS container with only H.264 video."
        ),
        action="store_true",
    )
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host for HTTP server (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=8080, help="Port for HTTP server (default: 8080)"
    )
    parser.add_argument("--verbose", "-v", action="count")
    parser.add_argument(
        "--audio-codec", help="Force a specific audio codec (e.g. audio/opus)"
    )
    parser.add_argument(
        "--video-codec", help="Force a specific video codec (e.g. video/H264)"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    if args.cert_file:
        ssl_context = ssl.SSLContext()
        ssl_context.load_cert_chain(args.cert_file, args.key_file)
    else:
        ssl_context = None

    app = web.Application()
    app.on_shutdown.append(on_shutdown)
    app.router.add_post("/offer", offer)
    app.router.add_post("/candidate", candidate)
    web.run_app(app, host=args.host, port=args.port, ssl_context=ssl_context)
