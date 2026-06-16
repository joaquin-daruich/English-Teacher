import asyncio
import edge_tts
import json
import uuid
import base64
import tempfile
import os

# Configuración de Voz: Femenina, natural, español latino (o cambia a es-ES si prefieres)
VOICE = "es-MX-DaliaNeural" 

async def generate_audio(text):
    output_path = f"{tempfile.gettempdir()}/{uuid.uuid4()}.mp3"
    
    # Generar el audio
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(output_path)
    
    # Leer el archivo y convertir a base64
    with open(output_path, 'rb') as f:
        audio_data = f.read()
    
    os.remove(output_path) # Limpiar archivo temporal
    return base64.b64encode(audio_data).decode('utf-8')

def handler(event, context):
    try:
        if event['httpMethod'] != 'POST':
            return {'statusCode': 405, 'body': json.dumps({'error': 'Método no permitido'})}
        
        body = json.loads(event['body'])
        text = body.get('text', '')
        
        if not text:
            return {'statusCode': 400, 'body': json.dumps({'error': 'No hay texto para hablar'})}
        
        # Generar audio
        audio_base64 = asyncio.run(generate_audio(text))
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'audioBase64': audio_base64})
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}