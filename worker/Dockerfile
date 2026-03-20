# Worker needs containerlab, so build on top of the clab image
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /labbed-worker .

FROM ghcr.io/srl-labs/clab:0.74.0

RUN apk add --no-cache tcpdump python3 py3-pip
RUN wget -qO /tmp/tf.zip https://releases.hashicorp.com/terraform/1.9.8/terraform_1.9.8_linux_amd64.zip && \
    unzip /tmp/tf.zip -d /usr/local/bin/ && rm /tmp/tf.zip
RUN pip3 install --break-system-packages awscli

WORKDIR /app
COPY --from=builder /labbed-worker .
COPY worker-config.yaml .

EXPOSE 8081
ENTRYPOINT ["./labbed-worker"]
