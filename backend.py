"""
backend.py - FastAPI Archivio Cammino Neocatecumenale
Versione completa con autenticazione JWT, gestione utenti,
documenti, admin panel, backup, log accessi.
"""
import time
import requests as req_lib
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
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
import pypdf
from docx import Document

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

# Crea tabella consumi_ai al primo avvio se non esiste
@app.on_event("startup")
async def init_db():
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS consumi_ai (
                id SERIAL PRIMARY KEY,
                utente_id INTEGER,
                modello VARCHAR(50),
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                totale_tokens INTEGER DEFAULT 0,
                costo_stimato NUMERIC(10,6) DEFAULT 0,
                creato_il TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[startup] Errore init consumi_ai: {e}")
REGOLO_API_KEY = "sk-zWOHzCbqQtP20Gcc5DDKAA"
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
REGOLO_API_KEY = "sk-zWOHzCbqQtP20Gcc5DDKAA"
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

# Stato riparazione globale
REPAIR_STATUS = {
    "attivo": False,
    "totale": 0,
    "corrente": 0,
    "ultimo_file": ""
}


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

def estrai_testo(percorso: Path) -> str:
    """Estrae testo da .pdf, .docx o .txt"""
    ext = percorso.suffix.lower()
    testo = ""
    try:
        if ext == ".txt":
            testo = percorso.read_text(encoding="utf-8", errors="ignore")
        elif ext == ".pdf":
            reader = pypdf.PdfReader(str(percorso))
            testo = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
        elif ext in [".docx", ".doc"]:
            doc = Document(str(percorso))
            testo = "\n".join([p.text for p in doc.paragraphs])
    except Exception as e:
        print(f"Errore estrazione testo da {percorso}: {e}")
    return testo.strip()

def chunk_testo(testo: str, dimensione: int = 1500, overlap: int = 200) -> list:
    """Divide il testo in blocchi con sovrapposizione"""
    if not testo: return []
    chunks = []
    start = 0
    while start < len(testo):
        end = start + dimensione
        chunks.append(testo[start:end])
        start += (dimensione - overlap)
    return chunks

def get_embedding(testo: str, utente_id: int = 0):
    response = client.embeddings.create(input=testo[:8000], model=EMBED_MODEL)
    # Tracking consumi embedding
    try:
        if hasattr(response, 'usage') and response.usage:
            uso = response.usage
            costo = round((uso.total_tokens / 1_000_000) * 0.10, 6)
            conn = get_db(); cur = conn.cursor()
            cur.execute(
                "INSERT INTO consumi_ai (utente_id, modello, prompt_tokens, totale_tokens, costo_stimato) VALUES (%s,%s,%s,%s,%s)",
                (utente_id, EMBED_MODEL, uso.total_tokens, uso.total_tokens, costo)
            )
            cur.close(); conn.close()
    except Exception:
        pass
    return response.data[0].embedding

def chiama_llm(messages: list, utente_id: int = 0, temperatura: float = 0.7) -> str:
    for model in LLM_MODELS:
        try:
            risposta = client.chat.completions.create(
                model=model, messages=messages, max_tokens=1000, temperature=temperatura
            )
            content = risposta.choices[0].message.content
            # Tracking consumi LLM
            try:
                uso   = risposta.usage
                costo = round((uso.total_tokens / 1_000_000) * 0.20, 6)
                conn  = get_db(); cur = conn.cursor()
                cur.execute(
                    "INSERT INTO consumi_ai (utente_id, modello, prompt_tokens, completion_tokens, totale_tokens, costo_stimato) VALUES (%s,%s,%s,%s,%s,%s)",
                    (utente_id, model, uso.prompt_tokens, uso.completion_tokens, uso.total_tokens, costo)
                )
                cur.close(); conn.close()
            except Exception:
                pass
            return content
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

class TestoSemplice(BaseModel):
    testo: str

class Domanda(BaseModel):
    testo: str
    pagina_altri: int = 1
    categorie: Optional[list[str]] = None

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
# CORREZIONE ORTOGRAFICA AI
# ════════════════════════════════════════════════════════

@app.post("/correggi")
async def correggi_testo(body: TestoSemplice, utente: dict = Depends(get_utente_corrente)):
    testo = body.testo.strip()
    if not testo or len(testo) < 4:
        return {"corretto": testo, "modificato": False}

    risposta = chiama_llm([
        {"role": "system", "content": (
            "Sei uno strumento di correzione ortografica automatica. "
            "Il tuo UNICO compito è correggere errori di battitura e ortografia. "
            "REGOLE ASSOLUTE:\n"
            "1. Restituisci SOLO il testo con gli errori di battitura corretti.\n"
            "2. NON rispondere mai alla domanda nel testo.\n"
            "3. NON aggiungere spiegazioni, commenti, virgolette.\n"
            "4. NON cambiare il significato o la struttura della frase.\n"
            "5. Se non ci sono errori di battitura, restituisci il testo IDENTICO.\n"
            "6. Se l'input è una domanda, restituiscila corretta ortograficamente, NON risponderla.\n"
            "Esempio: 'elncami i viaggi di kiko' \u2192 'elencami i viaggi di kiko'"
        )},
        {"role": "user", "content": f"Correggi solo la battitura: {testo}"}
    ], int(utente["sub"]), temperatura=0.0)

    corretto = risposta.strip().strip('"').strip("'")

    # Sanity check: se la risposta è molto più lunga dell'input,
    # l'AI ha risposto alla domanda invece di correggerla → ignora
    if len(corretto) > len(testo) * 1.8 or '\n' in corretto:
        return {"corretto": testo, "modificato": False}

    return {"corretto": corretto, "modificato": corretto.lower() != testo.lower()}


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

    # 0. Costruisce filtro categorie
    # Se la lista è vuota o 'Tutte le fonti' è selezionato, cerchiamo su tutto (cat_where rimane vuoto)
    cat_where = ""
    cat_params = []
    if domanda.categorie and len(domanda.categorie) > 0:
        cat_where = " AND d.categoria IN %s "
        cat_params = [tuple(domanda.categorie)]

    # 1. Conta TUTTI i documenti rilevanti (soglia minima similarità 0.3)
    cur.execute(f"""
        SELECT COUNT(DISTINCT d.id)
        FROM embeddings e
        JOIN documenti d ON d.id = e.documento_id
        WHERE 1 - (e.embedding <=> %s::vector) > 0.3
        {cat_where}
    """, [embedding] + cat_params)
    totale_trovati = cur.fetchone()[0]

    # 2. Ricerca vettoriale — TOP 100 per selezione successiva
    cur.execute(f"""
        SELECT DISTINCT ON (d.id)
               d.id, d.nome_file, d.testo, d.file_originale,
               1 - (e.embedding <=> %s::vector) AS similarita,
               d.categoria
        FROM embeddings e
        JOIN documenti d ON d.id = e.documento_id
        WHERE 1=1 {cat_where}
        ORDER BY d.id, e.embedding <=> %s::vector
        LIMIT 100
    """, [embedding] + cat_params + [embedding])
    tutti = cur.fetchall()

    # Ordina per similarità e prendi i top 20 per l'AI
    tutti_ordinati = sorted(tutti, key=lambda x: x[4], reverse=True)
    docs_ai   = tutti_ordinati[:20]
    docs_altri = tutti_ordinati[20:]

    # 3. Ricerca testuale esatta — aggiunge documenti non trovati dal vettore
    parole = [p for p in domanda.testo.split() if len(p) > 3]
    if parole:
        like_query = " OR ".join(["d.testo ILIKE %s OR d.nome_file ILIKE %s"] * len(parole))
        params = []
        for p in parole:
            params.extend([f"%{p}%", f"%{p}%"])
        cur.execute(f"""
            SELECT d.id, d.nome_file, d.testo, d.file_originale, 0.85 AS similarita, d.categoria
            FROM documenti d
            WHERE ({like_query}) {cat_where}
            LIMIT 30
        """, params + cat_params)
        testo_docs = cur.fetchall()

        # Aggiunge solo quelli non già trovati
        ids_trovati = set(d[0] for d in tutti_ordinati)
        for doc in testo_docs:
            if doc[0] not in ids_trovati:
                docs_altri.append(doc)
                ids_trovati.add(doc[0])
                totale_trovati += 1

    cur.close()
    conn.close()

    # 4. Costruisce contesto per l'AI (solo i top 20)
    contesto = ""
    fonti_ai = []
    for doc_id, nome, testo, originale, sim, cat in docs_ai:
        contesto += f"\n--- {nome} (Raccolta: {cat}) ---\n{testo[:800]}\n"
        fonti_ai.append({
            "id": doc_id,
            "nome": nome,
            "file_originale": originale,
            "similarita": round(sim, 3),
            "categoria": cat
        })

    # 5. Prepara gli altri documenti paginati (20 per volta)
    per_pagina_altri = 20
    offset_altri = (domanda.pagina_altri - 1) * per_pagina_altri
    slice_altri = docs_altri[offset_altri:offset_altri + per_pagina_altri]

    altri_documenti = []
    for doc_id, nome, testo, originale, sim, cat in slice_altri:
        altri_documenti.append({
            "id": doc_id,
            "nome": nome,
            "file_originale": originale,
            "similarita": round(sim, 3),
            "anteprima": (testo or "")[:150],
            "categoria": cat
        })

    # 6. Chiama LLM
    avviso_parziale = f"\n\nATTENZIONE: Stai analizzando i 20 documenti più rilevanti su {totale_trovati} totali trovati. Segnala all'utente che la risposta potrebbe essere parziale."
    system_prompt = get_system_prompt()
    testo_risposta = chiama_llm([
        {"role": "system", "content": system_prompt + avviso_parziale},
        {"role": "user", "content": f"Documenti:\n{contesto}\n\nDomanda: {domanda.testo}"}
    ])

    log_azione(int(utente["sub"]), "ricerca", request.client.host, domanda.testo[:200])

    return {
        "risposta": testo_risposta,
        "fonti": fonti_ai,
        "totale_trovati": totale_trovati,
        "documenti_usati_ai": len(fonti_ai),
        "altri_documenti": altri_documenti,
        "altri_pagina": domanda.pagina_altri,
        "altri_pagine_totali": max(1, (len(docs_altri) + per_pagina_altri - 1) // per_pagina_altri)
    }


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

    # Estrazione testo reale
    testo_completo = estrai_testo(tmp_path)
    
    if testo_completo:
        conn = get_db()
        cur  = conn.cursor()
        
        # Inserisce documento padre
        cur.execute(
            "INSERT INTO documenti (nome_file, testo, file_originale) VALUES (%s, %s, %s) RETURNING id",
            (file.filename, testo_completo, str(dest_originale))
        )
        doc_id = cur.fetchone()[0]

        # Splitta in chunks e crea embeddings per ciascuno
        chunks = chunk_testo(testo_completo)
        for chunk in chunks:
            embedding = get_embedding(chunk)
            cur.execute(
                "INSERT INTO embeddings (documento_id, chunk_testo, embedding) VALUES (%s, %s, %s)",
                (doc_id, chunk[:1000], embedding)
            )
        
        cur.close()
        conn.close()

    tmp_path.unlink(missing_ok=True)
    return {"messaggio": f"Documento '{file.filename}' caricato e indicizzato ({len(testo_completo)} caratteri)"}


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

REPAIR_STATUS = {"attivo": False, "totale": 0, "corrente": 0, "ultimo_file": ""}


def esegui_riparazione_background():
    """Rigenera l'indice in sottofondo senza bloccare il sito."""
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("SELECT id, nome_file, file_originale FROM documenti")
        docs = cur.fetchall()
        REPAIR_STATUS["totale"]   = len(docs)
        REPAIR_STATUS["corrente"] = 0

        for d in docs:
            doc_id = d["id"]
            nome   = d["nome_file"]
            REPAIR_STATUS["ultimo_file"] = nome
            REPAIR_STATUS["corrente"] += 1

            percorso = Path(d["file_originale"]) if d["file_originale"] else None
            if percorso is None or not percorso.exists():
                percorso = ORIGINALI_DIR / nome

            if percorso.exists():
                try:
                    testo_completo = estrai_testo(percorso)
                    if not testo_completo:
                        continue
                    cur.execute("UPDATE documenti SET testo = %s WHERE id = %s", (testo_completo, doc_id))
                    cur.execute("DELETE FROM embeddings WHERE documento_id = %s", (doc_id,))
                    chunks = chunk_testo(testo_completo)
                    for chunk in chunks:
                        emb = get_embedding(chunk)
                        cur.execute(
                            "INSERT INTO embeddings (documento_id, chunk_testo, embedding) VALUES (%s, %s, %s)",
                            (doc_id, chunk[:1000], emb)
                        )
                    conn.commit()
                    time.sleep(0.1)
                except Exception as e:
                    print(f"Errore riparazione {nome}: {e}")
                    conn.rollback()
    finally:
        REPAIR_STATUS["attivo"] = False
        try:
            cur.close()
            conn.close()
        except Exception:
            pass


@app.post("/admin/ripara")
async def avvia_riparazione(
    bt: BackgroundTasks,
    admin: dict = Depends(richiede_admin)
):
    if REPAIR_STATUS.get("attivo"):
        raise HTTPException(status_code=409, detail="Riparazione gia' in corso")

    conn = get_db()
    cur  = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM documenti")
    totale = cur.fetchone()[0]
    cur.close()
    conn.close()

    REPAIR_STATUS["attivo"]      = True
    REPAIR_STATUS["totale"]      = totale
    REPAIR_STATUS["corrente"]    = 0
    REPAIR_STATUS["ultimo_file"] = "Avvio in corso..."

    bt.add_task(esegui_riparazione_background)
    return {
        "messaggio": f"Riparazione avviata per {totale} documenti.",
        "totale": totale
    }


@app.get("/admin/ripara-status")
async def ripara_status(utente: dict = Depends(richiede_admin)):
    return REPAIR_STATUS


    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Breakdown per modello
    try:
        cur.execute("""
            SELECT
                modello,
                COUNT(*)                           AS chiamate,
                COALESCE(SUM(prompt_tokens),0)     AS prompt_tokens,
                COALESCE(SUM(completion_tokens),0) AS completion_tokens,
                COALESCE(SUM(totale_tokens),0)     AS totale_tokens,
                COALESCE(SUM(costo_stimato),0)     AS costo_stimato,
                MIN(creato_il)                     AS prima_chiamata,
                MAX(creato_il)                     AS ultima_chiamata
            FROM consumi_ai
            GROUP BY modello
            ORDER BY costo_stimato DESC
        """)
        per_modello = [dict(r) for r in cur.fetchall()]
    except Exception:
        per_modello = []

    # Ultime 50 operazioni con dettaglio
    try:
        cur.execute("""
            SELECT
                c.id, u.username, c.modello,
                c.prompt_tokens, c.completion_tokens, c.totale_tokens,
                c.costo_stimato, c.creato_il
            FROM consumi_ai c
            LEFT JOIN utenti u ON u.id = c.utente_id
            ORDER BY c.creato_il DESC
            LIMIT 50
        """)
        recenti = [dict(r) for r in cur.fetchall()]
    except Exception:
        recenti = []

    # Totale generale
    try:
        cur.execute("""
            SELECT
                COALESCE(SUM(totale_tokens),0) AS tot_tokens,
                COALESCE(SUM(costo_stimato),0) AS tot_costo,
                COUNT(*) AS tot_chiamate
            FROM consumi_ai
        """)
        row = cur.fetchone()
        totale = {
            "token":    int(row["tot_tokens"]),
            "costo":    float(row["tot_costo"]),
            "chiamate": int(row["tot_chiamate"])
        }
    except Exception:
        totale = {"token": 0, "costo": 0.0, "chiamate": 0}


    cur.close()
    conn.close()
    return {
        "per_modello": per_modello,
        "recenti": recenti,
        "totale": totale,
        "nota": "I dati mostrano i consumi tracciati localmente dal sistema. Per i dati storici completi visita dashboard.regolo.ai"
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


# ════════════════════════════════════════════════════════
# ADMIN — WEB SCRAPER
# ════════════════════════════════════════════════════════

from bs4 import BeautifulSoup
import requests as req_lib
from urllib.parse import urljoin, urlparse

class Scraper(BaseModel):
    url: str
    profondita: int = 2
    max_pagine: int = 200

@app.post("/admin/scraper")
async def avvia_scraper(dati: Scraper, admin: dict = Depends(richiede_admin)):
    url_base = dati.url.strip()
    if not url_base.startswith("http"):
        url_base = "https://" + url_base
    dominio = urlparse(url_base).netloc
    visitati = set()
    da_visitare = [(url_base, 0)]
    pagine_indicizzate = 0
    errori = 0
    log = []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; CNCAI-Scraper/1.0)"}
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS siti_scraper (
        id SERIAL PRIMARY KEY, url TEXT, dominio TEXT,
        pagine_indicizzate INTEGER DEFAULT 0,
        ultimo_scraping TIMESTAMP DEFAULT NOW())""")
    while da_visitare and pagine_indicizzate < dati.max_pagine:
        url_corrente, livello = da_visitare.pop(0)
        if url_corrente in visitati or livello > dati.profondita:
            continue
        visitati.add(url_corrente)
        try:
            resp = req_lib.get(url_corrente, headers=headers, timeout=10)
            if resp.status_code != 200:
                continue
            if "text/html" not in resp.headers.get("content-type", ""):
                continue
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script","style","nav","footer","header"]):
                tag.decompose()
            testo = soup.get_text(separator="\n", strip=True)
            testo = "\n".join(l for l in testo.splitlines() if len(l.strip()) > 20)
            if len(testo) < 100:
                continue
            title = soup.find("title")
            nome_doc = (title.get_text().strip() if title else url_corrente)[:100] + ".txt"
            
            cur.execute(
                "INSERT INTO documenti (nome_file, testo, file_originale, categoria) VALUES (%s,%s,%s,%s) RETURNING id",
                (nome_doc, testo, url_corrente, f"Web: {dominio}")
            )
            doc_id = cur.fetchone()[0]
            
            # Indicizzazione a chunks anche per lo scraper
            chunks = chunk_testo(testo)
            for chunk in chunks:
                embedding = get_embedding(chunk)
                cur.execute(
                    "INSERT INTO embeddings (documento_id, chunk_testo, embedding) VALUES (%s,%s,%s)",
                    (doc_id, chunk[:1000], embedding)
                )
            
            pagine_indicizzate += 1
            log.append(f"OK [{pagine_indicizzate}] {nome_doc}")
            if livello < dati.profondita:
                for a in soup.find_all("a", href=True):
                    link = urljoin(url_corrente, a["href"])
                    parsed = urlparse(link)
                    if parsed.netloc == dominio and link not in visitati:
                        if not any(ext in link for ext in [".pdf",".jpg",".png",".zip",".mp4"]):
                            da_visitare.append((link, livello + 1))
        except Exception as e:
            errori += 1
            log.append(f"ERR: {url_corrente[:50]} - {str(e)[:40]}")
    cur.execute(
        "INSERT INTO siti_scraper (url, dominio, pagine_indicizzate) VALUES (%s,%s,%s)",
        (url_base, dominio, pagine_indicizzate)
    )
    cur.close()
    conn.close()
    return {
        "pagine_indicizzate": pagine_indicizzate,
        "errori": errori,
        "dominio": dominio,
        "log": log[-50:]
    }

@app.get("/admin/scraper")
async def lista_siti_scraper(admin: dict = Depends(richiede_admin)):
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("SELECT * FROM siti_scraper ORDER BY ultimo_scraping DESC")
        siti = cur.fetchall()
    except Exception:
        siti = []
    cur.close()
    conn.close()
    return [dict(s) for s in siti]

@app.get("/libreria")
async def libreria(
    pagina: int = 1,
    per_pagina: int = 50,
    cerca: str = None,
    categoria: str = None,
    utente: dict = Depends(get_utente_corrente)
):
    offset = (pagina - 1) * per_pagina
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    conditions = []
    params_q   = []
    if cerca:
        conditions.append("(testo ILIKE %s OR nome_file ILIKE %s)")
        params_q.extend([f"%{cerca}%", f"%{cerca}%"])
    if categoria:
        conditions.append("categoria = %s")
        params_q.append(categoria)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    cur.execute(f"SELECT COUNT(*) FROM documenti {where}", params_q)
    totale = cur.fetchone()["count"]
    cur.execute(f"""
        SELECT id, nome_file, file_originale, creato_il, categoria,
               LEFT(testo, 200) AS anteprima
        FROM documenti {where}
        ORDER BY nome_file
        LIMIT %s OFFSET %s
    """, params_q + [per_pagina, offset])
    documenti = cur.fetchall()
    cur.close()
    conn.close()
    return {
        "documenti": [dict(d) for d in documenti],
        "totale": totale,
        "pagina": pagina,
        "pagine": (totale + per_pagina - 1) // per_pagina
    }

@app.get("/categorie")
async def get_categorie(utente: dict = Depends(get_utente_corrente)):
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT categoria, COUNT(*) as totale
            FROM documenti
            WHERE categoria IS NOT NULL AND categoria != ''
            GROUP BY categoria
            ORDER BY categoria
        """)
        cats = [{"nome": row[0], "totale": row[1]} for row in cur.fetchall()]
    except Exception:
        cats = []
    cur.close()
    conn.close()
    return cats

@app.put("/admin/categorie/{nome}")
async def rinomina_categoria(nome: str, payload: dict, admin: dict = Depends(richiede_admin)):
    """Rinomina una categoria — aggiorna tutti i documenti che la usano"""
    nuovo = payload.get("nuovo_nome", "").strip()
    if not nuovo:
        raise HTTPException(status_code=400, detail="Nome vuoto")
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("UPDATE documenti SET categoria = %s WHERE categoria = %s", (nuovo, nome))
    conn.commit()
    cur.close()
    conn.close()
    return {"messaggio": f"Categoria rinominata in '{nuovo}'"}

@app.delete("/admin/categorie/{nome}")
async def elimina_categoria(nome: str, admin: dict = Depends(richiede_admin)):
    """Elimina tutti i documenti di una categoria e i relativi embedding"""
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("""
        DELETE FROM embeddings
        WHERE documento_id IN (SELECT id FROM documenti WHERE categoria = %s)
    """, (nome,))
    cur.execute("DELETE FROM documenti WHERE categoria = %s", (nome,))
    conn.commit()
    cur.close()
    conn.close()
    return {"messaggio": f"Categoria '{nome}' eliminata"}

@app.delete("/admin/documenti/{doc_id}")
async def elimina_documento(doc_id: int, admin: dict = Depends(richiede_admin)):
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("SELECT file_originale FROM documenti WHERE id = %s", (doc_id,))
    row = cur.fetchone()
    if row and row[0]:
        try: Path(row[0]).unlink(missing_ok=True)
        except Exception: pass
    cur.execute("DELETE FROM embeddings WHERE documento_id = %s", (doc_id,))
    cur.execute("DELETE FROM documenti WHERE id = %s", (doc_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"messaggio": "Documento eliminato"}

