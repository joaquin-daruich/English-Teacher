

"""
====================================================================
 TEACHER LILY - GENERADOR DE EXPRESIONES FACIALES
====================================================================

OBJETIVO
--------
Generar múltiples expresiones faciales de la profesora virtual
manteniendo la misma identidad visual del personaje.

PROBLEMA QUE RESUELVE
---------------------
Los modelos generativos suelen cambiar rasgos faciales, ropa,
peinado o fondo entre imágenes.

Para evitarlo, este script:

1. Define una identidad base única.
2. Mantiene constantes:
   - rostro
   - ropa
   - peinado
   - entorno
3. Solo modifica la emoción del personaje.

EXPRESIONES GENERADAS
---------------------
- Saludando
- Alegre
- Consoladora
- Triste
- Dudando

ESTRATEGIA UTILIZADA
--------------------
Se utiliza una seed principal que define la identidad visual
del personaje.

Posteriormente se generan pequeñas variaciones de esa seed
para obtener distintas opciones de manos, poses y gestos
sin perder consistencia visual.

PIPELINE
--------
Python
    ↓
ComfyUI API
    ↓
CyberRealistic XL
    ↓
Generación de imágenes
    ↓
Descarga automática
    ↓
Clasificación por emoción

RESULTADO
----------
15 imágenes generadas automáticamente listas para selección
manual y posterior integración en React.
"""

import json
import urllib.request
import urllib.parse
import time
import os
import uuid

# ==================================================================
# CONFIGURACIÓN TÉCNICA (EXACTAMENTE COMO TU ÉXITO)
# ==================================================================
SERVIDOR = "127.0.0.1:8188"
CKPT = "cyberrealisticXL_v100.safetensors"

SEED_BASE = 43615332   # ⚠️ ESTA ES LA IMPORTANTE: Define la identidad del personaje
ANCHO = 1024
ALTO = 1024

STEPS = 30
CFG = 4.0
SAMPLER = "dpmpp_2m_sde"
SCHEDULER = "karras"

CARPETA_SALIDA = "maestra_output"
SUBCARPETA = "expresiones_seleccion"

# Variación de semillas (base ± pequeños cambios) para tener opciones de manos/gestos
SEEDS_VARIACION = [
    SEED_BASE,          # La original exacta
    SEED_BASE + 3,      # Ligeramente diferente
    SEED_BASE + 7       # Otra variación cercana
]

# ==================================================================
# PROMPTS ORIGINALES (COPIA EXACTA DE TU ÉXITO)
# ==================================================================

# BASE FÍSICA DEL PERSONAJE (NADA CAMBIA AQUÍ ENTRE EXPRESIONES)
# Si cambias algo aquí, el personaje dejará de verse igual en todas las imágenes.
BASE_PERSONAJE = (
    "masterpiece, best quality, photorealistic, realistic, photography, raw photo, "
    "8k uhd, film grain, detailed skin texture, "
    "1girl, solo, young woman, 23 years old, natural skin, detailed face, "
    "beautiful detailed green eyes, long wavy red hair, ginger hair, "
    "light natural makeup, medium breasts, "
    "elegant white blouse, fitted dark blazer, small earrings, "
    "upper body, modern office background, desk, potted plants, bookshelf, "
    "soft natural window light, depth of field, bokeh background"
)

# Negative Prompt: Evitar deformaciones, especialmente en manos.
NEGATIVO_ORIGINAL = (
    "cartoon, illustration, anime, painting, CGI, 3D render, low quality, "
    "watermark, logo, label, "
    "bad hands, deformed hands, malformed hands, mutated hands, extra fingers, "
    "fused fingers, missing fingers, long fingers, deformed fingers, "
    "masculine hands, large hands, raised hand, pointing up, hand up"
)

# EXPRESIONES: Aquí SÓLO cambia la parte emocional/gesto facial.
# Se añaden a la base constante para mantener consistencia.
EXPRESIONES = {
    "saludando": "warm genuine smile, looking at viewer, gentle hand wave to the side, casual friendly greeting, dynamic relaxed pose",
    
    "alegre": "beaming genuine smile, laughing softly, sparkling eyes with joy, head slightly tilted, relaxed shoulders, warm inviting atmosphere, expression of happiness and confidence, bright eyes",
    
    "consoladora": "warm empathetic gentle smile, soft reassuring eyes looking down with kindness, head tilted in concern, open comforting hand gesture visible at side, kindness radiating from face, emotional connection, supportive expression",
    
    "triste": "sad gentle expression, downturned mouth, soft tears in eyes, downcast gaze, slumped shoulders, looking vulnerable, sympathetic and empathetic look, soft lighting on face to emphasize emotion",
    
    "dudando": "slight furrowed brow, thoughtful expression, lips slightly parted in contemplation, looking slightly away or up as if searching for an answer, hand touching chin gently, pensive, uncertain but polite, subtle confusion"
}

# ==================================================================
# WORKFLOW COMFYUI (IGUAL QUE TU EXITO ORGINAL)
# ==================================================================
def construir_workflow(positivo, negativo, seed):
    # Estructura JSON idéntica a la anterior, reutilizable para cualquier prompt
    return {
        "3": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": STEPS, "cfg": CFG,
            "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": 1.0,
            "model": ["4", 0], "positive": ["6", 0],
            "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage",
              "inputs": {"width": ANCHO, "height": ALTO, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": positivo, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negativo, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage",
              "inputs": {"filename_prefix": "Teacher_", "images": ["8", 0]}},
    }

