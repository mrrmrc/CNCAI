"""
backend.py - FastAPI Archivio Cammino Neocatecumenale
Versione completa con autenticazione JWT, gestione utenti,
documenti, admin panel, backup, log accessi.
"""
from fastapi import FastAPI, HTTPException, Header, Request, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
import psycopg2
import psycopg2.extras
from openai import OpenAI
import bcrypt
import jwt
import os
import subprocess
import shutil

# ════════════════════════════════════════════════════════
# CONFIGURAZIONE
# ════════════════════════════════════════════════════════

app = FastAPI(docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.pictosound.com", "https://pictosound.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONFIG = {
    "host": "localhost",
    "database": "docdb",
    "user": "docuser",
    "password": "DocPass2026x",
    "port": 5432
}

# Chiave segreta JWT — CAMBIA CON UNA STRINGA CASUALE LUNGA
JWT_SECRET = "d2ba8d3e3e4876bf16a4a01f034f7f684bc20e71f84c37a5a93f845a3665c0bd"
JWT_EXPIRE_HOURS = 8

# API Keys per accesso diretto (frontend legacy)
API_KEYS = {
    "frontend":    "xK9mP2nQ8rL5vT3wY7jH4dF6",
    "antigravity": "bN3cR7sW2qA9mX5pZ8uE4tG6",
}

# Cartelle file
ORIGINALI_DIR = Path("/opt/docapp/originali")
TESTI_DIR     = Path("/opt/docapp/testi")
BACKUP_DIR    = Path("/opt/backups")
UPLOAD_DIR    = Path("/opt/docapp/uploads_temp")
UPLOAD_DIR.mkdir(exist_ok=True)

# Regolo.ai
REGOLO_API_KEY = "sk-cW-pQV8CyF8vsejS6tqYWQ"
EMBED_MODEL    = "gte-Qwen2"
LLM_MODELS     = [
    "Llama-3.3-70B-Instruct",
    "apertus-70b",
    "mistral-small-4-119b",
    "gpt-oss-20b",
]

# Rate limiting
RATE_LIMIT  = 30
RATE_WINDOW = 60
rate_data   = defaultdict(list)

client = OpenAI(api_key=REGOLO_API_KEY, base_url="https://api.regolo.ai/v1")


# ════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════

def get_db():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    return conn

