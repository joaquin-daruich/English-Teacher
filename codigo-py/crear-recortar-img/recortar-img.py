"""
====================================================================
 TEACHER LILY - ELIMINADOR DE FONDOS
====================================================================

OBJETIVO
--------
Convertir las imágenes generadas por IA en PNG transparentes
listos para utilizar dentro de la interfaz web.

PROBLEMA QUE RESUELVE
---------------------
Las imágenes generadas por Stable Diffusion incluyen fondos
completos que dificultan su integración visual dentro del
frontend.

SOLUCIÓN
--------
Se utiliza rembg para detectar automáticamente la silueta
del personaje y eliminar el fondo.

PIPELINE
--------
Imagen generada
    ↓
Rembg
    ↓
Detección de sujeto
    ↓
Eliminación de fondo
    ↓
PNG transparente

FUNCIONALIDAD EXTRA
-------------------
Además de eliminar el fondo, el script renombra
automáticamente los archivos según la emoción detectada:

- Teacher-alegre.png
- Teacher-triste.png
- Teacher-consoladora.png
- Teacher-dudando.png

Esto permite que React cambie dinámicamente la imagen
simplemente modificando la ruta del archivo.
"""

import os             # Para listar archivos y crear carpetas
from rembg import remove  # Librería de IA especializada en eliminación de fondos
from PIL import Image  # Librería para manejo básico de imágenes (abrir/guardar)

# ==================================================================
#  Es la configuracion anterior pero las imagenes las movi
# ==================================================================
CARPETA_ENTRADA = "para_recortar"     # Carpeta donde colocas las JPG/PNG originales a procesar
CARPETA_SALIDA  = "sin_fondo"          # Carpeta donde aparecerán las imágenes sin fondo

# Extensiones que el script reconocerá y procesará
EXTENSIONES = (".png", ".jpg", ".jpeg", ".webp")


# ==================================================================
#  PROCESO
# ==================================================================
def main():
    print("=" * 60)
    print(" SAINT BETO - quitar fondo (rembg)")
    print("=" * 60)

    # Si no existe la carpeta de entrada, la crea y avisa al usuario
    if not os.path.isdir(CARPETA_ENTRADA):
        os.makedirs(CARPETA_ENTRADA, exist_ok=True)
        print(f"\nCree la carpeta '{CARPETA_ENTRADA}'.")
        print("Poné ahí las imagenes que queres recortar y volvé a correr.")
        return

    # Asegura que la carpeta de salida exista
    os.makedirs(CARPETA_SALIDA, exist_ok=True)

    # Obtiene lista de archivos válidos en la carpeta de entrada
    archivos = [f for f in os.listdir(CARPETA_ENTRADA)
                if f.lower().endswith(EXTENSIONES)]

    # Si no hay archivos, avisa y termina
    if not archivos:
        print(f"\nNo hay imagenes en '{CARPETA_ENTRADA}'.")
        print(f"Extensiones validas: {', '.join(EXTENSIONES)}")
        return

    print(f"\nEncontre {len(archivos)} imagen(es). Procesando...\n")

    ok = 0
    for i, nombre in enumerate(archivos, 1):
        ruta_in = os.path.join(CARPETA_ENTRADA, nombre)
        base, _ = os.path.splitext(nombre)
        
        # Lógica de renombrado automático según el tipo de expresión detectada en el nombre
        if 'alegre' in base:              # ✅ Mejor forma en Python (usar 'in')
            base = "teacher-alegre.png"
        elif 'triste' in base:            # ✅ Usar elif para que solo ejecute uno
            base = "teacher-triste.png"
        elif 'dudando' in base:
            base = "teacher-dudando.png"
        elif 'consoladora' in base:
            base = "teacher-consoladora.png"
        else:
            # Caso por defecto si no coincide ninguna expresión conocida
            print("No se encontró coincidencia específica")
        
        # Ruta completa donde se guardará el resultado
        ruta_out = os.path.join(CARPETA_SALIDA, base)

        try:
            # Abre la imagen original
            entrada = Image.open(ruta_in)
            # Aplica la IA para remover el fondo (devuelve una imagen con canal alpha)
            salida = remove(entrada)          
            # Guarda como PNG (formato que soporta transparencia)
            salida.save(ruta_out)             
            print(f"  [{i}/{len(archivos)}] {nombre}  ->  {base}   OK")
            ok += 1
        except Exception as e:
            print(f"  [{i}/{len(archivos)}] {nombre}  ->  ERROR: {e}")

    print("\n" + "=" * 60)
    print(f" LISTO. {ok}/{len(archivos)} recortadas en: ./{CARPETA_SALIDA}/")
    print(" Esos PNG transparentes son los que van en la web para respirar.")
    print("=" * 60)


if __name__ == "__main__":
    main()