CLIENT_ID = str(uuid.uuid4())

def encolar(workflow):
    data = json.dumps({"prompt": workflow, "client_id": CLIENT_ID}).encode("utf-8")
    req = urllib.request.Request(f"http://{SERVIDOR}/prompt", data=data)
    req.add_header("Content-Type", "application/json")
    try:
        return json.loads(urllib.request.urlopen(req, timeout=10).read())["prompt_id"]
    except Exception as e:
        print(f"Error conectando: {e}")
        return None

def esperar(prompt_id, timeout=300):
    t0 = time.time()
    while True:
        try:
            with urllib.request.urlopen(f"http://{SERVIDOR}/history/{prompt_id}", timeout=5) as r:
                hist = json.loads(r.read())
            if prompt_id in hist:
                return hist[prompt_id]
        except:
            pass
        if time.time() - t0 > timeout:
            print("   Timeout"); return None
        time.sleep(1.5)

def bajar_imagen(filename, subfolder, folder_type):
    params = urllib.parse.urlencode(
        {"filename": filename, "subfolder": subfolder, "type": folder_type})
    try:
        with urllib.request.urlopen(f"http://{SERVIDOR}/view?{params}", timeout=30) as r:
            return r.read()
    except Exception as e:
        print(f"Error bajando: {e}")
        return None

# ==================================================================
# MAIN LOOP
# ==================================================================
def main():
    print("=" * 80)
    print(" GENERADOR DE EXPRESIONES - 3 SEMILLAS CADA UNA")
    print("=" * 80)
    print("\n📋 Resumen:")
    print(f"   • Modelo: {CKPT}")
    print(f"   • Seed Base: {SEED_BASE}")
    print(f"   • Semillas por expresión: {len(SEEDS_VARIACION)}")
    print(f"   • Total imágenes: {len(EXPRESIONES) * len(SEEDS_VARIACION)}")
    print("-" * 80)

    # Verificar conexión
    try:
        urllib.request.urlopen(f"http://{SERVIDOR}/system_stats", timeout=5)
        print("\n✅ Conectado a ComfyUI")
    except Exception:
        print(f"\n❌ No conectado a ComfyUI en {SERVIDOR}. ¡ABRIR PRIMERO!")
        input("Presiona Enter para salir...")
        return

    # Crear carpeta
    carpeta = os.path.join(CARPETA_SALIDA, SUBCARPETA)
    os.makedirs(carpeta, exist_ok=True)

    contador_total = 0

    # Bucle principal: Por cada expresión...
    for expr_nombre, expr_linea in EXPRESIONES.items():
        print(f"\n{'='*80}")
        print(f">>> EXPRESIÓN: {expr_nombre.upper()}")
        print(f"    Seed Base: {SEED_BASE}, Varaciones: +0, +3, +7")
        print("-" * 80)
        
        # ...generamos 3 variaciones con semillas cercanas
        for idx, seed in enumerate(SEEDS_VARIACION):
            positivo_completo = f"{BASE_PERSONAJE}, {expr_linea}"
            
            wf = construir_workflow(positivo_completo, NEGATIVO_ORIGINAL, seed)
            pid = encolar(wf)
            
            if not pid:
                print(f"   [{idx+1}/3] ❌ Error enviando tarea")
                continue
            
            print(f"   [{idx+1}/3] Seed {seed} ... ", end="", flush=True)
            hist = esperar(pid)
            
            guardada = False
            if hist:
                for node_out in hist.get("outputs", {}).values():
                    if "images" in node_out:
                        for img in node_out["images"]:
                            data = bajar_imagen(img["filename"], img.get("subfolder", ""), img.get("type", "output"))
                            if data:
                                # Nombre claro con expresión + seed para identificar fácil
                                destino = os.path.join(carpeta, f"{expr_nombre}_v{idx+1}_seed{seed}.png")
                                with open(destino, "wb") as f:
                                    f.write(data)
                                guardada = True
                
                if guardada:
                    print("✅ OK")
                else:
                    print("❌ Sin imagen")
            
            contador_total += 1
    
    print("\n" + "=" * 80)
    print("🎉 ¡GENERACIÓN FINALIZADA!")
    print("=" * 80)
    print(f"\n📂 Carpeta de salida: ./{CARPETA_SALIDA}/{SUBCARPETA}/")
    print(f"🖼️  Imágenes generadas: {contador_total}")
    
    print("\n" + "-" * 80)
    print("👀 INSTRUCCIONES DE SELECCIÓN MANUAL:")
    print("-" * 80)
    print("1. Abre la carpeta resultante.")
    print("2. Para cada expresión, compara las 3 variantes:")
    print("   - v1_seed43615332.png  (La original)")
    print("   - v2_seed43615335.png  (Variación 1)")
    print("   - v3_seed43615339.png  (Variación 2)")
    print("3. Elige la que MÁS SE PAREZCA a teacher-saludando.png en cara/ropa/fondo")
    print("4. Copia las 5 elegidas a tu carpeta public/ del proyecto React")
    print("5. Nombra cada una como:")
    print("   - Teacher-saludando.png")
    print("   - Teacher-alegre.png")
    print("   - Teacher-consoladora.png")
    print("   - Teacher-triste.png")
    print("   - Teacher-dudando.png")
    print("=" * 80)

if __name__ == "__main__":
    main()