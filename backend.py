"""
backend.py - FastAPI Archivio Cammino Neocatecumenale
Versione completa con autenticazione JWT, gestione utenti,
documenti, admin panel, backup, log accessi.
"""
from fastapi import FastAPI, HTTPException, Header, Request, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List
import psycopg2
import psycopg2.extras
from openai import OpenAI
import bcrypt
import jwt
import os
import subprocess
import shutil

# Estrazione testo da file
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None
try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

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

# Inizializza la tabella dei consumi se non esiste
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
                prompt_tokens INTEGER,
                completion_tokens INTEGER,
                totale_tokens INTEGER,
                costo_stimato NUMERIC(10, 6),
                creato_il TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Errore inizializzazione DB consumi: {e}")

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
    
def chunk_text(text: str, size: int = 2000, overlap: int = 400) -> List[str]:
    if not text: return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += (size - overlap)
        if start >= len(text): break
    return chunks

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
        return row[0] if row else _default_prompt()
    except Exception:
        return _default_prompt()

def _default_prompt() -> str:
    return """Sei un assistente AI esperto dell'archivio storico del Cammino Neocatecumenale.
Hai accesso a migliaia di documenti storici, decreti, lettere e comunicazioni.

Il tuo compito è:
1. Analizzare attentamente TUTTI i documenti forniti nel contesto
2. Rispondere in modo completo e dettagliato alla domanda dell'utente
3. Sintetizzare le informazioni trovate in più documenti
4. Citare il nome dei documenti fonte quando menzioni informazioni specifiche
5. Se un argomento è trattato INDIRETTAMENTE nei documenti, menzionalo comunque
6. Rispondere sempre in italiano, in modo professionale e chiaro
7. Se le informazioni disponibili sono parziali, fornisci ciò che è presente e segnala cosa manca"""

def get_embedding(testo: str, utente_id: int = 1):
    response = client.embeddings.create(input=testo[:8000], model=EMBED_MODEL)
    if hasattr(response, 'usage') and response.usage:
        usage = response.usage
        # Prezzo stimato embedding regolo.ai (es. 0.10$ / 1M token)
        costo = round((usage.total_tokens / 1000000) * 0.10, 6)
        try:
            conn = get_db()
            cur  = conn.cursor()
            cur.execute("""
                INSERT INTO consumi_ai (utente_id, modello, prompt_tokens, completion_tokens, totale_tokens, costo_stimato)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (utente_id, EMBED_MODEL, usage.prompt_tokens, 0, usage.total_tokens, costo))
            cur.close()
            conn.close()
        except:
            pass
    return response.data[0].embedding

def chiama_llm(messages: list, utente_id: int) -> str:
    for model in LLM_MODELS:
        try:
            risposta = client.chat.completions.create(
                model=model, messages=messages, max_tokens=1000
            )
            content = risposta.choices[0].message.content
            usage   = risposta.usage
            
            # Registra i consumi nel database
            try:
                # Prezzo stimato: $0.20 per milione di token (stima conservativa per modelli Regolo)
                costo = round((usage.total_tokens / 1000000) * 0.20, 6)
                conn = get_db()
                cur  = conn.cursor()
                cur.execute("""
                    INSERT INTO consumi_ai (utente_id, modello, prompt_tokens, completion_tokens, totale_tokens, costo_stimato)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (utente_id, model, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens, costo))
                cur.close()
                conn.close()
            except Exception as e:
                print(f"Errore log consumi: {e}")
                
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

class Domanda(BaseModel):
    testo: str
    categorie: Optional[List[str]] = None

class NuovoUtente(BaseModel):
    username: str
    password: str
    ruolo: str = "user"
    email: Optional[str] = None
    note: Optional[str] = None

class ModificaUtente(BaseModel):
    password: Optional[str] = None
    ruolo: Optional[str] = None
    attivo: Optional[bool] = None
    email: Optional[str] = None
    note: Optional[str] = None

