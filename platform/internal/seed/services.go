package seed

var servicesCollection = CollectionDef{
	Name: "Infrastructure Services",
	Templates: []Template{
		{
			Name: "DHCP Server",
			Definition: `# dnsmasq DHCP server handing out addresses to clients via an L2 switch
name: dhcp-server
topology:
  nodes:
    dhcp:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - dhcp-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    switch:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - switch-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    client1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - udhcpc -i eth1
    client2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - udhcpc -i eth1

  links:
    - endpoints: ["dhcp:eth1", "switch:eth1"]
    - endpoints: ["client1:eth1", "switch:eth2"]
    - endpoints: ["client2:eth1", "switch:eth3"]
`,
			BindFiles: []BindFile{
				{FilePath: "dhcp-start.sh", Content: `#!/bin/ash
ip addr add 10.10.1.1/24 dev eth1
dnsmasq --no-daemon --interface=eth1 --dhcp-range=10.10.1.100,10.10.1.200,255.255.255.0,12h --log-dhcp &
echo "DHCP server ready on 10.10.1.1"
`},
				{FilePath: "switch-start.sh", Content: `#!/bin/ash
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
			Name: "DNS Server",
			Definition: `# dnsmasq DNS server serving a local zone with a client for testing
name: dns-server
topology:
  nodes:
    dns:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - dns-start.sh:/tmp/start.sh
        - hosts.db:/tmp/hosts.db
      exec:
        - ash /tmp/start.sh
    client:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.10.1.10/24 dev eth1
        - sh -c "echo 'nameserver 10.10.1.1' > /etc/resolv.conf"

  links:
    - endpoints: ["dns:eth1", "client:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "dns-start.sh", Content: `#!/bin/ash
ip addr add 10.10.1.1/24 dev eth1
dnsmasq --no-daemon --interface=eth1 --no-dhcp-interface=eth1 --addn-hosts=/tmp/hosts.db --log-queries &
echo "DNS server ready on 10.10.1.1"
`},
				{FilePath: "hosts.db", Content: `10.10.1.1  dns.lab.local
10.10.1.10 client.lab.local
`},
			},
		},
		{
			Name: "Load Balancer - Nginx",
			Definition: `# Nginx reverse-proxy load balancing across two web servers
name: nginx-lb
topology:
  nodes:
    lb:
      kind: linux
      image: ghcr.io/vivek-dodia/mirror-nginx:alpine
      binds:
        - nginx.conf:/etc/nginx/nginx.conf
      exec:
        - ip addr add 10.10.0.1/24 dev eth1
        - ip addr add 10.10.1.1/24 dev eth2
        - ip addr add 10.10.2.1/24 dev eth3
        - nginx -s reload
    web1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - web1-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    web2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      binds:
        - web2-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    client:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
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
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.10.1.10/24 dev eth1
        - ip route add 10.10.2.0/24 via 10.10.1.1
        - iperf3 -s -D
    client:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
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
