package seed

import "strings"

var datacenterCollection = CollectionDef{
	Name: "Datacenter Fabric",
	Templates: []Template{
		{
			Name: "SR Linux — Single Node Explorer",
			Definition: `name: srl-single

topology:
  nodes:
    srl:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1

  links: []
`,
		},
		{
			Name: "SR Linux — Two Node Peering",
			Definition: `name: srl-peering

topology:
  nodes:
    srl1:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: srl1.cfg
    srl2:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: srl2.cfg

  links:
    - endpoints: ["srl1:e1-1", "srl2:e1-1"]
`,
			BindFiles: []BindFile{
				{FilePath: "srl1.cfg", NosKind: "srl", Content: `set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 10.0.0.0/31

set / interface lo0 admin-state enable
set / interface lo0 subinterface 0 ipv4 admin-state enable
set / interface lo0 subinterface 0 ipv4 address 10.0.0.11/32

set / routing-policy policy all default-action policy-result accept

set / network-instance default type default
set / network-instance default router-id 10.0.0.11
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface lo0.0
set / network-instance default protocols bgp autonomous-system 65001
set / network-instance default protocols bgp router-id 10.0.0.11
set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp group peer export-policy [ all ]
set / network-instance default protocols bgp group peer import-policy [ all ]
set / network-instance default protocols bgp group peer afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp neighbor 10.0.0.1 peer-as 65002
set / network-instance default protocols bgp neighbor 10.0.0.1 peer-group peer
`},
				{FilePath: "srl2.cfg", NosKind: "srl", Content: `set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 10.0.0.1/31

set / interface lo0 admin-state enable
set / interface lo0 subinterface 0 ipv4 admin-state enable
set / interface lo0 subinterface 0 ipv4 address 10.0.0.12/32

set / routing-policy policy all default-action policy-result accept

set / network-instance default type default
set / network-instance default router-id 10.0.0.12
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface lo0.0
set / network-instance default protocols bgp autonomous-system 65002
set / network-instance default protocols bgp router-id 10.0.0.12
set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp group peer export-policy [ all ]
set / network-instance default protocols bgp group peer import-policy [ all ]
set / network-instance default protocols bgp group peer afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp neighbor 10.0.0.0 peer-as 65001
set / network-instance default protocols bgp neighbor 10.0.0.0 peer-group peer
`},
			},
		},
		{
			Name: "SR Linux + FRR Peering",
			Definition: `name: srl-frr-peering

topology:
  nodes:
    srl:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: srl.cfg
    frr:
      kind: linux
      image: ghcr.io/vivek-dodia/mirror-frr:10.3.1
      binds:
        - frr-daemons:/etc/frr/daemons
        - frr.conf:/etc/frr/frr.conf

  links:
    - endpoints: ["srl:e1-1", "frr:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "srl.cfg", NosKind: "srl", Content: `set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 10.1.0.0/31

set / interface lo0 admin-state enable
set / interface lo0 subinterface 0 ipv4 admin-state enable
set / interface lo0 subinterface 0 ipv4 address 10.255.0.1/32

set / routing-policy policy all default-action policy-result accept

set / network-instance default type default
set / network-instance default router-id 10.255.0.1
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface lo0.0
set / network-instance default protocols bgp autonomous-system 65001
set / network-instance default protocols bgp router-id 10.255.0.1
set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp group frr export-policy [ all ]
set / network-instance default protocols bgp group frr import-policy [ all ]
set / network-instance default protocols bgp group frr afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp neighbor 10.1.0.1 peer-as 65002
set / network-instance default protocols bgp neighbor 10.1.0.1 peer-group frr
`},
				{FilePath: "frr-daemons", NosKind: "frr", Content: frrDaemons},
				{FilePath: "frr.conf", NosKind: "frr", Content: `frr version 10.3.1
frr defaults traditional
hostname frr
!
interface eth1
 ip address 10.1.0.1/31
!
interface lo
 ip address 10.255.0.2/32
!
router bgp 65002
 bgp router-id 10.255.0.2
 no bgp ebgp-requires-policy
 neighbor 10.1.0.0 remote-as 65001
 !
 address-family ipv4 unicast
  redistribute connected
 exit-address-family
!
line vty
!
`},
			},
		},
		{
			Name: "SR Linux + SONiC Peering",
			Definition: `name: srl-sonic-peering

topology:
  nodes:
    srl:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: srl.cfg
    sonic:
      kind: sonic-vs
      image: ghcr.io/vivek-dodia/mirror-sonic-vs:latest
      startup-config: sonic.json

  links:
    - endpoints: ["srl:e1-1", "sonic:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "srl.cfg", NosKind: "srl", Content: `set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 10.1.0.0/31

set / interface lo0 admin-state enable
set / interface lo0 subinterface 0 ipv4 admin-state enable
set / interface lo0 subinterface 0 ipv4 address 10.255.0.1/32

set / routing-policy policy all default-action policy-result accept

set / network-instance default type default
set / network-instance default router-id 10.255.0.1
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface lo0.0
set / network-instance default protocols bgp autonomous-system 65001
set / network-instance default protocols bgp router-id 10.255.0.1
set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp group sonic export-policy [ all ]
set / network-instance default protocols bgp group sonic import-policy [ all ]
set / network-instance default protocols bgp group sonic afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp neighbor 10.1.0.1 peer-as 65002
set / network-instance default protocols bgp neighbor 10.1.0.1 peer-group sonic
`},
				{FilePath: "sonic.json", NosKind: "sonic-vs", Content: sonicConfig("sonic", "10.255.0.2", "65002", []sonicNeighbor{
					{Addr: "10.1.0.0", LocalAddr: "10.1.0.1", PeerAS: "65001"},
				}, []sonicInterface{
					{Name: "Ethernet0", Addr: "10.1.0.1/31"},
				})},
			},
		},
		{
			Name:  "Leaf-Spine eBGP Fabric (SR Linux)",
			Draft: true, // Requires >8GB RAM (3 SRL nodes × ~2GB each)
			Definition: `# 1 spine + 2 leafs with eBGP underlay and host endpoints
name: srl-leaf-spine

topology:
  nodes:
    spine:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: spine.cfg
    leaf1:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: leaf1.cfg
    leaf2:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: leaf2.cfg
    server1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.1.10/24 dev eth1
        - ip route add 10.0.0.0/8 via 10.1.1.1
    server2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.2.10/24 dev eth1
        - ip route add 10.0.0.0/8 via 10.1.2.1

  links:
    - endpoints: ["spine:e1-1", "leaf1:e1-49"]
    - endpoints: ["spine:e1-2", "leaf2:e1-49"]
    - endpoints: ["leaf1:e1-1", "server1:eth1"]
    - endpoints: ["leaf2:e1-1", "server2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "spine.cfg", NosKind: "srl", Content: srlSpine("spine", "10.0.0.1", "65000", []srlNeighbor{
					{Addr: "10.10.1.0/31", Peer: "10.10.1.1", PeerAS: "65001"},
					{Addr: "10.10.2.0/31", Peer: "10.10.2.1", PeerAS: "65002"},
				}, "e1-1", "e1-2")},
				{FilePath: "leaf1.cfg", NosKind: "srl", Content: `set / system information location "Labbed DC Fabric — leaf1"

set / interface ethernet-1/49 admin-state enable
set / interface ethernet-1/49 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/49 subinterface 0 ipv4 address 10.10.1.1/31

set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 10.1.1.1/24

set / interface lo0 admin-state enable
set / interface lo0 subinterface 0 ipv4 admin-state enable
set / interface lo0 subinterface 0 ipv4 address 10.0.0.11/32

set / routing-policy policy all default-action policy-result accept

set / network-instance default type default
set / network-instance default router-id 10.0.0.11
set / network-instance default interface ethernet-1/49.0
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface lo0.0
set / network-instance default protocols bgp autonomous-system 65001
set / network-instance default protocols bgp router-id 10.0.0.11
set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp group spine export-policy [ all ]
set / network-instance default protocols bgp group spine import-policy [ all ]
set / network-instance default protocols bgp group spine afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp neighbor 10.10.1.0 peer-as 65000
set / network-instance default protocols bgp neighbor 10.10.1.0 peer-group spine
`},
				{FilePath: "leaf2.cfg", NosKind: "srl", Content: `set / system information location "Labbed DC Fabric — leaf2"

set / interface ethernet-1/49 admin-state enable
set / interface ethernet-1/49 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/49 subinterface 0 ipv4 address 10.10.2.1/31

set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 10.1.2.1/24

set / interface lo0 admin-state enable
set / interface lo0 subinterface 0 ipv4 admin-state enable
set / interface lo0 subinterface 0 ipv4 address 10.0.0.12/32

set / routing-policy policy all default-action policy-result accept

set / network-instance default type default
set / network-instance default router-id 10.0.0.12
set / network-instance default interface ethernet-1/49.0
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface lo0.0
set / network-instance default protocols bgp autonomous-system 65002
set / network-instance default protocols bgp router-id 10.0.0.12
set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp group spine export-policy [ all ]
set / network-instance default protocols bgp group spine import-policy [ all ]
set / network-instance default protocols bgp group spine afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp neighbor 10.10.2.0 peer-as 65000
set / network-instance default protocols bgp neighbor 10.10.2.0 peer-group spine
`},
			},
		},
		{
			Name:  "SONiC Leaf-Spine Fabric",
			Draft: true, // Requires >8GB RAM (3 SONiC nodes)
			Definition: `# 1 spine + 2 leafs with eBGP underlay
name: sonic-fabric

topology:
  nodes:
    spine:
      kind: sonic-vs
      image: ghcr.io/vivek-dodia/mirror-sonic-vs:latest
      startup-config: spine.json
    leaf1:
      kind: sonic-vs
      image: ghcr.io/vivek-dodia/mirror-sonic-vs:latest
      startup-config: leaf1.json
    leaf2:
      kind: sonic-vs
      image: ghcr.io/vivek-dodia/mirror-sonic-vs:latest
      startup-config: leaf2.json
    server1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.1.10/24 dev eth1
        - ip route add 10.0.0.0/8 via 10.1.1.1
    server2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.2.10/24 dev eth1
        - ip route add 10.0.0.0/8 via 10.1.2.1

  links:
    - endpoints: ["spine:eth1", "leaf1:eth1"]
    - endpoints: ["spine:eth2", "leaf2:eth1"]
    - endpoints: ["leaf1:eth3", "server1:eth1"]
    - endpoints: ["leaf2:eth3", "server2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "spine.json", NosKind: "sonic-vs", Content: sonicConfig("spine", "10.0.0.1", "65000", []sonicNeighbor{
					{Addr: "10.10.1.1", LocalAddr: "10.10.1.0", PeerAS: "65001"},
					{Addr: "10.10.2.1", LocalAddr: "10.10.2.0", PeerAS: "65002"},
				}, []sonicInterface{
					{Name: "Ethernet0", Addr: "10.10.1.0/31"},
					{Name: "Ethernet4", Addr: "10.10.2.0/31"},
				})},
				{FilePath: "leaf1.json", NosKind: "sonic-vs", Content: sonicConfig("leaf1", "10.0.0.11", "65001", []sonicNeighbor{
					{Addr: "10.10.1.0", LocalAddr: "10.10.1.1", PeerAS: "65000"},
				}, []sonicInterface{
					{Name: "Ethernet0", Addr: "10.10.1.1/31"},
					{Name: "Ethernet8", Addr: "10.1.1.1/24"},
				})},
				{FilePath: "leaf2.json", NosKind: "sonic-vs", Content: sonicConfig("leaf2", "10.0.0.12", "65002", []sonicNeighbor{
					{Addr: "10.10.2.0", LocalAddr: "10.10.2.1", PeerAS: "65000"},
				}, []sonicInterface{
					{Name: "Ethernet0", Addr: "10.10.2.1/31"},
					{Name: "Ethernet8", Addr: "10.1.2.1/24"},
				})},
			},
		},
		{
			Name: "SR Linux + FRR Mixed Fabric",
			Definition: `name: srl-frr-mixed

topology:
  nodes:
    spine1:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: spine1.cfg
    spine2:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: spine2.cfg
    leaf1:
      kind: linux
      image: ghcr.io/vivek-dodia/mirror-frr:10.3.1
      binds:
        - leaf1-daemons:/etc/frr/daemons
        - leaf1.conf:/etc/frr/frr.conf
    leaf2:
      kind: linux
      image: ghcr.io/vivek-dodia/mirror-frr:10.3.1
      binds:
        - leaf2-daemons:/etc/frr/daemons
        - leaf2.conf:/etc/frr/frr.conf
    h1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.1.10/24 dev eth1
        - ip route add 10.0.0.0/8 via 10.1.1.1
    h2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.2.10/24 dev eth1
        - ip route add 10.0.0.0/8 via 10.1.2.1

  links:
    - endpoints: ["spine1:e1-1", "leaf1:eth1"]
    - endpoints: ["spine1:e1-2", "leaf2:eth1"]
    - endpoints: ["spine2:e1-1", "leaf1:eth2"]
    - endpoints: ["spine2:e1-2", "leaf2:eth2"]
    - endpoints: ["leaf1:eth3", "h1:eth1"]
    - endpoints: ["leaf2:eth3", "h2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "spine1.cfg", NosKind: "srl", Content: srlSpine("spine1", "10.0.0.1", "65000", []srlNeighbor{
					{Addr: "10.10.1.0/31", Peer: "10.10.1.1", PeerAS: "65001"},
					{Addr: "10.10.2.0/31", Peer: "10.10.2.1", PeerAS: "65002"},
				}, "e1-1", "e1-2")},
				{FilePath: "spine2.cfg", NosKind: "srl", Content: srlSpine("spine2", "10.0.0.2", "65000", []srlNeighbor{
					{Addr: "10.10.3.0/31", Peer: "10.10.3.1", PeerAS: "65001"},
					{Addr: "10.10.4.0/31", Peer: "10.10.4.1", PeerAS: "65002"},
				}, "e1-1", "e1-2")},
				{FilePath: "leaf1-daemons", NosKind: "frr", Content: frrDaemons},
				{FilePath: "leaf1.conf", NosKind: "frr", Content: frrLeaf("leaf1", "10.0.0.11", "65001", []frrNeighbor{
					{Addr: "10.10.1.1/31", Peer: "10.10.1.0", PeerAS: "65000", Iface: "eth1"},
					{Addr: "10.10.3.1/31", Peer: "10.10.3.0", PeerAS: "65000", Iface: "eth2"},
				}, "10.1.1.1/24", "eth3")},
				{FilePath: "leaf2-daemons", NosKind: "frr", Content: frrDaemons},
				{FilePath: "leaf2.conf", NosKind: "frr", Content: frrLeaf("leaf2", "10.0.0.12", "65002", []frrNeighbor{
					{Addr: "10.10.2.1/31", Peer: "10.10.2.0", PeerAS: "65000", Iface: "eth1"},
					{Addr: "10.10.4.1/31", Peer: "10.10.4.0", PeerAS: "65000", Iface: "eth2"},
				}, "10.1.2.1/24", "eth3")},
			},
		},
	},
}

