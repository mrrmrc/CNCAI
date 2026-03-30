import psycopg2
import psycopg2.extras
from openai import OpenAI
import os
import sys

# DATABASE CONFIG (Stessi dati del backend)
DB_CONFIG = {
    "host": "localhost",
    "database": "docdb",
    "user": "docuser",
    "password": "DocPass2026x",
    "port": 5432
}

REGOLO_API_KEY = "sk-cW-pQV8CyF8vsejS6tqYWQ"
EMBED_MODEL    = "gte-Qwen2"

client = OpenAI(api_key=REGOLO_API_KEY, base_url="https://api.regolo.ai/v1")

def get_db():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    return conn

def get_embedding(testo: str):
    try:
        response = client.embeddings.create(input=testo[:8000], model=EMBED_MODEL)
        return response.data[0].embedding
    except Exception as e:
        print(f"Errore embedding: {e}")
        return None

def chunk_text(text: str, size: int = 2000, overlap: int = 400):
    if not text: return []
    chunks = []
    text_len = len(text)
    start = 0
    while start < text_len:
        end = start + size
        chunks.append(text[start:end])
        start += (size - overlap)
        if start >= text_len: break
    return chunks

def run():
    print("--- INIZIO RI-PROCESSAMENTO CHUNK ---")
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # 1. Recupera tutti i documenti
    cur.execute("SELECT id, nome_file, testo FROM documenti")
    docs = cur.fetchall()
    total = len(docs)
    
    print(f"Trovati {total} documenti da analizzare.")

    for i, doc in enumerate(docs):
        doc_id = doc["id"]
        nome = doc["nome_file"]
        testo = doc["testo"] or ""
        
        print(f"[{i+1}/{total}] Processando: {nome} (ID: {doc_id})...")
        
        # 2. Cancella vecchi embeddings per questo documento
        cur.execute("DELETE FROM embeddings WHERE documento_id = %s", (doc_id,))
        
        # 3. Crea nuovi chunks
        chunks = chunk_text(testo)
        if not chunks:
            print(f"  ! Documento vuoto o senza testo.")
            continue
            
        print(f"  > Creati {len(chunks)} frammenti. Generazione embeddings...")
        
        for c_idx, c_text in enumerate(chunks):
            emb = get_embedding(c_text)
            if emb:
                # Stringify per pgvector
                emb_str = "[" + ",".join(map(str, emb)) + "]"
                cur.execute(
                    "INSERT INTO embeddings (documento_id, chunk_testo, embedding) VALUES (%s, %s, %s)",
                    (doc_id, c_text, emb_str)
                )
            else:
                print(f"  ! Fallito embedding per chunk {c_idx}")
                
    cur.close()
    conn.close()
    print("\n✅ Operazione completata con successo!")

if __name__ == "__main__":
    run()
