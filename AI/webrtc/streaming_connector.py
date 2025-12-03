# webrtc/streaming_connector.py

import asyncio
import websockets
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
import json

async def connect_to_streaming_server(track):
    pc = RTCPeerConnection()
    pc.addTrack(track)

    async with websockets.connect("ws://streaming-server-ip:5003") as ws:
        @pc.on("icecandidate")
        async def on_icecandidate(candidate):
            if candidate:
                await ws.send(json.dumps({
                    "type": "ice-candidate",
                    "candidate": candidate.toJSON(),
                }))

        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        await ws.send(json.dumps({
            "type": "offer",
            "sdp": offer.sdp
        }))

        async for message in ws:
            data = json.loads(message)
            if data["type"] == "answer":
                await pc.setRemoteDescription(RTCSessionDescription(sdp=data["sdp"], type="answer"))
            elif data["type"] == "ice-candidate":
                await pc.addIceCandidate(RTCIceCandidate(**data["candidate"]))
