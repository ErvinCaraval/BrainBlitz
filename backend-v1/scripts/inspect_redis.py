"""
Script sencillo para inspeccionar Redis desde el host (usa REDIS_URL o `redis://localhost:6379/0`).
- Lista claves (usa SCAN, no bloqueante)
- Muestra tipo de clave y una vista previa del valor (trunca si es largo)
- Intenta parsear JSON si el valor parece JSON

Uso:
  cd backend-v1
  python3 scripts/inspect_redis.py --pattern "user:*" --limit 100

Requiere: pip install redis
"""

import os
import json
import argparse
import redis

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

def preview_value(r, key, max_len=400):
    t = r.type(key).decode() if isinstance(r.type(key), bytes) else r.type(key)
    try:
        if t == 'string':
            val = r.get(key)
            if val is None:
                return t, None
            if isinstance(val, bytes):
                try:
                    s = val.decode('utf-8')
                except Exception:
                    s = str(val)
            else:
                s = str(val)
            s_strip = s.strip()
            # try JSON
            if (s_strip.startswith('{') or s_strip.startswith('[')):
                try:
                    j = json.loads(s)
                    pretty = json.dumps(j, ensure_ascii=False)
                    return t, pretty[:max_len]
                except Exception:
                    return t, s_strip[:max_len]
            else:
                return t, s_strip[:max_len]
        elif t == 'hash':
            h = r.hgetall(key)
            # decode bytes
            out = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k,v in h.items()}
            return t, json.dumps(out)[:max_len]
        elif t == 'list':
            l = r.lrange(key, 0, 10)
            out = [ (x.decode() if isinstance(x, bytes) else x) for x in l ]
            return t, json.dumps(out)[:max_len]
        else:
            return t, '<not-previewed>'
    except Exception as e:
        return 'error', str(e)[:200]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pattern', default='*', help='Pattern de keys para SCAN (ej. user:*)')
    parser.add_argument('--limit', type=int, default=1000, help='Máximo de claves a listar')
    parser.add_argument('--redis-url', default=REDIS_URL, help='Redis URL (sobre escribe env)')
    args = parser.parse_args()

    r = redis.from_url(args.redis_url, decode_responses=False)

    print(f"Conectando a Redis: {args.redis_url}")
    count = 0
    try:
        for key in r.scan_iter(match=args.pattern):
            if count >= args.limit:
                break
            count += 1
            # key puede ser bytes o str
            k = key.decode() if isinstance(key, bytes) else key
            t, preview = preview_value(r, k)
            print(f"{count:4d}. {k}  (type={t}) -> {preview}")
    except Exception as e:
        print('Error leyendo Redis:', str(e))

    print('\nHecho. Total keys mostradas:', count)

if __name__ == '__main__':
    main()
