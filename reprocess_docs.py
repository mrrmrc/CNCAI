#!/opt/docapp/bin/python
"""
Ri-processa i documenti con testo placeholder:
- Estrae il testo reale dal file originale
- Aggiorna il testo nel DB
- Ricalcola l'embedding
"""
import sys
import os
sys.path.insert(0, '/opt/docapp')

from pathlib import Path
import psycopg2
import psycopg2.extras

# Carica configurazione dal backend
import importlib.util
spec = importlib.util.spec_from_file_location("backend", "/opt/docapp/backend.py")
mod  = importlib.util.load_from_spec = None  # non serve eseguire il modulo

# Config diretta
DB_CONFIG = {
    "host": "localhost",
    "database": "docdb",
    "user": "docuser",
    "password": "DocPass2026x",
    "port": 5432
}

def get_db():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    return conn

# Leggi config AI dal DB
conn = get_db()
cur  = conn.cursor()
cur.execute("SELECT valore FROM config_ai WHERE chiave = 'api_key'")
row = cur.fetchone()
API_KEY = row[0] if row else ""
cur.execute("SELECT valore FROM config_ai WHERE chiave = 'model'")
row = cur.fetchone()
MODEL = row[0] if row else "text-embedding-3-small"
cur.execute("SELECT valore FROM config_ai WHERE chiave = 'base_url'")
row = cur.fetchone()
BASE_URL = row[0] if row else ""
cur.close()
conn.close()

from openai import OpenAI
client = OpenAI(api_key=API_KEY, base_url=BASE_URL if BASE_URL else None)

def get_embedding(testo):
    r = client.embeddings.create(input=testo[:8000], model=MODEL)
    return r.data[0].embedding

def estrai_testo(path_str, nome_file):
    path = Path(path_str)
    if not path.exists():
        print(f"  ⚠ File non trovato: {path_str}")
        return None
    ext = path.suffix.lower()
    try:
        if ext == '.pdf':
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            pagine = []
            for page in reader.pages:
                t = page.extract_text()
                if t: pagine.append(t.strip())
            testo = "\n\n".join(pagine)
            return testo if testo.strip() else None
        elif ext in ['.docx']:
            from docx import Document
            doc = Document(str(path))
            return "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        elif ext == '.txt':
            return path.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        print(f"  ✗ Errore estrazione {nome_file}: {e}")
    return None

# Trova documenti con testo placeholder
conn = get_db()
cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur.execute("""
    SELECT id, nome_file, file_originale, LEFT(testo,80) as preview
    FROM documenti
    WHERE testo LIKE '[%'
    ORDER BY id
""")
docs = cur.fetchall()
cur.close()
conn.close()

print(f"\n📋 Trovati {len(docs)} documenti con testo placeholder da ri-processare:\n")
for d in docs:
    print(f"  • [{d['id']}] {d['nome_file']}")
    print(f"    Testo attuale: {d['preview']}")
    print(f"    File: {d['file_originale']}")

if not docs:
    print("✅ Nessun documento da ri-processare.")
    sys.exit(0)

print("\n🔄 Avvio ri-processamento...\n")

for d in docs:
    print(f"\n▶ [{d['id']}] {d['nome_file']}")

    if not d['file_originale']:
        print(f"  ✗ Nessun file originale salvato - deve essere ricaricato manualmente")
        continue

    testo = estrai_testo(d['file_originale'], d['nome_file'])
    
    if not testo or not testo.strip():
        print(f"  ✗ Impossibile estrarre testo - file mancante o vuoto")
        continue
    
    print(f"  ✓ Testo estratto: {len(testo)} caratteri")
    
    # Crea embedding
    print(f"  ⏳ Calcolo embedding...")
    try:
        emb = get_embedding(testo)
    except Exception as e:
        print(f"  ✗ Errore embedding: {e}")
        continue
    
    # Aggiorna DB
    conn2 = get_db()
    cur2  = conn2.cursor()
    cur2.execute("UPDATE documenti SET testo = %s WHERE id = %s", (testo, d['id']))
    cur2.execute("DELETE FROM embeddings WHERE documento_id = %s", (d['id'],))
    cur2.execute("INSERT INTO embeddings (documento_id, chunk_testo, embedding) VALUES (%s, %s, %s)",
                 (d['id'], testo[:500], emb))
    cur2.close()
    conn2.close()
    print(f"  ✅ Documento aggiornato con {len(testo)} caratteri e nuovo embedding")

print("\n✅ Ri-processamento completato!\n")
