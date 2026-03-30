#!/bin/bash
echo "=== Python path ==="
which python3
python3 --version

echo "=== pypdf test ==="
python3 -c "from pypdf import PdfReader; print('pypdf OK')" 2>&1

echo "=== python-docx test ==="
python3 -c "from docx import Document; print('docx OK')" 2>&1

echo "=== Service Python ==="
systemctl cat docapp | grep -i "exec\|python\|env"

echo "=== pip show pypdf ==="
pip3 show pypdf 2>&1 | head -5
pip show pypdf 2>&1 | head -5
