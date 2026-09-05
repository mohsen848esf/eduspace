FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 2000 eduspace && useradd --uid 10001 --gid eduspace --create-home eduspace
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
COPY --chown=eduspace:eduspace backend/ /app/
ARG APP_VERSION=dev-0.0.0-local
RUN echo "$APP_VERSION" > /app/VERSION && chown eduspace:eduspace /app/VERSION
RUN mkdir -p /app/media/recordings /app/private_media/presentation_sources /app/staticfiles \
    && chown -R eduspace:eduspace /app/media /app/private_media /app/staticfiles
USER eduspace
EXPOSE 8000
ENTRYPOINT ["sh", "/app/server-entrypoint.sh"]
CMD ["uvicorn", "config.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
