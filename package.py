import zipfile
import os
import json

def build_zip():
    with open('manifest.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        version = data.get('version', '1.0.0')

    zip_filename = f'gestor-descargas-v{version}.zip'
    
    include_dirs = ['_locales', 'assets', 'css', 'js', 'libs', 'pages']
    include_files = ['manifest.json']

    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Archivos raíz
        for f in include_files:
            if os.path.exists(f):
                zf.write(f, f)
        
        # Carpetas de la extensión
        for d in include_dirs:
            if os.path.exists(d):
                for root, _, files in os.walk(d):
                    for file in files:
                        full_path = os.path.join(root, file)
                        # Normalizar a barras inclinadas (requerido por Linux/AMO)
                        arcname = full_path.replace('\\', '/')
                        zf.write(full_path, arcname)

    total_files = len(zf.namelist())
    print(f"Paquete creado exitosamente: {zip_filename} ({total_files} archivos)")
    print("Listo para subir a Mozilla Add-ons (AMO) sin warnings ni archivos .git")

if __name__ == '__main__':
    build_zip()