// ── SR Linux config generators ──

type srlNeighbor struct {
	Addr, Peer, PeerAS string
}

// srlIfaceName converts containerlab short interface names to SR Linux full names.
// e.g. "e1-1" → "ethernet-1/1"
func srlIfaceName(short string) string {
	if strings.HasPrefix(short, "e") && strings.Contains(short, "-") {
		// e1-1 → ethernet-1/1
		parts := strings.SplitN(short[1:], "-", 2)
		if len(parts) == 2 {
			return "ethernet-" + parts[0] + "/" + parts[1]
		}
	}
	return short
}

func srlSpine(name, routerID, as string, neighbors []srlNeighbor, ifaces ...string) string {
	cfg := "set / system information location \"Labbed DC Fabric — " + name + "\"\n\n"
	// Interfaces
	for i, n := range neighbors {
		iface := srlIfaceName(ifaces[i])
		cfg += "set / interface " + iface + " admin-state enable\n"
		cfg += "set / interface " + iface + " subinterface 0 ipv4 admin-state enable\n"
		cfg += "set / interface " + iface + " subinterface 0 ipv4 address " + n.Addr + "\n\n"
	}
	// Loopback
	cfg += "set / interface lo0 admin-state enable\n"
	cfg += "set / interface lo0 subinterface 0 ipv4 admin-state enable\n"
	cfg += "set / interface lo0 subinterface 0 ipv4 address " + routerID + "/32\n\n"
	// Network instance
	cfg += "set / network-instance default type default\n"
	cfg += "set / network-instance default router-id " + routerID + "\n"
	for _, iface := range ifaces {
		cfg += "set / network-instance default interface " + srlIfaceName(iface) + ".0\n"
	}
	cfg += "set / network-instance default interface lo0.0\n\n"
	// BGP
	// Policy (must come before BGP references to it)
	cfg += "set / routing-policy policy all default-action policy-result accept\n\n"
	// BGP
	cfg += "set / network-instance default protocols bgp autonomous-system " + as + "\n"
	cfg += "set / network-instance default protocols bgp router-id " + routerID + "\n"
	cfg += "set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable\n"
	cfg += "set / network-instance default protocols bgp group leafs export-policy [ all ]\n"
	cfg += "set / network-instance default protocols bgp group leafs import-policy [ all ]\n"
	cfg += "set / network-instance default protocols bgp group leafs afi-safi ipv4-unicast admin-state enable\n"
	for _, n := range neighbors {
		cfg += "set / network-instance default protocols bgp neighbor " + n.Peer + " peer-as " + n.PeerAS + "\n"
		cfg += "set / network-instance default protocols bgp neighbor " + n.Peer + " peer-group leafs\n"
	}
	return cfg
}