class TestoSemplice(BaseModel):
    testo: str

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
        raise HTTPException(status_code=401, detail="Username non trovato o utente disabilitato")

    password_ok = bcrypt.checkpw(
        dati.password.encode(),
        utente["password"].encode()
    )
    if not password_ok:
        raise HTTPException(status_code=401, detail="Password errata")

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
            "Sei un correttore ortografico e grammaticale. "
            "Correggi SOLO gli errori di battitura, digitazione e ortografia nel testo che ti fornisco. "
            "NON modificare il significato, NON aggiungere parole, NON togliere parole. "
            "Restituisci SOLO il testo corretto, senza spiegazioni, senza virgolette, senza commenti. "
            "Se il testo è già corretto, restituiscilo invariato. "
            "Supporta italiano, inglese, spagnolo e latino."
        )},
        {"role": "user", "content": testo}
    ], int(utente["sub"]))
    
    corretto = risposta.strip().strip('"').strip("'")
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

    try:
        categorie = domanda.categorie or []
        
        # Trasforma embedding in stringa per pgvector [v1, v2, ...]
        emb_str = "[" + ",".join(map(str, embedding)) + "]"
        
        # 1. RICERCA VETTORIALE (Somiglianza concettuale) sui SINGOLI CHUNK
        if categorie:
            placeholders = ', '.join(['%s'] * len(categorie))
            query = f"""
                SELECT e.id AS chunk_id, d.id AS doc_id, d.nome_file, e.chunk_testo, d.file_originale,
                       1 - (e.embedding <=> %s::vector) AS similarita
                FROM embeddings e
                JOIN documenti d ON d.id = e.documento_id
                WHERE d.categoria IN ({placeholders})
                ORDER BY e.embedding <=> %s::vector
                LIMIT 8
            """
            cur.execute(query, tuple([emb_str] + list(categorie) + [emb_str]))
        else:
            cur.execute("""
                SELECT e.id AS chunk_id, d.id AS doc_id, d.nome_file, e.chunk_testo, d.file_originale,
                       1 - (e.embedding <=> %s::vector) AS similarita
                FROM embeddings e
                JOIN documenti d ON d.id = e.documento_id
                ORDER BY e.embedding <=> %s::vector
                LIMIT 8
            """, (emb_str, emb_str))

        v_docs = cur.fetchall()

        # 2. RICERCA TESTUALE ESATTA (Sui SINGOLI CHUNK)
        q_testo = "%" + domanda.testo.strip() + "%"
        if categorie:
            query_t = f"""
                SELECT e.id AS chunk_id, d.id AS doc_id, d.nome_file, e.chunk_testo, d.file_originale, 0.95 AS similarita
                FROM embeddings e
                JOIN documenti d ON d.id = e.documento_id
                WHERE d.categoria IN ({placeholders}) AND e.chunk_testo ILIKE %s
                LIMIT 4
            """
            cur.execute(query_t, tuple(list(categorie) + [q_testo]))
        else:
            cur.execute("""
                SELECT e.id AS chunk_id, d.id AS doc_id, d.nome_file, e.chunk_testo, d.file_originale, 0.95 AS similarita
                FROM embeddings e
                JOIN documenti d ON d.id = e.documento_id
                WHERE e.chunk_testo ILIKE %s
                LIMIT 4
            """, (q_testo,))
            
        t_docs = cur.fetchall()
        
    except Exception as e:
        print(f"ERRORE SQL cerca: {e}")
        cur.close(); conn.close()
        raise HTTPException(status_code=500, detail=f"Errore database: {str(e)}")

    cur.close()
    conn.close()

    # Unisci e deduplica i CHUNK (deduplicati per chunk_id, il contesto tiene i frammenti multipli)
    chunks_unici = {}
    for chunk in t_docs + v_docs:
        chunk_id = chunk[0]
        if chunk_id not in chunks_unici:
            chunks_unici[chunk_id] = chunk

    # Ordina per similarità decrescente (similarita è l'ultimo campo)
    chunks = sorted(list(chunks_unici.values()), key=lambda x: x[-1], reverse=True)
    
    if not chunks:
        return {"risposta": "Non ho trovato frammenti rilevanti nei documenti per questa ricerca.", "fonti": []}
    
    contesto_lista = []
    fonti_apparse  = set()
    fonti = []
    
    # Costruiamo il contesto per l'LLM usando i frammenti precisi
    # Ogni riga: chunk_id, doc_id, nome, chunk_testo, originale, similarita
    for row in chunks[:12]:
        chunk_id, doc_id, nome, testo_chunk, originale, sim = row
        testo_pulito = str(testo_chunk) if testo_chunk else ""
        
        contesto_lista.append(f"=== FRAMMENTO TRATTO DAL DOCUMENTO: {nome} ===\n{testo_pulito}\n")
        
        # Fonti uniche per la UI — usiamo il doc_id corretto per i link
        if nome not in fonti_apparse:
            fonti_apparse.add(nome)
            fonti.append({
                "id": doc_id,   # ← ID del DOCUMENTO, non del chunk
                "nome": nome,
                "file_originale": originale,
                "similarita": round(sim, 3)
            })

    contesto = "\n\n".join(contesto_lista)

    system_prompt = get_system_prompt()
    testo_risposta = chiama_llm([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Documenti dell'archivio:\n{contesto}\n\nDomanda: {domanda.testo}\n\nRispondi in modo esaustivo basandoti sui documenti forniti. Cita i nomi dei documenti rilevanti."}
    ], int(utente["sub"]))

    log_azione(int(utente["sub"]), "ricerca", request.client.host, domanda.testo[:200])

    return {"risposta": testo_risposta, "fonti": fonti}


