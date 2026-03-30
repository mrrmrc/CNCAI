SELECT id, nome_file, file_originale, LEFT(testo,120) as testo_preview
FROM documenti
WHERE testo LIKE '[%'
ORDER BY id;