func srlLeaf(name, routerID, as string, neighbors []srlNeighbor, uplink1, uplink2, serverAddr, serverIface string) string {
	cfg := "set / system information location \"Labbed DC Fabric — " + name + "\"\n\n"
	// Uplinks
	ul1 := srlIfaceName(uplink1)
	ul2 := srlIfaceName(uplink2)
	srvIface := srlIfaceName(serverIface)
	for i, n := range neighbors {
		iface := ul1
		if i == 1 {
			iface = ul2
		}
		cfg += "set / interface " + iface + " admin-state enable\n"
		cfg += "set / interface " + iface + " subinterface 0 ipv4 admin-state enable\n"
		cfg += "set / interface " + iface + " subinterface 0 ipv4 address " + n.Addr + "\n\n"
	}
	// Server-facing
	cfg += "set / interface " + srvIface + " admin-state enable\n"
	cfg += "set / interface " + srvIface + " subinterface 0 ipv4 admin-state enable\n"
	cfg += "set / interface " + srvIface + " subinterface 0 ipv4 address " + serverAddr + "\n\n"
	// Loopback
	cfg += "set / interface lo0 admin-state enable\n"
	cfg += "set / interface lo0 subinterface 0 ipv4 admin-state enable\n"
	cfg += "set / interface lo0 subinterface 0 ipv4 address " + routerID + "/32\n\n"
	// Network instance
	cfg += "set / network-instance default type default\n"
	cfg += "set / network-instance default router-id " + routerID + "\n"
	cfg += "set / network-instance default interface " + ul1 + ".0\n"
	cfg += "set / network-instance default interface " + ul2 + ".0\n"
	cfg += "set / network-instance default interface " + srvIface + ".0\n"
	cfg += "set / network-instance default interface lo0.0\n\n"
	// Policy (must come before BGP references)
	cfg += "set / routing-policy policy all default-action policy-result accept\n\n"
	// BGP
	cfg += "set / network-instance default protocols bgp autonomous-system " + as + "\n"
	cfg += "set / network-instance default protocols bgp router-id " + routerID + "\n"
	cfg += "set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable\n"
	cfg += "set / network-instance default protocols bgp group spines export-policy [ all ]\n"
	cfg += "set / network-instance default protocols bgp group spines import-policy [ all ]\n"
	cfg += "set / network-instance default protocols bgp group spines afi-safi ipv4-unicast admin-state enable\n"
	for _, n := range neighbors {
		cfg += "set / network-instance default protocols bgp neighbor " + n.Peer + " peer-as " + n.PeerAS + "\n"
		cfg += "set / network-instance default protocols bgp neighbor " + n.Peer + " peer-group spines\n"
	}
	return cfg
}