# ════════════════════════════════════════════════════════
# LIBRERIA DOCUMENTI
# ════════════════════════════════════════════════════════

@app.get("/documenti")
async def lista_documenti(
    pagina: int = 1,
    per_pagina: int = 50,
    cerca: Optional[str] = None,
    categoria: Optional[str] = None,
    utente: dict = Depends(get_utente_corrente)
):
    offset = (pagina - 1) * per_pagina
    conn   = get_db()
    cur    = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

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
        FROM documenti
        {where}
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
    cur.execute("SELECT nome_file, file_originale, testo FROM documenti WHERE id = %s", (doc_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Documento non trovato")

    nome_file, file_originale, testo = row

    # 1. Se il file originale esiste fisicamente → lo serve
    if file_originale and Path(file_originale).exists():
        return FileResponse(
            path=file_originale,
            filename=Path(file_originale).name,
            media_type="application/octet-stream"
        )

    # 2. Fallback: serve il testo estratto come file .txt scaricabile
    if testo and testo.strip():
        from fastapi.responses import Response
        nome_txt = Path(nome_file).stem + ".txt"
        return Response(
            content=testo.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{nome_txt}"'}
        )

    # 3. Nessuna risorsa disponibile
    raise HTTPException(status_code=404, detail="Nessun file disponibile per il download")

@app.get("/categorie")
async def lista_categorie(utente: dict = Depends(get_utente_corrente)):
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("""
        SELECT categoria, COUNT(*) as totale
        FROM documenti
        WHERE categoria IS NOT NULL
        GROUP BY categoria
        ORDER BY categoria
    """)
    cats = [{ "nome": row[0], "totale": row[1] } for row in cur.fetchall()]
    cur.close()
    conn.close()
    return cats


# ════════════════════════════════════════════════════════
# ADMIN — UTENTI
# ════════════════════════════════════════════════════════

@app.get("/admin/utenti")
async def lista_utenti(admin: dict = Depends(richiede_admin)):
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, username, email, note, ruolo, attivo, creato_il, ultimo_accesso FROM utenti ORDER BY creato_il DESC")
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
            "INSERT INTO utenti (username, password, ruolo, email, note) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (dati.username, hash_pw, dati.ruolo, dati.email, dati.note)
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

    if dati.email is not None:
        cur.execute("UPDATE utenti SET email = %s WHERE id = %s", (dati.email, utente_id))

    if dati.note is not None:
        cur.execute("UPDATE utenti SET note = %s WHERE id = %s", (dati.note, utente_id))

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
    categoria: str = Form("Generale"),
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

    # Estrai testo reale dal file
    testo = ""
    if ext == ".txt":
        testo = tmp_path.read_text(encoding="utf-8", errors="ignore")

    elif ext == ".pdf":
        if PdfReader:
            try:
                reader = PdfReader(str(tmp_path))
                pagine_testo = []
                for page in reader.pages:
                    t = page.extract_text()
                    if t:
                        pagine_testo.append(t.strip())
                testo = "\n\n".join(pagine_testo)
            except Exception as e:
                print(f"Errore estrazione PDF: {e}")
                testo = f"[PDF: {file.filename} - Errore estrazione: {e}]"
        else:
            testo = f"[PDF: {file.filename} - pypdf non disponibile]"

    elif ext in [".docx"]:
        if DocxDocument:
            try:
                doc = DocxDocument(str(tmp_path))
                testo = "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
            except Exception as e:
                testo = f"[DOCX: {file.filename} - Errore: {e}]"
        else:
            testo = f"[DOCX: {file.filename} - python-docx non disponibile]"

    elif ext in [".doc"]:
        # Prova conversione con antiword o catdoc se disponibile
        try:
            result = subprocess.run(["catdoc", str(tmp_path)], capture_output=True, text=True, timeout=30)
            testo = result.stdout
        except Exception:
            testo = f"[DOC: {file.filename} - conversione non disponibile]"

    elif ext in [".jpg", ".jpeg", ".png", ".tif", ".tiff"]:
        # OCR con tesseract se disponibile
        try:
            result = subprocess.run(
                ["tesseract", str(tmp_path), "stdout", "-l", "ita+eng"],
                capture_output=True, text=True, timeout=60
            )
            testo = result.stdout
            if not testo.strip():
                testo = f"[Immagine: {file.filename} - OCR non ha estratto testo]"
        except Exception as e:
            testo = f"[Immagine: {file.filename} - OCR non disponibile: {e}]"

    if not testo or not testo.strip():
        testo = f"[{file.filename} - nessun testo estratto]"

    # Crea chunks per il RAG (2000 caratteri con overlap)
    chunks = chunk_text(testo)
    if not chunks:
        chunks = [testo]

    conn = get_db()
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO documenti (nome_file, testo, file_originale, categoria) VALUES (%s, %s, %s, %s) RETURNING id",
        (file.filename, testo, str(dest_originale), categoria)
    )
    doc_id = cur.fetchone()[0]

    # Salva ogni chunk con il suo embedding
    for c_text in chunks:
        emb = get_embedding(c_text)
        cur.execute(
            "INSERT INTO embeddings (documento_id, chunk_testo, embedding) VALUES (%s, %s, %s)",
            (doc_id, c_text, emb)
        )
        
    cur.close()
    conn.close()

    tmp_path.unlink(missing_ok=True)

    return {"messaggio": f"Documento '{file.filename}' caricato e indicizzato in {len(chunks)} frammenti."}

@app.delete("/admin/documenti/{doc_id}")
async def elimina_documento(doc_id: int, admin: dict = Depends(richiede_admin)):
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("SELECT file_originale FROM documenti WHERE id = %s", (doc_id,))
    row = cur.fetchone()
    if row and row[0]:
        try:
            Path(row[0]).unlink(missing_ok=True)
        except Exception:
            pass
    cur.execute("DELETE FROM embeddings WHERE documento_id = %s", (doc_id,))
    cur.execute("DELETE FROM documenti WHERE id = %s", (doc_id,))
    cur.close()
    conn.close()
    return {"messaggio": "Documento eliminato"}


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
    utente_filtro: Optional[int] = None,
    admin: dict = Depends(richiede_admin)
):
    offset = (pagina - 1) * per_pagina
    conn   = get_db()
    cur    = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if utente_filtro:
        cur.execute("""
            SELECT l.id, u.username, l.azione, l.ip, l.dettagli, l.creato_il
            FROM log_accessi l
            LEFT JOIN utenti u ON u.id = l.utente_id
            WHERE l.utente_id = %s
            ORDER BY l.creato_il DESC
            LIMIT %s OFFSET %s
        """, (utente_filtro, per_pagina, offset))
    else:
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
        
    # 2. Verifica Nginx (Controllo tramite pgrep - più affidabile di systemctl)
    try:
        # Se pgrep trova nginx, il processo è attivo
        result = subprocess.run(["pgrep", "nginx"], capture_output=True, text=True)
        servizi["nginx"] = result.returncode == 0
        
        # Fallback nel caso in cui pgrep non sia installato o fallisca
        if not servizi["nginx"]:
            result2 = subprocess.run(["systemctl", "is-active", "nginx"], capture_output=True, text=True)
            servizi["nginx"] = result2.stdout.strip() == "active"
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
        
        # Consumi AI
        cur.execute("SELECT SUM(totale_tokens) FROM consumi_ai")
        tot_tokens = cur.fetchone()[0] or 0
        cur.execute("SELECT SUM(costo_stimato) FROM consumi_ai")
        tot_costo = float(cur.fetchone()[0] or 0.0)
        
        cur.close()
        conn.close()
    except Exception:
        tot_documenti, tot_utenti, ricerche_oggi = 0, 0, 0
        tot_tokens, tot_costo = 0, 0.0

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
        "consolidato_ai": {
            "totale_tokens": tot_tokens,
            "costo_stimato": round(tot_costo, 2)
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
# ADMIN — DEPLOY WEBHOOK
# Chiamato da Antigravity via HTTPS per fare git pull + restart
# senza bisogno di SSH diretto al server
# ════════════════════════════════════════════════════════

DEPLOY_TOKEN = "cncai-deploy-2026-xK9mP2nQ8rL5vT"
REPO_DIR     = Path("/opt/docapp")
WEBROOT_DIR  = Path("/var/www/pictosound/ricerca")

@app.post("/admin/deploy")
async def esegui_deploy(
    request: Request,
    admin: dict = Depends(richiede_admin)
):
    # Verifica token aggiuntivo nell'header X-Deploy-Token
    deploy_token = request.headers.get("X-Deploy-Token", "")
    if deploy_token != DEPLOY_TOKEN:
        raise HTTPException(status_code=403, detail="Token deploy non valido")

    log_lines = []

    try:
        # 1. git pull
        result = subprocess.run(
            ["git", "pull", "origin", "main"],
            capture_output=True, text=True, cwd=str(REPO_DIR), timeout=60
        )
        log_lines.append(f"git pull: {result.stdout.strip() or result.stderr.strip()}")

        # 2. Copia dist nel webroot
        if WEBROOT_DIR.exists() and (REPO_DIR / "dist").exists():
            result2 = subprocess.run(
                ["cp", "-r", str(REPO_DIR / "dist") + "/.", str(WEBROOT_DIR) + "/"],
                capture_output=True, text=True, timeout=30
            )
            log_lines.append(f"copy dist: {'OK' if result2.returncode == 0 else result2.stderr}")

        # 3. Riavvia il backend (docapp)
        result3 = subprocess.run(
            ["systemctl", "restart", "docapp"],
            capture_output=True, text=True, timeout=30
        )
        log_lines.append(f"restart docapp: {'OK' if result3.returncode == 0 else result3.stderr}")

        return {
            "stato": "deploy completato",
            "timestamp": datetime.now().isoformat(),
            "log": log_lines
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore deploy: {str(e)}")



# ════════════════════════════════════════════════════════
# ADMIN — SCRAPER WEB
# ════════════════════════════════════════════════════════

class ScraperRequest(BaseModel):
    url: str
    profondita: int = 2
    max_pagine: int = 100

@app.get("/admin/scraper")
async def lista_scansioni(admin: dict = Depends(richiede_admin)):
    """Restituisce lo storico delle scansioni effettuate"""
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS siti_scansionati (
                id SERIAL PRIMARY KEY,
                dominio VARCHAR(255),
                url_radice TEXT,
                pagine_indicizzate INTEGER DEFAULT 0,
                errori INTEGER DEFAULT 0,
                scansionato_il TIMESTAMP DEFAULT NOW(),
                utente_id INTEGER
            )
        """)
        cur.execute("""
            SELECT dominio, url_radice, pagine_indicizzate, errori, scansionato_il
            FROM siti_scansionati
            ORDER BY scansionato_il DESC
            LIMIT 50
        """)
        rows = cur.fetchall()
    except Exception as e:
        rows = []
    finally:
        cur.close()
        conn.close()
    return [dict(r) for r in rows]

@app.post("/admin/scraper")
async def esegui_scraping(body: ScraperRequest, admin: dict = Depends(richiede_admin)):
    """Scansiona un sito web e indicizza le pagine come documenti"""
    try:
        import requests as req_lib
        from urllib.parse import urljoin, urlparse
        from html.parser import HTMLParser
    except ImportError:
        raise HTTPException(status_code=500, detail="Libreria 'requests' non disponibile sul server")

    # BeautifulSoup opzionale — fallback parser manuale
    try:
        from bs4 import BeautifulSoup
        use_bs4 = True
    except ImportError:
        use_bs4 = False

    url_radice  = body.url.rstrip('/')
    profondita  = max(1, min(5, body.profondita))
    max_pagine  = max(1, min(1000, body.max_pagine))
    dominio     = urlparse(url_radice).netloc
    log_lines   = []
    visitati    = set()
    da_visitare = [(url_radice, 0)]  # (url, livello)
    pagine_ok   = 0
    pagine_err  = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; CNCArchive/1.0; +https://www.pictosound.com)",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8"
    }

    log_lines.append(f"🌐 Inizio scansione: {url_radice}")
    log_lines.append(f"📐 Profondità: {profondita} | Max pagine: {max_pagine}")
    log_lines.append(f"🔍 Dominio target: {dominio}")
    log_lines.append("─" * 50)

    conn = get_db()
    cur  = conn.cursor()

    # Assicurati che la tabella esista
    cur.execute("""
        CREATE TABLE IF NOT EXISTS siti_scansionati (
            id SERIAL PRIMARY KEY,
            dominio VARCHAR(255),
            url_radice TEXT,
            pagine_indicizzate INTEGER DEFAULT 0,
            errori INTEGER DEFAULT 0,
            scansionato_il TIMESTAMP DEFAULT NOW(),
            utente_id INTEGER
        )
    """)

    while da_visitare and pagine_ok < max_pagine:
        url_corrente, livello = da_visitare.pop(0)

        if url_corrente in visitati:
            continue
        visitati.add(url_corrente)

        if livello > profondita:
            continue

        try:
            resp = req_lib.get(url_corrente, headers=headers, timeout=15, allow_redirects=True)
            if resp.status_code != 200:
                log_lines.append(f"⚠ [{resp.status_code}] {url_corrente}")
                pagine_err += 1
                continue

            content_type = resp.headers.get('content-type', '')
            if 'text/html' not in content_type:
                continue

            html = resp.text

            # Estrai testo e link
            if use_bs4:
                soup = BeautifulSoup(html, 'html.parser')
                # Rimuovi script e stili
                for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
                    tag.decompose()
                testo = soup.get_text(separator='\n', strip=True)
                titolo = soup.title.string.strip() if soup.title else url_corrente
                links = [a.get('href') for a in soup.find_all('a', href=True)]
            else:
                # Parser manuale minimale
                import re
                testo   = re.sub(r'<[^>]+>', ' ', html)
                testo   = re.sub(r'\s+', ' ', testo).strip()
                titolo  = re.search(r'<title[^>]*>(.*?)</title>', html, re.I|re.S)
                titolo  = titolo.group(1).strip() if titolo else url_corrente
                links   = re.findall(r'href=["\']([^"\']+)["\']', html)

            # Pulisci il testo
            testo = '\n'.join(l.strip() for l in testo.splitlines() if l.strip())
            if len(testo) < 100:
                log_lines.append(f"⏭ Saltata (testo troppo corto): {url_corrente}")
                continue

            # Limita testo a 50000 caratteri
            testo = testo[:50000]

            # Nome file documento
            path_url  = urlparse(url_corrente).path.strip('/').replace('/', '_') or 'homepage'
            nome_file = f"{dominio}_{path_url}.txt"

            log_lines.append(f"✅ [{pagine_ok+1}] {titolo[:60]} — {url_corrente}")

            # Salva come documento e crea embedding
            chunks = chunk_text(testo)
            if not chunks:
                chunks = [testo]

            cur.execute(
                "INSERT INTO documenti (nome_file, testo, file_originale, categoria) VALUES (%s, %s, %s, %s) RETURNING id",
                (nome_file, testo, None, dominio)
            )
            doc_id = cur.fetchone()[0]

            for c_text in chunks:
                try:
                    emb = get_embedding(c_text, int(admin["sub"]))
                    cur.execute(
                        "INSERT INTO embeddings (documento_id, chunk_testo, embedding) VALUES (%s, %s, %s)",
                        (doc_id, c_text, emb)
                    )
                except Exception as emb_err:
                    log_lines.append(f"  ⚠ Embedding fallito: {str(emb_err)[:60]}")

            pagine_ok += 1

            # Estrai e accoda nuovi link (stesso dominio)
            if livello < profondita:
                for href in links:
                    href_abs = urljoin(url_corrente, href).split('#')[0].split('?')[0]
                    parsed   = urlparse(href_abs)
                    if parsed.netloc == dominio and href_abs not in visitati:
                        da_visitare.append((href_abs, livello + 1))

        except Exception as page_err:
            log_lines.append(f"❌ Errore su {url_corrente}: {str(page_err)[:80]}")
            pagine_err += 1
            continue

    # Salva nel log storico
    log_lines.append("─" * 50)
    log_lines.append(f"🏁 Completato: {pagine_ok} pagine indicizzate, {pagine_err} errori")

    cur.execute("""
        INSERT INTO siti_scansionati (dominio, url_radice, pagine_indicizzate, errori, utente_id)
        VALUES (%s, %s, %s, %s, %s)
    """, (dominio, url_radice, pagine_ok, pagine_err, int(admin["sub"])))

    cur.close()
    conn.close()

    return {
        "dominio": dominio,
        "pagine_indicizzate": pagine_ok,
        "errori": pagine_err,
        "log": log_lines
    }


# ════════════════════════════════════════════════════════
# ROOT
# ════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {"status": "ok", "messaggio": "Archivio Cammino Neocatecumenale API"}