def check_rate_limit(ip: str):
    now          = datetime.now()
    window_start = now - timedelta(seconds=RATE_WINDOW)
    rate_data[ip] = [t for t in rate_data[ip] if t > window_start]
    if len(rate_data[ip]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Troppe richieste. Riprova tra poco.")
    rate_data[ip].append(now)

def crea_token(utente_id: int, username: str, ruolo: str) -> str:
    payload = {
        "sub": str(utente_id),
        "username": username,
        "ruolo": ruolo,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verifica_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except Exception:
        raise HTTPException(status_code=401, detail="Token non valido")

def get_utente_corrente(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante")
    token = authorization.split(" ")[1]
    return verifica_token(token)

def richiede_admin(utente: dict = Depends(get_utente_corrente)) -> dict:
    if utente.get("ruolo") != "admin":
        raise HTTPException(status_code=403, detail="Accesso riservato agli amministratori")
    return utente

def log_azione(utente_id: int, azione: str, ip: str, dettagli: str = None):
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO log_accessi (utente_id, azione, ip, dettagli) VALUES (%s, %s, %s, %s)",
            (utente_id, azione, ip, dettagli)
        )
        cur.close()
        conn.close()
    except Exception:
        pass

def get_system_prompt() -> str:
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT valore FROM config_ai WHERE chiave = 'system_prompt'")
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row[0] if row else "Sei un assistente AI al servizio del Cammino Neocatecumenale."
    except Exception:
        return "Sei un assistente AI al servizio del Cammino Neocatecumenale."

def get_embedding(testo: str):
    response = client.embeddings.create(input=testo[:8000], model=EMBED_MODEL)
    return response.data[0].embedding

def chiama_llm(messages: list) -> str:
    for model in LLM_MODELS:
        try:
            risposta = client.chat.completions.create(
                model=model, messages=messages, max_tokens=1000
            )
            return risposta.choices[0].message.content
        except Exception as e:
            print(f"Modello {model} non disponibile: {e}")
            continue
    raise HTTPException(status_code=503, detail="Nessun modello AI disponibile. Riprova tra qualche minuto.")


# ════════════════════════════════════════════════════════
# MODELLI PYDANTIC
# ════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    username: str
    password: str

class Domanda(BaseModel):
    testo: str

class NuovoUtente(BaseModel):
    username: str
    password: str
    ruolo: str = "user"

class ModificaUtente(BaseModel):
    password: Optional[str] = None
    ruolo: Optional[str] = None
    attivo: Optional[bool] = None

class ConfigAI(BaseModel):
    system_prompt: str


# ════════════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════════════

@app.post("/auth/login")
async def login(dati: LoginRequest, request: Request):
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM utenti WHERE username = %s AND attivo = TRUE", (dati.username,))
    utente = cur.fetchone()
    cur.close()
    conn.close()

    if not utente:
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    password_ok = bcrypt.checkpw(
        dati.password.encode(),
        utente["password"].encode()
    )
    if not password_ok:
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    # Aggiorna ultimo accesso
    conn2 = get_db()
    cur2  = conn2.cursor()
    cur2.execute("UPDATE utenti SET ultimo_accesso = NOW() WHERE id = %s", (utente["id"],))
    cur2.close()
    conn2.close()

    log_azione(utente["id"], "login", request.client.host)

    token = crea_token(utente["id"], utente["username"], utente["ruolo"])
    return {
        "token": token,
        "username": utente["username"],
        "ruolo": utente["ruolo"]
    }

@app.get("/auth/me")
async def chi_sono(utente: dict = Depends(get_utente_corrente)):
    return {"username": utente["username"], "ruolo": utente["ruolo"]}


# ════════════════════════════════════════════════════════
# RICERCA AI
# ════════════════════════════════════════════════════════

@app.post("/cerca")
async def cerca(
    domanda: Domanda,
    request: Request,
    utente: dict = Depends(get_utente_corrente)
):
    check_rate_limit(request.client.host)

    embedding = get_embedding(domanda.testo)

    conn = get_db()
    cur  = conn.cursor()
    cur.execute("""
        SELECT d.id, d.nome_file, d.testo, d.file_originale,
               1 - (e.embedding <=> %s::vector) AS similarita
        FROM embeddings e
        JOIN documenti d ON d.id = e.documento_id
        ORDER BY e.embedding <=> %s::vector
        LIMIT 5
    """, (embedding, embedding))
    docs = cur.fetchall()
    cur.close()
    conn.close()

    contesto = ""
    fonti    = []
    for doc_id, nome, testo, originale, sim in docs:
        contesto += f"\n--- {nome} ---\n{testo[:1000]}\n"
        fonti.append({
            "id": doc_id,
            "nome": nome,
            "file_originale": originale,
            "similarita": round(sim, 3)
        })

    system_prompt = get_system_prompt()
    testo_risposta = chiama_llm([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Documenti:\n{contesto}\n\nDomanda: {domanda.testo}"}
    ])

    log_azione(int(utente["sub"]), "ricerca", request.client.host, domanda.testo[:200])

    return {"risposta": testo_risposta, "fonti": fonti}


# ════════════════════════════════════════════════════════
# LIBRERIA DOCUMENTI
# ════════════════════════════════════════════════════════

@app.get("/documenti")
async def lista_documenti(
    pagina: int = 1,
    per_pagina: int = 50,
    cerca: str = None,
    utente: dict = Depends(get_utente_corrente)
):
    offset = (pagina - 1) * per_pagina
    conn   = get_db()
    cur    = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if cerca:
        cur.execute("""
            SELECT id, nome_file, file_originale, creato_il,
                   LEFT(testo, 200) AS anteprima
            FROM documenti
            WHERE testo ILIKE %s OR nome_file ILIKE %s
            ORDER BY nome_file
            LIMIT %s OFFSET %s
        """, (f"%{cerca}%", f"%{cerca}%", per_pagina, offset))
    else:
        cur.execute("""
            SELECT id, nome_file, file_originale, creato_il,
                   LEFT(testo, 200) AS anteprima
            FROM documenti
            ORDER BY nome_file
            LIMIT %s OFFSET %s
        """, (per_pagina, offset))

    documenti = cur.fetchall()

    cur.execute("SELECT COUNT(*) FROM documenti")
    totale = cur.fetchone()["count"]

    cur.close()
    conn.close()

    return {
        "documenti": [dict(d) for d in documenti],
        "totale": totale,
        "pagina": pagina,
        "pagine": (totale + per_pagina - 1) // per_pagina
    }

@app.get("/documento/{doc_id}")
async def get_documento(
    doc_id: int,
    utente: dict = Depends(get_utente_corrente)
):
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM documenti WHERE id = %s", (doc_id,))
    doc = cur.fetchone()
    cur.close()
    conn.close()

    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    return dict(doc)

@app.get("/originale/{doc_id}")
async def scarica_originale(
    doc_id: int,
    utente: dict = Depends(get_utente_corrente)
):
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("SELECT nome_file, file_originale FROM documenti WHERE id = %s", (doc_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    file_originale = row[1]
    if not file_originale or not Path(file_originale).exists():
        raise HTTPException(status_code=404, detail="File originale non disponibile")

    return FileResponse(
        path=file_originale,
        filename=Path(file_originale).name,
        media_type="application/octet-stream"
    )


# ════════════════════════════════════════════════════════
# ADMIN — UTENTI
# ════════════════════════════════════════════════════════

@app.get("/admin/utenti")
async def lista_utenti(admin: dict = Depends(richiede_admin)):
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, username, ruolo, attivo, creato_il, ultimo_accesso FROM utenti ORDER BY creato_il DESC")
    utenti = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(u) for u in utenti]

@app.post("/admin/utenti")
async def crea_utente(dati: NuovoUtente, admin: dict = Depends(richiede_admin)):
    if dati.ruolo not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Ruolo non valido")

    hash_pw = bcrypt.hashpw(dati.password.encode(), bcrypt.gensalt()).decode()

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO utenti (username, password, ruolo) VALUES (%s, %s, %s) RETURNING id",
            (dati.username, hash_pw, dati.ruolo)
        )
        nuovo_id = cur.fetchone()[0]
    except psycopg2.IntegrityError:
        raise HTTPException(status_code=400, detail="Username già esistente")
    finally:
        cur.close()
        conn.close()

    return {"id": nuovo_id, "messaggio": "Utente creato"}

@app.put("/admin/utenti/{utente_id}")
async def modifica_utente(
    utente_id: int,
    dati: ModificaUtente,
    admin: dict = Depends(richiede_admin)
):
    conn = get_db()
    cur  = conn.cursor()

    if dati.password:
        hash_pw = bcrypt.hashpw(dati.password.encode(), bcrypt.gensalt()).decode()
        cur.execute("UPDATE utenti SET password = %s WHERE id = %s", (hash_pw, utente_id))

    if dati.ruolo:
        cur.execute("UPDATE utenti SET ruolo = %s WHERE id = %s", (dati.ruolo, utente_id))

    if dati.attivo is not None:
        cur.execute("UPDATE utenti SET attivo = %s WHERE id = %s", (dati.attivo, utente_id))

    cur.close()
    conn.close()
    return {"messaggio": "Utente aggiornato"}

@app.delete("/admin/utenti/{utente_id}")
async def elimina_utente(utente_id: int, admin: dict = Depends(richiede_admin)):
    if int(admin["sub"]) == utente_id:
        raise HTTPException(status_code=400, detail="Non puoi eliminare te stesso")
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("DELETE FROM utenti WHERE id = %s", (utente_id,))
    cur.close()
    conn.close()
    return {"messaggio": "Utente eliminato"}


# ════════════════════════════════════════════════════════
# ADMIN — UPLOAD DOCUMENTI
# ════════════════════════════════════════════════════════

@app.post("/admin/upload")
async def upload_documento(
    file: UploadFile = File(...),
    admin: dict = Depends(richiede_admin)
):
    estensioni_ok = [".pdf", ".docx", ".doc", ".txt", ".jpg", ".jpeg", ".png", ".tif", ".tiff"]
    ext = Path(file.filename).suffix.lower()
    if ext not in estensioni_ok:
        raise HTTPException(status_code=400, detail=f"Formato non supportato: {ext}")

    # Salva file temporaneo
    tmp_path = UPLOAD_DIR / file.filename
    with open(tmp_path, "wb") as f:
        f.write(await file.read())

    # Copia negli originali
    dest_originale = ORIGINALI_DIR / file.filename
    shutil.copy2(tmp_path, dest_originale)

    # Estrai testo
    testo = ""
    if ext == ".txt":
        testo = tmp_path.read_text(encoding="utf-8", errors="ignore")
    else:
        # Per altri formati — da implementare con Tesseract/pypdf
        testo = f"[File originale: {file.filename}. Testo da estrarre.]"

    if testo.strip():
        embedding = get_embedding(testo[:8000])

        conn = get_db()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO documenti (nome_file, testo, file_originale) VALUES (%s, %s, %s) RETURNING id",
            (file.filename, testo, str(dest_originale))
        )
        doc_id = cur.fetchone()[0]

        cur.execute(
            "INSERT INTO embeddings (documento_id, chunk_testo, embedding) VALUES (%s, %s, %s)",
            (doc_id, testo[:500], embedding)
        )
        cur.close()
        conn.close()

    tmp_path.unlink(missing_ok=True)

    return {"messaggio": f"Documento '{file.filename}' caricato con successo"}


# ════════════════════════════════════════════════════════
# ADMIN — CONFIGURAZIONE AI
# ════════════════════════════════════════════════════════

@app.get("/admin/ai")
async def get_config_ai(admin: dict = Depends(richiede_admin)):
    return {"system_prompt": get_system_prompt()}

@app.put("/admin/ai")
async def update_config_ai(config: ConfigAI, admin: dict = Depends(richiede_admin)):
    conn = get_db()
    cur  = conn.cursor()
    cur.execute(
        "UPDATE config_ai SET valore = %s, modificato_il = NOW() WHERE chiave = 'system_prompt'",
        (config.system_prompt,)
    )
    cur.close()
    conn.close()
    return {"messaggio": "System prompt aggiornato"}


# ════════════════════════════════════════════════════════
# ADMIN — LOG ACCESSI
# ════════════════════════════════════════════════════════

@app.get("/admin/log")
async def get_log(
    pagina: int = 1,
    per_pagina: int = 100,
    admin: dict = Depends(richiede_admin)
):
    offset = (pagina - 1) * per_pagina
    conn   = get_db()
    cur    = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT l.id, u.username, l.azione, l.ip, l.dettagli, l.creato_il
        FROM log_accessi l
        LEFT JOIN utenti u ON u.id = l.utente_id
        ORDER BY l.creato_il DESC
        LIMIT %s OFFSET %s
    """, (per_pagina, offset))
    logs = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(l) for l in logs]


# ════════════════════════════════════════════════════════
# ADMIN — STATO SERVER
# ════════════════════════════════════════════════════════

@app.get("/admin/stato")
async def stato_server(admin: dict = Depends(richiede_admin)):
    servizi = {}
    
    # 1. Verifica Postgresql (Controllo funzionamento effettivo tramite connessione)
    try:
        conn_test = get_db()
        conn_test.close()
        servizi["postgresql"] = True
    except Exception:
        servizi["postgresql"] = False
        
    # 2. Verifica Nginx (Controllo tramite systemctl con gestione errori)
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "nginx"],
            capture_output=True, text=True, timeout=2
        )
        servizi["nginx"] = result.stdout.strip() == "active"
    except Exception:
        servizi["nginx"] = False
        
    # 3. Verifica Docapp (Se questa funzione risponde, il backend è attivo)
    servizi["docapp"] = True

    # Statistiche DB
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM documenti")
        tot_documenti = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM utenti WHERE attivo = TRUE")
        tot_utenti = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM log_accessi WHERE creato_il > NOW() - INTERVAL '24 hours'")
        ricerche_oggi = cur.fetchone()[0]
        cur.close()
        conn.close()
    except Exception:
        tot_documenti = 0
        tot_utenti = 0
        ricerche_oggi = 0

    # Spazio disco
    try:
        disk = shutil.disk_usage("/")
        disco = {
            "totale_gb": round(disk.total / 1e9, 1),
            "usato_gb": round(disk.used / 1e9, 1),
            "libero_gb": round(disk.free / 1e9, 1),
            "percentuale": round(disk.used / disk.total * 100, 1)
        }
    except Exception:
        disco = {"totale_gb": 0, "usato_gb": 0, "libero_gb": 0, "percentuale": 0}

    return {
        "servizi": servizi,
        "database": {
            "documenti": tot_documenti,
            "utenti_attivi": tot_utenti,
            "ricerche_oggi": ricerche_oggi
        },
        "disco": disco
    }


# ════════════════════════════════════════════════════════
# ADMIN — BACKUP
# ════════════════════════════════════════════════════════

@app.get("/admin/backup")
async def lista_backup(admin: dict = Depends(richiede_admin)):
    backups = []
    for f in sorted(BACKUP_DIR.glob("docdb_*.sql.gz"), reverse=True):
        stat = f.stat()
        backups.append({
            "nome": f.name,
            "dimensione_mb": round(stat.st_size / 1e6, 1),
            "data": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    return backups

@app.post("/admin/backup")
async def esegui_backup(admin: dict = Depends(richiede_admin)):
    try:
        result = subprocess.run(
            ["/opt/backups/backup_db.sh"],
            capture_output=True, text=True
        )
        return {"messaggio": result.stdout.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/backup/{nome_file}")
async def scarica_backup(nome_file: str, admin: dict = Depends(richiede_admin)):
    backup_path = BACKUP_DIR / nome_file
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup non trovato")
    return FileResponse(
        path=str(backup_path),
        filename=nome_file,
        media_type="application/gzip"
    )


# ════════════════════════════════════════════════════════
# ROOT
# ════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {"status": "ok", "messaggio": "Archivio Cammino Neocatecumenale API"}
