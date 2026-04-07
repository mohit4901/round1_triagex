# Use Debian slim that ships both Node 20 and allows easy Python 3 install
FROM node:20-bookworm-slim

# ── System deps ───────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv && \
    # Create a `python` symlink so both `python` and `python3` work
    ln -sf /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

# ── App directory ─────────────────────────────────────────────────────────────
WORKDIR /usr/src/app

# ── Python inference deps ─────────────────────────────────────────────────────
COPY pyproject.toml ./
COPY inference.py ./
RUN pip3 install --no-cache-dir --break-system-packages \
    openai>=1.2.0 requests>=2.31.0 python-dotenv>=1.0.0

# ── Node server deps ──────────────────────────────────────────────────────────
COPY server/package*.json ./server/
WORKDIR /usr/src/app/server
RUN npm install

# Copy all server files
COPY server/ .

# Copy openenv spec to root
WORKDIR /usr/src/app
COPY openenv.yaml .

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV PORT=7860
EXPOSE 7860

WORKDIR /usr/src/app/server
CMD [ "npm", "start" ]
