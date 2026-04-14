# Stage 1: Build con Go
FROM golang:1.22-alpine AS builder
WORKDIR /app
# Copiamos todo primero para que go mod tidy pueda resolver imports
COPY . .
# go mod tidy genera go.sum y descarga todas las dependencias
RUN go mod tidy && go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o audit-service .

# Stage 2: Imagen minima (solo el binario ~20MB total)
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/audit-service .
CMD ["./audit-service"]
