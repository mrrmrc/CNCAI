#!/bin/bash
echo "=== Installazione nel venv del servizio ==="
/opt/docapp/bin/pip install pypdf python-docx pillow 2>&1

echo "=== Verifica import nel venv ==="
/opt/docapp/bin/python -c "from pypdf import PdfReader; print('pypdf OK nel venv')"
/opt/docapp/bin/python -c "from docx import Document; print('docx OK nel venv')"

echo "=== Riavvio servizio ==="
systemctl restart docapp
sleep 2
systemctl is-active docapp
