"""
====================================================================
 TEACHER LILY - GENERADOR AUTOMÁTICO DE VIDEO TIKTOK
====================================================================

OBJETIVO
--------
Automatizar la creación del video promocional utilizado para
el lanzamiento del proyecto.

PROBLEMA QUE RESUELVE
---------------------
Los editores tradicionales requieren múltiples pasos manuales:

- Recortar clips
- Unir escenas
- Acelerar el video
- Diseñar llamados a la acción
- Exportar formatos verticales

Este script automatiza todo el proceso.

TECNOLOGÍAS UTILIZADAS
----------------------
- Python
- HTML
- CSS
- Playwright
- FFmpeg

PIPELINE
--------
HTML/CSS
    ↓
Playwright
    ↓
PNG transparente CTA
    ↓
FFmpeg
    ↓
Recorte de escenas
    ↓
Unión de clips
    ↓
Aceleración 1.5x
    ↓
Overlay promocional
    ↓
Video final para TikTok

FUNCIONALIDADES
---------------
- Selección automática de segmentos relevantes.
- Unión automática de clips.
- Aceleración del contenido.
- Generación visual de CTA mediante HTML y CSS.
- Renderizado automático mediante Chromium.
- Integración final mediante FFmpeg.

RESULTADO
---------
Video vertical listo para publicar en TikTok sin necesidad
de edición manual posterior.
"""

import subprocess
from pathlib import Path

VIDEO_IN = "1322.mp4"
VIDEO_OUT = "1322_final.mp4"

# ==========================================================
# CORTES
# ==========================================================

PARTE1_INICIO = 3
PARTE1_FIN    = 27

PARTE2_INICIO = 31
PARTE2_FIN    = 46

VELOCIDAD = 1.5

CTA_HTML = "cta.html"
CTA_PNG  = "cta.png"

# ==========================================================
# HTML CTA
# ==========================================================

html = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">

<style>

*{
    margin:0;
    padding:0;
    box-sizing:border-box;
    font-family:Arial, Helvetica, sans-serif;
}

body{
    width:1080px;
    height:1920px;
    background:transparent;
}

.cta{

    position:absolute;

    left:40px;
    right:40px;

    bottom:80px;

    background:rgba(0,0,0,.88);

    border-radius:40px;

    padding:50px;

    color:white;

    box-shadow:0 20px 60px rgba(0,0,0,.5);

}

.titulo{

    font-size:82px;

    font-weight:900;

    line-height:1.05;

    text-align:center;

}

.sub{

    margin-top:20px;

    font-size:42px;

    color:#ffffff;

    font-weight:700;

    text-align:center;

}

.lista{

    margin-top:30px;

    font-size:48px;

    line-height:1.6;

}

.link{

    margin-top:35px;

    font-size:64px;

    font-weight:900;

    color:#7fd3ff;

    text-align:center;

}

.badge{

    position:absolute;

    top:60px;

    left:40px;

    background:#00c853;

    color:white;

    font-size:42px;

    font-weight:900;

    padding:18px 30px;

    border-radius:18px;

    box-shadow:0 10px 30px rgba(0,0,0,.4);

}

</style>
</head>
<body>

<div class="badge">
⚡ IA EN VIVO
</div>

<div class="cta">

<div class="titulo">
🇺🇸 TEACHER LILY
</div>

<div class="sub">
Preguntale cualquier cosa en inglés
</div>

<div class="lista">
✅ Gratis<br>
✅ Sin registro<br>
✅ Respuesta inmediata<br>
✅ Sin límites
</div>

<div class="link">
👇 LINK EN COMENTARIOS
</div>

</div>

</body>
</html>
"""

Path(CTA_HTML).write_text(html, encoding="utf-8")

# ==========================================================
# PLAYWRIGHT
# ==========================================================

render_script = r'''
from playwright.sync_api import sync_playwright

with sync_playwright() as p:

    browser = p.chromium.launch()

    page = browser.new_page(
        viewport={
            "width":1080,
            "height":1920
        }
    )

    page.goto("file:///cta.html")

    page.screenshot(
        path="cta.png",
        omit_background=True
    )

    browser.close()
'''

Path("render_cta.py").write_text(render_script)

subprocess.run(["python", "render_cta.py"])

# ==========================================================
# RECORTAR PARTE 1
# ==========================================================

subprocess.run([
    "ffmpeg","-y",
    "-ss",str(PARTE1_INICIO),
    "-to",str(PARTE1_FIN),
    "-i",VIDEO_IN,
    "-c","copy",
    "parte1.mp4"
])

# ==========================================================
# RECORTAR PARTE 2
# ==========================================================

subprocess.run([
    "ffmpeg","-y",
    "-ss",str(PARTE2_INICIO),
    "-to",str(PARTE2_FIN),
    "-i",VIDEO_IN,
    "-c","copy",
    "parte2.mp4"
])

# ==========================================================
# CONCAT
# ==========================================================

Path("lista.txt").write_text(
"""file 'parte1.mp4'
file 'parte2.mp4'
"""
)

subprocess.run([
    "ffmpeg","-y",
    "-f","concat",
    "-safe","0",
    "-i","lista.txt",
    "-c","copy",
    "unido.mp4"
])

# ==========================================================
# VELOCIDAD 1.5X + CTA FINAL
# ==========================================================

filter_complex = (
    "[0:v]setpts=PTS/1.5[v];"
    "[0:a]atempo=1.5[a];"
    "[v][1:v]overlay=0:0:enable='gte(t,23.67)'[outv]"
)

subprocess.run([
    "ffmpeg","-y",
    "-i","unido.mp4",
    "-i","cta.png",

    "-filter_complex", filter_complex,

    "-map","[outv]",
    "-map","[a]",

    "-c:v","libx264",
    "-c:a","aac",

    VIDEO_OUT
])

print("\\nLISTO:", VIDEO_OUT)