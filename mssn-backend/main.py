import asyncio
import csv
import io
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from random import uniform
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from supabase import Client, create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

EVOLUTION_API_URL  = os.getenv("EVOLUTION_API_URL", "http://localhost:8080")
EVOLUTION_API_KEY  = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_GLOBAL_KEY = os.getenv("EVOLUTION_GLOBAL_KEY", "")
SUPABASE_URL       = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
JWT_SECRET         = os.getenv("JWT_SECRET", "secret")
JWT_ALGORITHM      = "HS256"
JWT_EXPIRE_DAYS    = 7

EVO_HEADERS        = {"apikey": EVOLUTION_API_KEY,    "Content-Type": "application/json"}
EVO_GLOBAL_HEADERS = {"apikey": EVOLUTION_GLOBAL_KEY, "Content-Type": "application/json"}

pwd_ctx       = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

supabase:    Client             = None
http_client: httpx.AsyncClient = None


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client, supabase
    http_client = httpx.AsyncClient(timeout=30.0)
    supabase    = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("MSSN Sender backend running")
    print(f"Evolution API: {EVOLUTION_API_URL}")
    print(f"Supabase:      {SUPABASE_URL}")
    print(f"Global key:    {'loaded' if EVOLUTION_GLOBAL_KEY else 'MISSING'}")
    yield
    await http_client.aclose()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def format_phone(raw: str) -> Optional[str]:
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("234") and len(digits) == 13:
        if digits[3] in ("7", "8", "9"):
            return digits
        return None
    if len(digits) == 11 and digits[0] == "0":
        if digits[1] in ("7", "8", "9"):
            return "234" + digits[1:]
        return None
    if len(digits) == 10 and digits[0] in ("7", "8", "9"):
        return "234" + digits
    return None


