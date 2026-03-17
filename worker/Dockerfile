# Worker needs containerlab, so build on top of the clab image
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /labbed-worker .

FROM ghcr.io/srl-labs/clab:0.74.0

RUN apt-get update && apt-get install -y --no-install-recommends tcpdump && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /labbed-worker .
COPY worker-config.yaml .

EXPOSE 8081
ENTRYPOINT ["./labbed-worker"]
