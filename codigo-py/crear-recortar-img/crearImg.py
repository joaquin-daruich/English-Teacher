

# Importación de librerías estándar de Python
import json              # Para manejar datos JSON que enviamos/recibimos de ComfyUI
import urllib.request    # Para realizar peticiones HTTP directas a la API local de ComfyUI
import urllib.parse      # Para codificar parámetros URL al descargar imágenes
import time              # Para pausas entre comprobaciones de estado
import os                # Para manipular carpetas y rutas del sistema
import uuid              # Para generar IDs únicos de cliente en la sesión

# ==================================================================
#  CONFIGURACION
# ==================================================================
SERVIDOR = "127.0.0.1:8188"  # Dirección IP y puerto donde corre tu instalación local de ComfyUI
CKPT = "cyberrealisticXL_v100.safetensors"   # Nombre exacto del checkpoint (modelo) a usar en ComfyUI

SEED_BASE = 43615332   # La semilla fija que garantiza que la cara/fondo sean idénticos en todas las generaciones

ANCHO = 1024           # Ancho de la imagen generada (estándar SDXL)
ALTO  = 1024           # Alto de la imagen generada (cuadrado)

# ACLARACION: Las carpetas fueron usadas antes y las borre para que se vea todo mas prolijo.
CARPETA_SALIDA = "maestra_output"  # Carpeta raíz donde se guardarán los resultados
SUBCARPETA     = "bienvenida"      # Subcarpeta específica para esta generación

# Settings recomendados por el autor de CyberRealistic XL para mejor calidad
STEPS     = 30         # Pasos de sampling (calidad/tiempo de render)
CFG       = 4.0        # CFG Scale (qué tan seguido el modelo sigue el prompt; 4 es natural para realismo)
SAMPLER   = "dpmpp_2m_sde" # Algoritmo de muestreo recomendado para SDXL
SCHEDULER = "karras"   # Esquema de distribución de ruido optimizado

# ==================================================================
#  PROMPTS
# ==================================================================
# Base FIJA: Descripción física completa del personaje. 
# NO cambiar nada aquí excepto si se quiere modificar permanentemente el look.
# Se añade "medium breasts" para un busto más marcado pero manteniendo profesionalismo.
BASE = (
    "masterpiece, best quality, photorealistic, realistic, photography, raw photo, "
    "8k uhd, film grain, detailed skin texture, "
    "1girl, solo, young woman, 23 years old, natural skin, detailed face, "
    "beautiful detailed green eyes, long wavy red hair, ginger hair, "
    "light natural makeup, medium breasts, "
    "elegant white blouse, fitted dark blazer, small earrings, "
    "upper body, modern office background, desk, potted plants, bookshelf, "
    "soft natural window light, depth of field, bokeh background"
)

# Negative Prompt: Qué debe evitar el modelo.
# Crucial para evitar deformaciones en manos, caras feas o estilos no fotográficos.
NEGATIVO = (
    "cartoon, illustration, anime, painting, CGI, 3D render, low quality, "
    "watermark, logo, label, "
    "bad hands, deformed hands, malformed hands, mutated hands, extra fingers, "
    "fused fingers, missing fingers, long fingers, deformed fingers, "
    "masculine hands, large hands, "
    "raised hand, pointing up, hand up"  # Evita gestos rígidos de "mano alzada"
)

# Variantes del GESTO: Solo cambia la acción/postura final.
# Cada variante se probará con varias semillas para obtener opciones de manos.
VARIANTES_GESTO = {
    "invita_lado": "warm welcoming smile, looking at viewer, one hand open to the side "
                   "presenting gesture, palm up, inviting, friendly, relaxed pose",
    "invita_abierta": "friendly bright smile, looking at viewer, open hand gesture to the side, "
                      "welcoming, presenting, natural relaxed posture",
    "saludo_natural": "warm genuine smile, looking at viewer, gentle hand wave to the side, "
                      "casual friendly greeting, dynamic relaxed pose",
}

# Función que devuelve las semillas a probar: la base original y dos variaciones cercanas.
def seeds_para_variante():
    return [SEED_BASE, SEED_BASE + 1, SEED_BASE + 7]

# ==================================================================
#  WORKFLOW (CLIP directo, sin nodos raros)
# ==================================================================
# Construye el diccionario JSON que representa el workflow completo de ComfyUI.
# Esta estructura es enviada a la API de ComfyUI para que ejecute la generación.
def construir_workflow(positivo, negativo, seed):
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
              "inputs": {"filename_prefix": "bienvenida", "images": ["8", 0]}},
    }