def make_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode({"user_id": user_id, "email": email, "exp": expire},
                      JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Auth ──────────────────────────────────────────────────────────────────────

class AuthBody(BaseModel):
    email: str
    password: str
    branch_name: Optional[str] = None


@app.post("/api/auth/register")
async def register(body: AuthBody):
    try:
        existing = supabase.table("users").select("id").eq("email", body.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Email already registered")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /api/auth/register check: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    hashed = pwd_ctx.hash(body.password)
    try:
        result = supabase.table("users").insert({
            "id": str(uuid.uuid4()),
            "email": body.email,
            "password_hash": hashed,
            "branch_name": body.branch_name or "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as e:
        print(f"[ERROR] /api/auth/register insert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    user_id = result.data[0]["id"]
    return {"token": make_token(user_id, body.email), "user_id": user_id, "email": body.email}


@app.post("/api/auth/login")
async def login(body: AuthBody):
    try:
        res = supabase.table("users").select("*").eq("email", body.email).execute()
    except Exception as e:
        print(f"[ERROR] /api/auth/login: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = res.data[0]
    if not pwd_ctx.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"token": make_token(user["id"], user["email"]), "user_id": user["id"], "email": user["email"]}


# ── Instance ──────────────────────────────────────────────────────────────────

@app.get("/api/instance/status")
async def instance_status(instance: str = Query(...), user_id: str = Depends(get_current_user)):
    try:
        res = await http_client.get(
            f"{EVOLUTION_API_URL}/instance/connectionState/{instance}",
            headers=EVO_GLOBAL_HEADERS)
        return res.json()
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        print(f"[ERROR] /api/instance/status: {e}")
        raise HTTPException(status_code=503, detail="Cannot reach Evolution API")


@app.get("/api/instance/connect")
async def instance_connect(instance: str = Query(...), user_id: str = Depends(get_current_user)):
    try:
        # Step 1 — try to create the instance
        create_res = await http_client.post(
            f"{EVOLUTION_API_URL}/instance/create",
            headers=EVO_GLOBAL_HEADERS,
            json={"instanceName": instance, "qrcode": True, "integration": "WHATSAPP-BAILEYS"})

        if create_res.status_code in (200, 201):
            # New instance created — fall through to fetch QR
            pass
        elif create_res.status_code in (403, 409):
            # Instance already exists — skip creation, go straight to QR
            pass
        else:
            print(f"[ERROR] /api/instance/connect create: {create_res.status_code} {create_res.text}")
            raise HTTPException(status_code=502, detail="Failed to create instance")

        # Step 2 — fetch QR for new or existing instance
        qr_res = await http_client.get(
            f"{EVOLUTION_API_URL}/instance/connect/{instance}",
            headers=EVO_GLOBAL_HEADERS)
        if qr_res.status_code != 200:
            print(f"[ERROR] /api/instance/connect qr: {qr_res.status_code} {qr_res.text}")
            raise HTTPException(status_code=502, detail="Failed to fetch QR code")

        return qr_res.json()

    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        print(f"[ERROR] /api/instance/connect: {e}")
        raise HTTPException(status_code=503, detail="Cannot reach Evolution API")


class SaveInstanceBody(BaseModel):
    instance_name: str
    whatsapp_number: Optional[str] = ""


@app.post("/api/instance/save")
async def instance_save(body: SaveInstanceBody, user_id: str = Depends(get_current_user)):
    try:
        supabase.table("instances").insert({
            "user_id": user_id,
            "instance_name": body.instance_name,
            "instance_key": EVOLUTION_API_KEY,
            "whatsapp_number": body.whatsapp_number or "",
        }).execute()
    except Exception as e:
        print(f"[ERROR] /api/instance/save: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"success": True}


@app.get("/api/instance/mine")
async def instance_mine(user_id: str = Depends(get_current_user)):
    try:
        res = supabase.table("instances").select("*").eq("user_id", user_id).limit(1).execute()
    except Exception as e:
        print(f"[ERROR] /api/instance/mine: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return res.data[0] if res.data else None


# ── Contacts ──────────────────────────────────────────────────────────────────

@app.post("/api/contacts/upload")
async def contacts_upload(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    content = await file.read()
    decoded_content = content.decode("utf-8-sig")
    reader  = csv.DictReader(io.StringIO(decoded_content))
    to_insert, rejected = [], []
    
    # Get all column headers from CSV
    fieldnames = reader.fieldnames or []
    detected_columns = [f.strip() for f in fieldnames]
    
    # Normalize column mapping
    phone_col = None
    name_col = None
    group_col = None
    custom_field_cols = []
    
    # 1. CONTENT-BASED DETECTION for Phone column (High Priority)
    # Scan first 10 rows to see which column most frequently contains valid phone numbers
    column_scores = {col: 0 for col in detected_columns}
    for i, row in enumerate(reader):
        if i >= 10: break
        for col in detected_columns:
            if format_phone(row.get(col, "")):
                column_scores[col] += 1
    
    if any(column_scores.values()):
        phone_col = max(column_scores, key=column_scores.get)

    # 2. NAME-BASED DETECTION for other columns and fallback for Phone
    for col in detected_columns:
        col_lower = col.lower()
        if not phone_col and col_lower in ("phone", "phonenumber", "phone_number", "tel", "telephone", "mobile"):
            phone_col = col
        elif col == phone_col:
            continue
        elif col_lower in ("name", "fullname", "full_name", "contact_name", "contactname"):
            name_col = col
        elif col_lower in ("group", "groupname", "group_name", "grp"):
            group_col = col
        else:
            custom_field_cols.append(col)
    
    if not phone_col:
        raise HTTPException(status_code=400, detail="Could not identify a phone number column by content or header name.")

    # Reset reader to start for final processing
    reader = csv.DictReader(io.StringIO(decoded_content))
    for i, row in enumerate(reader):
        raw_phone = (row.get(phone_col) or "").strip()
        if not raw_phone:
            rejected.append({"row": i + 2, "reason": "Missing phone field"})
            continue
        formatted = format_phone(raw_phone)
        if not formatted:
            rejected.append({"row": i + 2, "reason": f"Invalid phone: {raw_phone}"})
            continue
        
        # Build custom_fields from all other columns
        custom_fields = {}
        for col in custom_field_cols:
            val = (row.get(col) or "").strip()
            if val:
                # Use normalized field name
                field_key = col.lower().replace(" ", "_").replace("-", "_")
                custom_fields[field_key] = val
        
        to_insert.append({
            "user_id":      user_id,
            "name":         (row.get(name_col) or row.get(name_col.title()) or "").strip() or None if name_col else None,
            "phone":        formatted,
            "group_name":   (row.get(group_col) or row.get(group_col.title()) or "").strip() or None if group_col else None,
            "custom_fields": custom_fields,
        })

    if to_insert:
        try:
            supabase.table("contacts").insert(to_insert).execute()
        except Exception as e:
            print(f"[ERROR] /api/contacts/upload: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # Return detected columns for frontend mapping
    return_columns = [name_col] if name_col else []
    return_columns.extend([c for c in custom_field_cols])
    
    return {
        "inserted": len(to_insert), 
        "rejected": rejected,
        "columns": [c for c in detected_columns if c.lower() != phone_col.lower()]
    }


class PasteBody(BaseModel):
    text:       str
    group_name: Optional[str] = None


@app.post("/api/contacts/paste")
async def contacts_paste(body: PasteBody, user_id: str = Depends(get_current_user)):
    tokens    = re.split(r"[\n,]+", body.text)
    to_insert, rejected = [], []

    for token in tokens:
        raw = token.strip()
        if not raw:
            continue
        formatted = format_phone(raw)
        if not formatted:
            rejected.append({"raw": raw, "reason": f"Invalid phone: {raw}"})
            continue
        to_insert.append({"user_id": user_id, "name": None, "phone": formatted, "group_name": body.group_name or None, "custom_fields": {}})

    if to_insert:
        try:
            supabase.table("contacts").insert(to_insert).execute()
        except Exception as e:
            print(f"[ERROR] /api/contacts/paste: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return {"inserted": len(to_insert), "rejected": rejected}


class SingleContactBody(BaseModel):
    name:         Optional[str]      = None
    phone:        str
    group_name:   Optional[str]      = None
    custom_fields: Optional[dict]   = {}


@app.post("/api/contacts")
async def contacts_add(body: SingleContactBody, user_id: str = Depends(get_current_user)):
    formatted = format_phone(body.phone)
    if not formatted:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    try:
        result = supabase.table("contacts").insert({
            "user_id":      user_id,
            "name":         body.name or None,
            "phone":        formatted,
            "group_name":   body.group_name or None,
            "custom_fields": body.custom_fields or {},
        }).execute()
    except Exception as e:
        print(f"[ERROR] /api/contacts add: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "contact": result.data[0] if result.data else {}}


@app.get("/api/contacts")
async def contacts_list(
    group:    Optional[str] = Query(None),
    search:   Optional[str] = Query(None),
    page:     int           = Query(1),
    per_page: int           = Query(50),
    user_id:  str           = Depends(get_current_user),
):
    try:
        q = supabase.table("contacts").select("*", count="exact").eq("user_id", user_id)
        if group == "__ungrouped__":
            q = q.is_("group_name", "null")
        elif group:
            q = q.eq("group_name", group)
            
        if search:
            # Search in name and phone. JSONB search is handled via ilike on the casted column if needed, 
            # but for now we prioritize name/phone as per model.
            q = q.or_(f"name.ilike.%{search}%,phone.ilike.%{search}%")
            
        offset = (page - 1) * per_page
        q = q.order("created_at", desc=True).range(offset, offset + per_page - 1)
        res   = q.execute()
        total = res.count or 0
        pages = max(1, -(-total // per_page))  # ceiling division
        return {"contacts": res.data, "total": total, "page": page, "per_page": per_page, "pages": pages}
    except Exception as e:
        print(f"[ERROR] /api/contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/contacts/groups")
async def contacts_groups(user_id: str = Depends(get_current_user)):
    try:
        res = supabase.table("contacts").select("group_name").eq("user_id", user_id).not_.is_("group_name", "null").execute()
        groups = sorted({r["group_name"] for r in res.data if r.get("group_name")})
        return {"groups": groups}
    except Exception as e:
        print(f"[ERROR] /api/contacts/groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BulkDeleteBody(BaseModel):
    contact_ids: List[str]


@app.post("/api/contacts/bulk-delete")
async def contacts_bulk_delete(body: BulkDeleteBody, user_id: str = Depends(get_current_user)):
    if not body.contact_ids:
        return {"deleted": 0}
    try:
        supabase.table("contacts").delete().in_("id", body.contact_ids).eq("user_id", user_id).execute()
    except Exception as e:
        print(f"[ERROR] /api/contacts/bulk-delete: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"deleted": len(body.contact_ids)}


@app.delete("/api/contacts/{contact_id}")
async def contacts_delete(contact_id: str, user_id: str = Depends(get_current_user)):
    try:
        supabase.table("contacts").delete().eq("id", contact_id).eq("user_id", user_id).execute()
    except Exception as e:
        print(f"[ERROR] /api/contacts/delete: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"success": True}


@app.get("/api/contacts/whatsapp-contacts")
async def whatsapp_contacts(
    save_to_contacts: bool = Query(False),
    selected_phones: Optional[List[str]] = Query(None),
    user_id: str = Depends(get_current_user)
):
    # Step 1 — get instance from DB
    try:
        result = supabase.table("instances").select("*").eq("user_id", user_id).execute()
        if not result.data:
            return {"contacts": [], "total": 0, "error": "No instance found for user"}
        instance_name = result.data[0]["instance_name"]
    except Exception as e:
        print(f"[ERROR] /api/contacts/whatsapp-contacts DB: {e}")
        return {"contacts": [], "total": 0, "error": str(e)}

    print(f"[DEBUG] Fetching WhatsApp contacts for instance: {instance_name}")
    print(f"[DEBUG] URL: {EVOLUTION_API_URL}/chat/findContacts/{instance_name}")
    print(f"[DEBUG] Using key: {EVOLUTION_GLOBAL_KEY[:8]}...")

    headers = {"apikey": EVOLUTION_GLOBAL_KEY}
    res = None

    try:
        res = await http_client.post(
            f"{EVOLUTION_API_URL}/chat/findContacts/{instance_name}",
            headers={**headers, "Content-Type": "application/json"},
            json={"where": {}}
        )
        print(f"[DEBUG] Response status: {res.status_code}")
        print(f"[DEBUG] Response body: {res.text[:200]}")

        if res.status_code != 200:
            return {
                "contacts": [],
                "total": 0,
                "error": f"Evolution API returned {res.status_code}: {res.text[:200]}"
            }

        # The evolution API can return a list or an object with a data/contacts key depending on version
        resp_data = res.json()
        if isinstance(resp_data, list):
            raw_list = resp_data
        elif isinstance(resp_data, dict):
            raw_list = resp_data.get("contacts", resp_data.get("data", []))
        else:
            raw_list = []
            
        print(f"[DEBUG] Total raw contacts returned: {len(raw_list)}")

        contacts = []
        seen_phones = set()

        for contact in raw_list:
            remote_jid = contact.get("remoteJid", "")

            if "@g.us" in remote_jid:
                continue
            if "broadcast" in remote_jid.lower() or "status" in remote_jid.lower():
                continue

            phone_raw = remote_jid.split("@")[0]

            if not phone_raw.isdigit():
                continue

            if len(phone_raw) == 13 and phone_raw.startswith("234") and phone_raw[3] in ("7", "8", "9"):
                phone = phone_raw
            elif len(phone_raw) == 11 and phone_raw[0] == "0" and phone_raw[1] in ("7", "8", "9"):
                phone = "234" + phone_raw[1:]
            elif len(phone_raw) == 10 and phone_raw[0] in ("7", "8", "9"):
                phone = "234" + phone_raw
            else:
                continue

            if phone in seen_phones:
                continue
            seen_phones.add(phone)

            name = contact.get("pushName") or contact.get("name") or None
            if name and name.replace("+", "").replace(" ", "").isdigit():
                name = None

            contacts.append({"phone": phone, "name": name})

        contacts.sort(key=lambda c: (c["name"] is None, (c["name"] or "").lower()))
        print(f"[DEBUG] Valid contacts after filtering: {len(contacts)}")

        saved = 0
        already_existed = 0
        if contacts:
            # Filter only selected ones if list provided
            target_contacts = contacts
            if selected_phones:
                target_contacts = [c for c in contacts if c["phone"] in selected_phones]

            try:
                existing_res = supabase.table("contacts").select("phone, id, name").eq("user_id", user_id).execute()
                existing_map = {r["phone"]: r for r in (existing_res.data or [])}
                new_contacts = []
                for c in target_contacts:
                    if c["phone"] not in existing_map:
                        new_contacts.append({
                            "user_id": user_id, "phone": c["phone"],
                            "name": c["name"], "group_name": "WhatsApp Contacts", "custom_fields": {}
                        })
                    else:
                        already_existed += 1
                        # Update name if was null and we now have one
                        if c["name"] and not existing_map[c["phone"]].get("name"):
                            supabase.table("contacts").update({"name": c["name"]}).eq("id", existing_map[c["phone"]]["id"]).execute()
                if new_contacts and save_to_contacts:
                    supabase.table("contacts").insert(new_contacts).execute()
                    saved = len(new_contacts)
                    print(f"[DEBUG] Inserted {saved} new contacts into DB")
            except Exception as e:
                print(f"[ERROR] saving whatsapp contacts to DB: {e}")

        return {"contacts": contacts, "total": len(contacts), "saved": saved, "already_existed": already_existed}

    except (httpx.ConnectError, httpx.TimeoutException) as e:
        print(f"[ERROR] /api/contacts/whatsapp-contacts unreachable: {e}")
        return {"contacts": [], "total": 0, "error": f"Cannot reach Evolution API: {str(e)}"}
    except Exception as e:
        print(f"[ERROR] /api/contacts/whatsapp-contacts: {e}")
        return {"contacts": [], "total": 0, "error": str(e)}


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
async def get_stats(user_id: str = Depends(get_current_user)):
    try:
        contacts_res  = supabase.table("contacts").select("id", count="exact").eq("user_id", user_id).execute()
        campaigns_res = supabase.table("campaigns").select("sent_count, failed_count").eq("user_id", user_id).execute()
        camp_count    = supabase.table("campaigns").select("id", count="exact").eq("user_id", user_id).execute()
        delivered = sum(c.get("sent_count", 0) or 0 for c in campaigns_res.data)
        failed    = sum(c.get("failed_count", 0) or 0 for c in campaigns_res.data)
        return {
            "contacts":  contacts_res.count or 0,
            "campaigns": camp_count.count or 0,
            "delivered": delivered,
            "failed":    failed,
        }
    except Exception as e:
        print(f"[ERROR] /api/stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Campaigns ─────────────────────────────────────────────────────────────────

def personalize_message(template: str, recipient: dict, global_name_default: str = "member") -> str:
    message = template
    # Replace {{name}}
    name_val = recipient.get("name") or global_name_default
    message = message.replace("{{name}}", str(name_val))
    
    # Replace all custom field tags
    custom_fields = recipient.get("custom_fields") or {}
    for key, value in custom_fields.items():
        tag = f"{{{{{key}}}}}"
        message = message.replace(tag, str(value) if value is not None else "")
        
    # Remove any unreplaced tags (field not present for this contact)
    message = re.sub(r'\{\{[^}]+\}\}', '', message)
    return message.strip()


class Recipient(BaseModel):
    phone:         str
    name:          Optional[str]  = None
    custom_fields: Optional[dict] = {}
    id:            Optional[str]  = None


class CreateCampaignBody(BaseModel):
    instance_name:    str
    message_template: str
    recipients:       List[Recipient]


@app.post("/api/campaigns/create")
async def campaign_create(body: CreateCampaignBody, user_id: str = Depends(get_current_user)):
    valid, rejected = [], []
    for r in body.recipients:
        phone = format_phone(r.phone)
        if phone:
            valid.append({"phone": phone, "name": r.name, "custom_fields": r.custom_fields or {}})
        else:
            rejected.append(r.phone)

    if not valid:
        raise HTTPException(status_code=400, detail="No valid recipients")

    campaign_id = str(uuid.uuid4())
    try:
        supabase.table("campaigns").insert({
            "id":               campaign_id,
            "user_id":          user_id,
            "instance_name":    body.instance_name,
            "message_template": body.message_template,
            "status":           "draft",
            "total_recipients": len(valid),
            "sent_count":       0,
            "failed_count":     0,
        }).execute()

        rows = [{
            "campaign_id":   campaign_id,
            "contact_id":    None,
            "phone":         r["phone"],
            "name":          r["name"],
            "custom_fields": r["custom_fields"],
            "status":        "pending",
        } for r in valid]
        supabase.table("campaign_recipients").insert(rows).execute()
    except Exception as e:
        print(f"[ERROR] /api/campaigns/create: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"campaign_id": campaign_id, "total": len(valid), "rejected": rejected}


# ── Campaign background send ──────────────────────────────────────────────────

async def run_campaign(campaign_id: str, instance_name: str, message_template: str):
    try:
        res        = supabase.table("campaign_recipients").select("*") \
                        .eq("campaign_id", campaign_id).eq("status", "pending").execute()
        recipients = res.data
    except Exception as e:
        print(f"[ERROR] run_campaign fetch: {e}")
        return

    sent_this_hour = 0
    hour_start     = datetime.now(timezone.utc)

    for idx, r in enumerate(recipients):
        # Anti-ban: hourly cap of 200
        now = datetime.now(timezone.utc)
        if (now - hour_start).seconds >= 3600:
            sent_this_hour = 0
            hour_start     = now
        if sent_this_hour >= 200:
            wait = 3600 - (now - hour_start).seconds
            print(f"[INFO] Hourly cap reached. Pausing {wait}s")
            await asyncio.sleep(wait)
            sent_this_hour = 0
            hour_start     = datetime.now(timezone.utc)

        # Anti-ban: batch pause every 50
        if idx > 0 and idx % 50 == 0:
            print(f"[INFO] Batch pause at {idx} messages")
            await asyncio.sleep(60)

        name         = r.get("name") or "member"
        phone        = r.get("phone", "")
        personalized = personalize_message(message_template, r)

        async def attempt_send(msg=personalized, num=phone):
            return await http_client.post(
                f"{EVOLUTION_API_URL}/message/sendText/{instance_name}",
                headers=EVO_HEADERS,
                json={"number": num, "text": msg})

        try:
            send_res = await attempt_send()

            # Anti-ban: handle 429 rate limit
            if send_res.status_code == 429:
                print(f"[WARN] Rate limited on {phone}. Pausing 5 minutes.")
                await asyncio.sleep(300)
                send_res = await attempt_send(personalized, phone)

            if send_res.status_code in (200, 201):
                supabase.table("campaign_recipients").update({
                    "status":  "sent",
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", r["id"]).execute()
                supabase.rpc("increment_campaign_sent", {"cid": campaign_id}).execute()
                sent_this_hour += 1
            else:
                print(f"[ERROR] send {phone}: {send_res.text}")
                supabase.table("campaign_recipients").update({
                    "status":        "failed",
                    "error_message": send_res.text[:500],
                }).eq("id", r["id"]).execute()
                supabase.rpc("increment_campaign_failed", {"cid": campaign_id}).execute()

        except (httpx.ConnectError, httpx.TimeoutException) as e:
            print(f"[ERROR] run_campaign unreachable: {e}")
            supabase.table("campaign_recipients").update({
                "status":        "failed",
                "error_message": "Evolution API unreachable",
            }).eq("id", r["id"]).execute()
            supabase.rpc("increment_campaign_failed", {"cid": campaign_id}).execute()

        # Anti-ban: random delay 3–6s between every message
        await asyncio.sleep(uniform(3, 6))

    try:
        supabase.table("campaigns").update({"status": "done"}).eq("id", campaign_id).execute()
    except Exception as e:
        print(f"[ERROR] run_campaign finalize: {e}")


@app.post("/api/campaigns/{campaign_id}/send")
async def campaign_send(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    try:
        res      = supabase.table("campaigns").select("*") \
                    .eq("id", campaign_id).eq("user_id", user_id).execute()
        campaign = res.data[0] if res.data else None
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /api/campaigns/send fetch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    try:
        supabase.table("campaigns").update({"status": "running"}).eq("id", campaign_id).execute()
    except Exception as e:
        print(f"[ERROR] /api/campaigns/send update: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    background_tasks.add_task(
        run_campaign, campaign_id,
        campaign["instance_name"], campaign["message_template"])
    return {"started": True}


@app.get("/api/campaigns/{campaign_id}/progress")
async def campaign_progress(campaign_id: str, user_id: str = Depends(get_current_user)):
    try:
        res = supabase.table("campaigns").select("*") \
                .eq("id", campaign_id).eq("user_id", user_id).execute()
        c   = res.data[0] if res.data else None
        if not c:
            raise HTTPException(status_code=404, detail="Campaign not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] /api/campaigns/progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    total   = c["total_recipients"] or 0
    sent    = c["sent_count"] or 0
    failed  = c["failed_count"] or 0
    pending = max(total - sent - failed, 0)
    percent = round((sent + failed) / total * 100, 1) if total else 0.0

    return {"campaign_id": campaign_id, "status": c["status"],
            "total": total, "sent": sent, "failed": failed,
            "pending": pending, "percent": percent}


@app.get("/api/campaigns")
async def campaigns_list(user_id: str = Depends(get_current_user)):
    try:
        res = supabase.table("campaigns").select("*") \
                .eq("user_id", user_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"[ERROR] /api/campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/campaigns/{campaign_id}/report")
async def campaign_report(campaign_id: str, user_id: str = Depends(get_current_user)):
    try:
        camp_res  = supabase.table("campaigns").select("*") \
                    .eq("id", campaign_id).eq("user_id", user_id).execute()
        recip_res = supabase.table("campaign_recipients").select("*") \
                    .eq("campaign_id", campaign_id).execute()
    except Exception as e:
        print(f"[ERROR] /api/campaigns/report: {e}")
        raise HTTPException(status_code=404, detail="Campaign not found")

    if not camp_res.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    recipients = [{
        "name":          r.get("name"),
        "phone":         r["phone"],
        "status":        r["status"],
        "error_message": r.get("error_message"),
        "sent_at":       r.get("sent_at"),
    } for r in recip_res.data]

    return {"campaign": camp_res.data[0], "recipients": recipients}
