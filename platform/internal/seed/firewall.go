package seed

var firewallCollection = CollectionDef{
	Name: "Firewall",
	Templates: []Template{
		{
			Name: "OpenWrt Firewall Gateway",
			Definition: `# OpenWrt firewall between a server (LAN) and client (WAN) — requires KVM
name: openwrt-gateway
topology:
  nodes:
    firewall:
      kind: openwrt
      image: vrnetlab/openwrt_openwrt:24.10.0
    server:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 192.168.1.10/24 dev eth1
        - ip route add default via 192.168.1.1
    client:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 10.0.0.10/24 dev eth1
        - ip route add 192.168.1.0/24 via 10.0.0.1

  links:
    - endpoints: ["firewall:eth1", "server:eth1"]
    - endpoints: ["firewall:eth2", "client:eth1"]
`,
		},
		{
			Name: "Perimeter Firewall - Dual Zone",
			Definition: `# OpenWrt with LAN, DMZ, and WAN zones — requires KVM
name: perimeter-firewall
topology:
  nodes:
    firewall:
      kind: openwrt
      image: vrnetlab/openwrt_openwrt:24.10.0
    lan:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 192.168.1.10/24 dev eth1
        - ip route add default via 192.168.1.1
    dmz:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 172.16.0.10/24 dev eth1
        - ip route add default via 172.16.0.1
    wan:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 10.0.0.10/24 dev eth1
        - ip route add 192.168.1.0/24 via 10.0.0.1
        - ip route add 172.16.0.0/24 via 10.0.0.1

  links:
    - endpoints: ["firewall:eth1", "lan:eth1"]
    - endpoints: ["firewall:eth2", "dmz:eth1"]
    - endpoints: ["firewall:eth3", "wan:eth1"]
`,
		},
		{
			Name: "NAT Gateway with iptables",
			Definition: `# Alpine NAT gateway with two client subnets
name: nat-gateway
topology:
  nodes:
    gateway:
      kind: linux
      image: alpine:3.20
      binds:
        - gateway-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    lan1-host:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 192.168.1.10/24 dev eth1
        - ip route add default via 192.168.1.1
    lan2-host:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 192.168.2.10/24 dev eth1
        - ip route add default via 192.168.2.1

  links:
    - endpoints: ["lan1-host:eth1", "gateway:eth1"]
    - endpoints: ["lan2-host:eth1", "gateway:eth2"]
`,
			BindFiles: []BindFile{
				{FilePath: "gateway-start.sh", Content: `#!/bin/ash
# Configure gateway interfaces
ip addr add 192.168.1.1/24 dev eth1
ip addr add 192.168.2.1/24 dev eth2

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# NAT for outbound traffic
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Allow forwarding between LANs
iptables -A FORWARD -i eth1 -o eth2 -j ACCEPT
iptables -A FORWARD -i eth2 -o eth1 -j ACCEPT
`},
			},
		},
	},
}
