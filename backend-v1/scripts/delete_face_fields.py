"""
Script destructivo: elimina campos relacionados con registro facial en Firestore

Uso (desde carpeta backend-v1):
  python3 scripts/delete_face_fields.py

Requisitos:
  - Tener `serviceAccountKey.json` con permisos de escritura en Firestore en `backend-v1/`
  - Tener `firebase-admin` instalado en el entorno (puedes instalar con pip)

Este script eliminará los campos: `faceImage`, `faceEmbedding`, `faceRegistered`, `faceRegisteredAt`
de todos los documentos en la colección `users`.

IMPORTANTE: Esta acción es irreversible. Ejecuta solo si estás seguro.
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore


def main():
    key_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
    key_path = os.path.abspath(key_path)
    if not os.path.exists(key_path):
        print(f"serviceAccountKey.json no encontrado en {key_path}")
        return

    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    users_ref = db.collection('users')
    docs = list(users_ref.stream())
    print(f"Se procesarán {len(docs)} documentos en 'users'.")

    count = 0
    for doc in docs:
        uid = doc.id
        try:
            users_ref.document(uid).update({
                'faceImage': firestore.DELETE_FIELD,
                'faceEmbedding': firestore.DELETE_FIELD,
                'faceRegistered': firestore.DELETE_FIELD,
                'faceRegisteredAt': firestore.DELETE_FIELD
            })
            count += 1
            print(f"Eliminados campos face* para user {uid}")
        except Exception as e:
            print(f"Error eliminando para {uid}: {e}")

    print(f"Operacion completada. Documentos modificados: {count}")


if __name__ == '__main__':
    main()