// ── FRR config generators ──

type frrNeighbor struct {
	Addr, Peer, PeerAS, Iface string
}

const frrDaemons = `bgpd=yes
ospfd=no
ospf6d=no
ripd=no
ripngd=no
isisd=no
pimd=no
ldpd=no
nhrpd=no
eigrpd=no
babeld=no
sharpd=no
pbrd=no
bfdd=no
fabricd=no
vrrpd=no
`

// ── SONiC config_db.json generator ──

type sonicNeighbor struct {
	Addr, LocalAddr, PeerAS string
}

type sonicInterface struct {
	Name, Addr string
}

func sonicConfig(hostname, loopbackIP, asn string, neighbors []sonicNeighbor, interfaces []sonicInterface) string {
	cfg := "{\n"
	// DEVICE_METADATA
	cfg += "  \"DEVICE_METADATA\": {\n"
	cfg += "    \"localhost\": {\n"
	cfg += "      \"bgp_asn\": \"" + asn + "\",\n"
	cfg += "      \"hostname\": \"" + hostname + "\",\n"
	cfg += "      \"hwsku\": \"Force10-S6000\",\n"
	cfg += "      \"platform\": \"x86_64-kvm_x86_64-r0\",\n"
	cfg += "      \"type\": \"LeafRouter\"\n"
	cfg += "    }\n"
	cfg += "  },\n"
	// LOOPBACK_INTERFACE
	cfg += "  \"LOOPBACK_INTERFACE\": {\n"
	cfg += "    \"Loopback0\": {},\n"
	cfg += "    \"Loopback0|" + loopbackIP + "/32\": {}\n"
	cfg += "  },\n"
	// INTERFACE
	cfg += "  \"INTERFACE\": {\n"
	for i, iface := range interfaces {
		cfg += "    \"" + iface.Name + "\": {},\n"
		comma := ","
		if i == len(interfaces)-1 {
			comma = ""
		}
		cfg += "    \"" + iface.Name + "|" + iface.Addr + "\": {}" + comma + "\n"
	}
	cfg += "  },\n"
	// PORT — enable all referenced interfaces
	cfg += "  \"PORT\": {\n"
	for i, iface := range interfaces {
		comma := ","
		if i == len(interfaces)-1 {
			comma = ""
		}
		cfg += "    \"" + iface.Name + "\": { \"admin_status\": \"up\", \"speed\": \"10000\" }" + comma + "\n"
	}
	cfg += "  },\n"
	// BGP_NEIGHBOR
	cfg += "  \"BGP_NEIGHBOR\": {\n"
	for i, n := range neighbors {
		comma := ","
		if i == len(neighbors)-1 {
			comma = ""
		}
		cfg += "    \"" + n.Addr + "\": {\n"
		cfg += "      \"asn\": \"" + n.PeerAS + "\",\n"
		cfg += "      \"holdtime\": \"180\",\n"
		cfg += "      \"keepalive\": \"60\",\n"
		cfg += "      \"local_addr\": \"" + n.LocalAddr + "\",\n"
		cfg += "      \"name\": \"" + n.Addr + "\",\n"
		cfg += "      \"nhopself\": \"0\",\n"
		cfg += "      \"rrclient\": \"0\"\n"
		cfg += "    }" + comma + "\n"
	}
	cfg += "  }\n"
	cfg += "}\n"
	return cfg
}

