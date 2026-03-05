# Dockerfile optimizado para escalabilidad y memoria limitada
FROM serengil/deepface:latest

WORKDIR /app

# Instalar psutil para monitoreo de memoria
RUN pip install --no-cache-dir psutil

# Copiar requirements y instalar dependencias
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copiar archivos
COPY api.py /app/api.py
COPY memory_optimizer.py /app/memory_optimizer.py
COPY . /app/

# Exponer el puerto
EXPOSE 5001

# Variables de entorno para optimización
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD curl -f http://localhost:5001/health || exit 1

# Comando con optimizaciones
# --max-workers=2: limita threads pool a 2 (evita overhead)
# --cache-size=500: limita caché de embeddings
CMD ["python", "-u", "api.py"]