# ==================================================================
#  API
# ==================================================================
# Genera un ID único para esta sesión de cliente.
CLIENT_ID = str(uuid.uuid4())

# Envía el workflow a ComfyUI y devuelve el ID de la tarea (Prompt ID).
def encolar(workflow):
    data = json.dumps({"prompt": workflow, "client_id": CLIENT_ID}).encode("utf-8")
    req = urllib.request.Request(f"http://{SERVIDOR}/prompt", data=data)
    req.add_header("Content-Type", "application/json")
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]

# Espera a que ComfyUI termine de generar la imagen (polling).
def esperar(prompt_id, timeout=300):
    t0 = time.time()
    while True:
        try:
            with urllib.request.urlopen(f"http://{SERVIDOR}/history/{prompt_id}") as r:
                hist = json.loads(r.read())
            if prompt_id in hist:
                return hist[prompt_id]
        except Exception:
            pass
        if time.time() - t0 > timeout:
            print("   timeout"); return None
        time.sleep(1.5)

# Descarga la imagen generada desde el servidor local.
def bajar_imagen(filename, subfolder, folder_type):
    params = urllib.parse.urlencode(
        {"filename": filename, "subfolder": subfolder, "type": folder_type})
    with urllib.request.urlopen(f"http://{SERVIDOR}/view?{params}") as r:
        return r.read()

# ==================================================================
#  MAIN
# ==================================================================
def main():
    print("=" * 60)
    print(" SAINT BETO - imagen de BIENVENIDA (varias para elegir)")
    print("=" * 60)
    
    # Verifica que ComfyUI esté corriendo en localhost:8188
    try:
        urllib.request.urlopen(f"http://{SERVIDOR}/system_stats", timeout=5)
    except Exception:
        print(f"\nNo me conecto a ComfyUI en {SERVIDOR}. Abrilo. Freno.")
        return

    # Prepara las semillas y calcula total de imágenes a generar
    seeds = seeds_para_variante()
    total = len(VARIANTES_GESTO) * len(seeds)
    carpeta = os.path.join(CARPETA_SALIDA, SUBCARPETA)
    os.makedirs(carpeta, exist_ok=True)  # Crea la carpeta si no existe

    print(f"\nSeed base: {SEED_BASE}")
    print(f"Voy a generar {total} imagenes "
          f"({len(VARIANTES_GESTO)} gestos x {len(seeds)} seeds)\n")

    hecho = 0
    # Itera sobre cada variante de gesto
    for var_nombre, var_linea in VARIANTES_GESTO.items():
        # Combina la descripción física base con el gesto específico
        positivo = f"{BASE}, {var_linea}"
        print(f"\n >>> Gesto: {var_nombre}")
        
        # Itera sobre las semillas (base + variaciones)
        for seed in seeds:
            wf = construir_workflow(positivo, NEGATIVO, seed)
            try:
                pid = encolar(wf)  # Envía la tarea
            except Exception as e:
                print(f"     ERROR: {e} (revisa el nombre del checkpoint)")
                return
            
            hist = esperar(pid)  # Espera hasta que termine
            if not hist:
                continue
            
            guardada = False
            # Recorre los outputs de la tarea para encontrar la imagen generada
            for _, node_out in hist.get("outputs", {}).items():
                if "images" in node_out:
                    for img in node_out["images"]:
                        data = bajar_imagen(img["filename"],
                                            img.get("subfolder", ""),
                                            img.get("type", "output"))
                        destino = os.path.join(carpeta, f"{var_nombre}_seed{seed}.png")
                        with open(destino, "wb") as f:
                            f.write(data)
                        guardada = True
            
            hecho += 1
            print(f"     [{hecho}/{total}] {var_nombre}  seed={seed}  -> "
                  f"{'OK' if guardada else 'sin imagen'}")

    print("\n" + "=" * 60)
    print(f" LISTO. Imagenes en: ./{CARPETA_SALIDA}/{SUBCARPETA}/")
    print(" Elegi la que tenga la mano mejor formada y el gesto mas claro.")
    print(" Esa va a ser la cara/seed definitiva para las otras expresiones.")
    print("=" * 60)

if __name__ == "__main__":
    main()