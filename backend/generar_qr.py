import qrcode
import socket

# El backend sirve la API y el frontend compilado: todo entra por el puerto 8001
PUERTO = 8001

# Detecta la IP local real de la PC en la red (no 127.0.0.1)
with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
    try:
        s.connect(("8.8.8.8", 80)) # No envía nada; solo averigua qué placa de red se usaría
        ip = s.getsockname()[0]
    except OSError:
        ip = "localhost"

url = f"http://{ip}:{PUERTO}"
print(f"Generando QR para: {url}")

# Configuración del diseño del QR
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H, # Alta corrección de errores por si se ensucia en el taller
    box_size=10,
    border=2,
)

qr.add_data(url)
qr.make(fit=True)

# Generar imagen con los colores del sistema
img = qr.make_image(fill_color="#1e293b", back_color="white")

# Guardar en tu compu
img.save("QR_Panol_IMCAYPER.png")
print("¡Código QR generado con éxito y guardado como QR_Panol_IMCAYPER.png!")