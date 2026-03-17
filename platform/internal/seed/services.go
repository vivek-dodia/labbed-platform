package seed

var servicesCollection = CollectionDef{
	Name: "Infrastructure Services",
	Templates: []Template{
		{
			Name: "DHCP Server - Kea",
			Definition: `# Kea DHCP server handing out addresses to clients via an L2 switch
name: kea-dhcp
topology:
  nodes:
    dhcp:
      kind: linux
      image: docker.cloudsmith.io/isc/docker/kea-dhcp4:2.6
      binds:
        - kea-dhcp4.conf:/etc/kea/kea-dhcp4.conf
      exec:
        - ip addr add 10.10.1.2/24 dev eth1
    switch:
      kind: linux
      image: alpine:3.20
      binds:
        - switch-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    client1:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - udhcpc -i eth1
    client2:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - udhcpc -i eth1

  links:
    - endpoints: ["dhcp:eth1", "switch:eth1"]
    - endpoints: ["client1:eth1", "switch:eth2"]
    - endpoints: ["client2:eth1", "switch:eth3"]
`,
			BindFiles: []BindFile{
				{FilePath: "kea-dhcp4.conf", Content: `{
  "Dhcp4": {
    "interfaces-config": {
      "interfaces": ["eth1"]
    },
    "lease-database": {
      "type": "memfile",
      "persist": false
    },
    "subnet4": [
      {
        "id": 1,
        "subnet": "10.10.1.0/24",
        "pools": [{"pool": "10.10.1.100 - 10.10.1.200"}],
        "option-data": [
          {"name": "domain-name-servers", "data": "10.10.1.2"}
        ]
      }
    ]
  }
}
`},
				{FilePath: "switch-start.sh", Content: `#!/bin/ash
apk add --no-cache bridge-utils 2>/dev/null

brctl addbr br0

for iface in eth1 eth2 eth3; do
  if ip link show "$iface" > /dev/null 2>&1; then
    brctl addif br0 "$iface"
    ip link set "$iface" up
  fi
done

ip link set br0 up
echo "Switch ready:"
brctl show br0
`},
			},
		},
		{
			Name: "DNS Server - CoreDNS",
			Definition: `# CoreDNS serving a local zone with a multitool client for testing
name: coredns
topology:
  nodes:
    dns:
      kind: linux
      image: coredns/coredns:1.12.0
      binds:
        - Corefile:/etc/coredns/Corefile
        - hosts.db:/etc/coredns/hosts.db
      cmd: "-conf /etc/coredns/Corefile"
      exec:
        - ip addr add 10.10.1.1/24 dev eth1
    client:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 10.10.1.10/24 dev eth1
        - sh -c "echo 'nameserver 10.10.1.1' > /etc/resolv.conf"

  links:
    - endpoints: ["dns:eth1", "client:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "Corefile", Content: `lab.local {
    hosts /etc/coredns/hosts.db
    log
}

. {
    forward . 8.8.8.8
    log
}
`},
				{FilePath: "hosts.db", Content: `10.10.1.1  dns.lab.local
10.10.1.10 client.lab.local
`},
			},
		},
		{
			Name: "Load Balancer - Nginx",
			Definition: `# Nginx reverse-proxy load balancing across two Alpine web servers
name: nginx-lb
topology:
  nodes:
    lb:
      kind: linux
      image: nginx:alpine
      binds:
        - nginx.conf:/etc/nginx/nginx.conf
      exec:
        - ip addr add 10.10.0.1/24 dev eth1
        - ip addr add 10.10.1.1/24 dev eth2
        - ip addr add 10.10.2.1/24 dev eth3
        - nginx -s reload
    web1:
      kind: linux
      image: alpine:3.20
      binds:
        - web1-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    web2:
      kind: linux
      image: alpine:3.20
      binds:
        - web2-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    client:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 10.10.0.10/24 dev eth1

  links:
    - endpoints: ["client:eth1", "lb:eth1"]
    - endpoints: ["lb:eth2", "web1:eth1"]
    - endpoints: ["lb:eth3", "web2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "nginx.conf", Content: `events {
    worker_connections 64;
}

http {
    upstream backend {
        server 10.10.1.10:80;
        server 10.10.2.10:80;
    }

    server {
        listen 80;
        location / {
            proxy_pass http://backend;
        }
    }
}
`},
				{FilePath: "web1-start.sh", Content: `#!/bin/ash
ip addr add 10.10.1.10/24 dev eth1
ip route add 10.10.0.0/24 via 10.10.1.1
mkdir -p /var/www
echo "Hello from web1" > /var/www/index.html
httpd -p 80 -h /var/www
`},
				{FilePath: "web2-start.sh", Content: `#!/bin/ash
ip addr add 10.10.2.10/24 dev eth1
ip route add 10.10.0.0/24 via 10.10.2.1
mkdir -p /var/www
echo "Hello from web2" > /var/www/index.html
httpd -p 80 -h /var/www
`},
			},
		},
		{
			Name: "Bandwidth Testing - iperf3",
			Definition: `# iperf3 server and client connected through a CHR router
name: iperf3-bench
topology:
  nodes:
    server:
      kind: linux
      image: networkstatic/iperf3:latest
      exec:
        - ip addr add 10.10.1.10/24 dev eth1
        - ip route add 10.10.2.0/24 via 10.10.1.1
    client:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 10.10.2.10/24 dev eth1
        - ip route add 10.10.1.0/24 via 10.10.2.1
    router:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: router.rsc

  links:
    - endpoints: ["server:eth1", "router:eth1"]
    - endpoints: ["router:eth2", "client:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "router.rsc", NosKind: "mikrotik_ros", Content: `# Simple L3 forwarding between server and client subnets
/ip/address/add address=10.10.1.1/24 interface=ether2
/ip/address/add address=10.10.2.1/24 interface=ether3
`},
				{FilePath: "router-daemons", NosKind: "frr", Content: `zebra=yes
`},
				{FilePath: "router.conf", NosKind: "frr", Content: `hostname router
!
interface eth1
 ip address 10.10.1.1/24
!
interface eth2
 ip address 10.10.2.1/24
!
`},
			},
		},
	},
}
