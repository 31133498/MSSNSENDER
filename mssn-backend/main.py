import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://localhost:8080")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")

HEADERS = {
    "apikey": EVOLUTION_API_KEY,
    "Content-Type": "application/json",
}

client: httpx.AsyncClient = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    client = httpx.AsyncClient(timeout=30.0)
    print("MSSN Sender backend running")
    print(f"Evolution API: {EVOLUTION_API_URL}")
    yield
    await client.aclose()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/connect")
async def connect(instance: str = Query(...)):
    try:
        create_res = await client.post(
            f"{EVOLUTION_API_URL}/instance/create",
            headers=HEADERS,
            json={
                "instanceName": instance,
                "qrcode": True,
                "integration": "WHATSAPP-BAILEYS",
            },
        )
        if create_res.status_code not in (200, 201, 409):
            print(f"[ERROR] /api/connect: {create_res.text}")
            raise HTTPException(status_code=502, detail="Failed to create instance")

        qr_res = await client.get(
            f"{EVOLUTION_API_URL}/instance/connect/{instance}",
            headers=HEADERS,
        )
        if qr_res.status_code != 200:
            print(f"[ERROR] /api/connect: {qr_res.text}")
            raise HTTPException(status_code=502, detail="Failed to fetch QR code")

        return qr_res.json()

    except (httpx.ConnectError, httpx.TimeoutException) as e:
        print(f"[ERROR] /api/connect: {e}")
        raise HTTPException(status_code=503, detail="Cannot reach Evolution API. Is it running?")


@app.get("/api/status")
async def status(instance: str = Query(...)):
    try:
        res = await client.get(
            f"{EVOLUTION_API_URL}/instance/connectionState/{instance}",
            headers=HEADERS,
        )
        return res.json()

    except (httpx.ConnectError, httpx.TimeoutException) as e:
        print(f"[ERROR] /api/status: {e}")
        raise HTTPException(status_code=503, detail="Cannot reach Evolution API. Is it running?")


class SendMessageRequest(BaseModel):
    instance: str
    phone: str
    message: str


@app.post("/api/send")
async def send_message(body: SendMessageRequest):
    if not body.phone.isdigit():
        raise HTTPException(status_code=400, detail="Phone number must contain digits only")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        res = await client.post(
            f"{EVOLUTION_API_URL}/message/sendText/{body.instance}",
            headers=HEADERS,
            json={"number": body.phone, "text": body.message},
        )
        if res.status_code in (200, 201):
            data = res.json()
            return {"success": True, "messageId": data.get("key", {}).get("id")}
        else:
            print(f"[ERROR] /api/send: {res.text}")
            return {"success": False, "error": f"Evolution API error: {res.text}"}

    except (httpx.ConnectError, httpx.TimeoutException) as e:
        print(f"[ERROR] /api/send: {e}")
        raise HTTPException(status_code=503, detail="Cannot reach Evolution API. Is it running?")
