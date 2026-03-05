"""
Script para migrar embeddings faciales desde Firestore (campo `faceEmbedding` en documentos `users/:uid`)
a Redis bajo la clave `user:<uid>`.

Uso:
  python migrate_faces_to_redis.py --dry-run
  python migrate_faces_to_redis.py --delete-after

Requisitos:
 - Tener `backend-v1/serviceAccountKey.json` con permisos de lectura de Firestore
 - Redis accesible en REDIS_URL env var (por defecto redis://localhost:6379/0)

Este script NO regenerará embeddings a partir de imágenes; requiere que el campo
`faceEmbedding` exista en Firestore y sea un array de floats.
"""

import os
import argparse
import json
import datetime

import firebase_admin
from firebase_admin import credentials, firestore
import redis


def main(dry_run=True, delete_after=False):
    cred_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
    cred_path = os.path.abspath(cred_path)
    if not os.path.exists(cred_path):
        print(f"No se encontró service account en {cred_path}. Ejecuta desde backend-v1 con la clave correcta.")
        return

    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    r = redis.from_url(redis_url, decode_responses=True)

    users_ref = db.collection('users')
    docs = users_ref.stream()

    migrated = 0
    skipped = 0

    for doc in docs:
        data = doc.to_dict() or {}
        uid = doc.id
        face_emb = data.get('faceEmbedding') or data.get('face_embedding')
        face_registered = data.get('faceRegistered') or data.get('face_registered') or data.get('faceRegistered', False)

        if not face_emb:
            skipped += 1
            continue

        # Ensure embedding is list of numbers
        if not isinstance(face_emb, list) or len(face_emb) == 0:
            print(f"[SKIP] user {uid} embedding malformed")
            skipped += 1
            continue

        key = f"user:{uid}"
        payload = json.dumps({
            'embedding': face_emb,
            'created_at': datetime.datetime.utcnow().isoformat()
        })

        print(f"[MIGRATE] user={uid} -> redis key={key}")
        if not dry_run:
            r.set(key, payload)
        migrated += 1

        if delete_after and not dry_run:
            # Remove face fields from Firestore
            try:
                users_ref.document(uid).update({
                    'faceImage': firestore.DELETE_FIELD,
                    'faceEmbedding': firestore.DELETE_FIELD,
                    'faceRegistered': firestore.DELETE_FIELD,
                    'faceRegisteredAt': firestore.DELETE_FIELD
                })
                print(f"  -> Eliminado campos face* en Firestore para {uid}")
            except Exception as e:
                print(f"  -> Error borrando campos en Firestore para {uid}: {e}")

    print('\nResumen:')
    print(f'  Migrated: {migrated}')
    print(f'  Skipped (no embedding): {skipped}')
    print(f'  Dry run: {dry_run}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Migrar embeddings de Firestore a Redis')
    parser.add_argument('--dry-run', action='store_true', help='No escribe en Redis ni Firestore')
    parser.add_argument('--delete-after', action='store_true', help='Borra campos face* en Firestore después de migrar')
    args = parser.parse_args()

    main(dry_run=args.dry_run or False, delete_after=args.delete_after)