func frrLeaf(name, routerID, as string, neighbors []frrNeighbor, serverAddr, serverIface string) string {
	cfg := "frr version 10.3.1\n"
	cfg += "frr defaults traditional\n"
	cfg += "hostname " + name + "\n"
	cfg += "!\n"
	// Interfaces
	for _, n := range neighbors {
		cfg += "interface " + n.Iface + "\n"
		cfg += " ip address " + n.Addr + "\n"
		cfg += "!\n"
	}
	cfg += "interface " + serverIface + "\n"
	cfg += " ip address " + serverAddr + "\n"
	cfg += "!\n"
	cfg += "interface lo\n"
	cfg += " ip address " + routerID + "/32\n"
	cfg += "!\n"
	// BGP
	cfg += "router bgp " + as + "\n"
	cfg += " bgp router-id " + routerID + "\n"
	cfg += " no bgp ebgp-requires-policy\n"
	for _, n := range neighbors {
		cfg += " neighbor " + n.Peer + " remote-as " + n.PeerAS + "\n"
	}
	cfg += " !\n"
	cfg += " address-family ipv4 unicast\n"
	cfg += "  redistribute connected\n"
	cfg += " exit-address-family\n"
	cfg += "!\n"
	cfg += "line vty\n"
	cfg += "!\n"
	return cfg
}
