# Stage 1: Build con GCC + librabbitmq
FROM debian:bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake gcc make pkg-config libc-dev librabbitmq-dev libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY CMakeLists.txt .
COPY src/ ./src/
RUN cmake -DCMAKE_BUILD_TYPE=Release . && make

# Stage 2: Runtime minimo
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    librabbitmq4 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/card-service /usr/local/bin/card-service
CMD ["card-service"]
