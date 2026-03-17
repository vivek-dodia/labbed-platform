package seed

var switchingCollection = CollectionDef{
	Name: "Switching",
	Templates: []Template{
		{
			Name: "L2 Switch + Hosts",
			Definition: `# Alpine Linux bridge acting as L2 switch with 4 hosts on same broadcast domain
name: l2-switch
topology:
  nodes:
    switch:
      kind: linux
      image: alpine:3.20
      binds:
        - switch-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    host1:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.0.0.1/24 dev eth1
    host2:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.0.0.2/24 dev eth1
    host3:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.0.0.3/24 dev eth1
    host4:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.0.0.4/24 dev eth1

  links:
    - endpoints: ["host1:eth1", "switch:eth1"]
    - endpoints: ["host2:eth1", "switch:eth2"]
    - endpoints: ["host3:eth1", "switch:eth3"]
    - endpoints: ["host4:eth1", "switch:eth4"]
`,
			BindFiles: []BindFile{
				{FilePath: "switch-start.sh", Content: `#!/bin/ash
# Create a Linux bridge and attach all data interfaces
apk add --no-cache bridge-utils 2>/dev/null

brctl addbr br0

for iface in eth1 eth2 eth3 eth4; do
  if ip link show "$iface" > /dev/null 2>&1; then
    brctl addif br0 "$iface"
    ip link set "$iface" up
  fi
done

ip link set br0 up
echo "L2 switch ready — bridge br0 with interfaces:"
brctl show br0
`},
			},
		},
		{
			Name: "Dual Switch - Trunk Link",
			Definition: `# Two Alpine bridges connected via trunk, two hosts on each switch
name: dual-switch-trunk
topology:
  nodes:
    sw1:
      kind: linux
      image: alpine:3.20
      binds:
        - sw1-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    sw2:
      kind: linux
      image: alpine:3.20
      binds:
        - sw2-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    host1:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.0.0.1/24 dev eth1
    host2:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.0.0.2/24 dev eth1
    host3:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.0.0.3/24 dev eth1
    host4:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.0.0.4/24 dev eth1

  links:
    # Trunk between switches
    - endpoints: ["sw1:eth1", "sw2:eth1"]
    # Hosts on sw1
    - endpoints: ["host1:eth1", "sw1:eth2"]
    - endpoints: ["host2:eth1", "sw1:eth3"]
    # Hosts on sw2
    - endpoints: ["host3:eth1", "sw2:eth2"]
    - endpoints: ["host4:eth1", "sw2:eth3"]
`,
			BindFiles: []BindFile{
				{FilePath: "sw1-start.sh", Content: `#!/bin/ash
apk add --no-cache bridge-utils 2>/dev/null

brctl addbr br0

# eth1 = trunk to sw2, eth2/eth3 = access ports
for iface in eth1 eth2 eth3; do
  if ip link show "$iface" > /dev/null 2>&1; then
    brctl addif br0 "$iface"
    ip link set "$iface" up
  fi
done

ip link set br0 up
echo "sw1 ready:"
brctl show br0
`},
				{FilePath: "sw2-start.sh", Content: `#!/bin/ash
apk add --no-cache bridge-utils 2>/dev/null

brctl addbr br0

# eth1 = trunk to sw1, eth2/eth3 = access ports
for iface in eth1 eth2 eth3; do
  if ip link show "$iface" > /dev/null 2>&1; then
    brctl addif br0 "$iface"
    ip link set "$iface" up
  fi
done

ip link set br0 up
echo "sw2 ready:"
brctl show br0
`},
			},
		},
		{
			Name: "Router-on-a-Stick",
			Definition: `# CHR router with VLAN sub-interfaces, Alpine VLAN-aware bridge, two hosts
name: router-on-a-stick
topology:
  nodes:
    router:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
      startup-config: router.rsc
    switch:
      kind: linux
      image: alpine:3.20
      binds:
        - switch-start.sh:/tmp/start.sh
      exec:
        - ash /tmp/start.sh
    host-vlan10:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.10.10.10/24 dev eth1
        - ip route add 10.20.20.0/24 via 10.10.10.1
    host-vlan20:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.20.20.10/24 dev eth1
        - ip route add 10.10.10.0/24 via 10.20.20.1

  links:
    - endpoints: ["router:eth1", "switch:eth1"]
    - endpoints: ["host-vlan10:eth1", "switch:eth2"]
    - endpoints: ["host-vlan20:eth1", "switch:eth3"]
`,
			BindFiles: []BindFile{
				{FilePath: "router.rsc", Content: `# Inter-VLAN routing via VLAN sub-interfaces on ether2 (trunk)
/interface/vlan/add interface=ether2 name=vlan10 vlan-id=10
/interface/vlan/add interface=ether2 name=vlan20 vlan-id=20
/ip/address/add address=10.10.10.1/24 interface=vlan10
/ip/address/add address=10.20.20.1/24 interface=vlan20
`},
				{FilePath: "switch-start.sh", Content: `#!/bin/ash
# VLAN-aware bridge: trunk on eth1, access ports for VLANs 10 and 20
ip link add br0 type bridge vlan_filtering 1
ip link set eth1 master br0
ip link set eth2 master br0
ip link set eth3 master br0

# Trunk port: tagged VLANs 10 and 20
bridge vlan del dev eth1 vid 1
bridge vlan add dev eth1 vid 10
bridge vlan add dev eth1 vid 20

# Access port VLAN 10
bridge vlan del dev eth2 vid 1
bridge vlan add dev eth2 vid 10 pvid untagged

# Access port VLAN 20
bridge vlan del dev eth3 vid 1
bridge vlan add dev eth3 vid 20 pvid untagged

ip link set eth1 up
ip link set eth2 up
ip link set eth3 up
ip link set br0 up

echo "VLAN switch ready:"
bridge vlan show
`},
			},
		},
	},
}
