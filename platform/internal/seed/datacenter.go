package seed

var datacenterCollection = CollectionDef{
	Name: "Datacenter Fabric",
	Templates: []Template{
		{
			Name: "Leaf-Spine eBGP Fabric (SR Linux)",
			Definition: `name: srl-leaf-spine

topology:
  nodes:
    spine1:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
      startup-config: spine1.cfg
    spine2:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
      startup-config: spine2.cfg
    leaf1:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
      startup-config: leaf1.cfg
    leaf2:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
      startup-config: leaf2.cfg
    leaf3:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
      startup-config: leaf3.cfg
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
    server3:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.1.3.10/24 dev eth1
        - ip route add 10.0.0.0/8 via 10.1.3.1

  links:
    - endpoints: ["spine1:e1-1", "leaf1:e1-49"]
    - endpoints: ["spine1:e1-2", "leaf2:e1-49"]
    - endpoints: ["spine1:e1-3", "leaf3:e1-49"]
    - endpoints: ["spine2:e1-1", "leaf1:e1-50"]
    - endpoints: ["spine2:e1-2", "leaf2:e1-50"]
    - endpoints: ["spine2:e1-3", "leaf3:e1-50"]
    - endpoints: ["leaf1:e1-1", "server1:eth1"]
    - endpoints: ["leaf2:e1-1", "server2:eth1"]
    - endpoints: ["leaf3:e1-1", "server3:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "spine1.cfg", NosKind: "srl", Content: srlSpine("spine1", "10.0.0.1", "65000", []srlNeighbor{
					{Addr: "10.10.1.0/31", Peer: "10.10.1.1", PeerAS: "65001"},
					{Addr: "10.10.2.0/31", Peer: "10.10.2.1", PeerAS: "65002"},
					{Addr: "10.10.3.0/31", Peer: "10.10.3.1", PeerAS: "65003"},
				}, "e1-1", "e1-2", "e1-3")},
				{FilePath: "spine2.cfg", NosKind: "srl", Content: srlSpine("spine2", "10.0.0.2", "65000", []srlNeighbor{
					{Addr: "10.10.4.0/31", Peer: "10.10.4.1", PeerAS: "65001"},
					{Addr: "10.10.5.0/31", Peer: "10.10.5.1", PeerAS: "65002"},
					{Addr: "10.10.6.0/31", Peer: "10.10.6.1", PeerAS: "65003"},
				}, "e1-1", "e1-2", "e1-3")},
				{FilePath: "leaf1.cfg", NosKind: "srl", Content: srlLeaf("leaf1", "10.0.0.11", "65001", []srlNeighbor{
					{Addr: "10.10.1.1/31", Peer: "10.10.1.0", PeerAS: "65000"},
					{Addr: "10.10.4.1/31", Peer: "10.10.4.0", PeerAS: "65000"},
				}, "e1-49", "e1-50", "10.1.1.1/24", "e1-1")},
				{FilePath: "leaf2.cfg", NosKind: "srl", Content: srlLeaf("leaf2", "10.0.0.12", "65002", []srlNeighbor{
					{Addr: "10.10.2.1/31", Peer: "10.10.2.0", PeerAS: "65000"},
					{Addr: "10.10.5.1/31", Peer: "10.10.5.0", PeerAS: "65000"},
				}, "e1-49", "e1-50", "10.1.2.1/24", "e1-1")},
				{FilePath: "leaf3.cfg", NosKind: "srl", Content: srlLeaf("leaf3", "10.0.0.13", "65003", []srlNeighbor{
					{Addr: "10.10.3.1/31", Peer: "10.10.3.0", PeerAS: "65000"},
					{Addr: "10.10.6.1/31", Peer: "10.10.6.0", PeerAS: "65000"},
				}, "e1-49", "e1-50", "10.1.3.1/24", "e1-1")},
			},
		},
		{
			Name: "SONiC Leaf-Spine Fabric",
			Definition: `name: sonic-fabric

topology:
  nodes:
    spine1:
      kind: sonic-vs
      image: netreplica/docker-sonic-vs:latest
    spine2:
      kind: sonic-vs
      image: netreplica/docker-sonic-vs:latest
    leaf1:
      kind: sonic-vs
      image: netreplica/docker-sonic-vs:latest
    leaf2:
      kind: sonic-vs
      image: netreplica/docker-sonic-vs:latest
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
    - endpoints: ["spine1:eth1", "leaf1:eth1"]
    - endpoints: ["spine1:eth2", "leaf2:eth1"]
    - endpoints: ["spine2:eth1", "leaf1:eth2"]
    - endpoints: ["spine2:eth2", "leaf2:eth2"]
    - endpoints: ["leaf1:eth3", "server1:eth1"]
    - endpoints: ["leaf2:eth3", "server2:eth1"]
`,
		},
		{
			Name: "SR Linux + FRR Mixed Fabric",
			Definition: `name: srl-frr-mixed

topology:
  nodes:
    spine1:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
      startup-config: spine1.cfg
    spine2:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
      startup-config: spine2.cfg
    leaf1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - leaf1-daemons:/etc/frr/daemons
        - leaf1.conf:/etc/frr/frr.conf
    leaf2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
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

func srlSpine(name, routerID, as string, neighbors []srlNeighbor, ifaces ...string) string {
	cfg := "set / system information location \"Labbed DC Fabric\"\n"
	cfg += "set / system information description \"" + name + "\"\n\n"
	// Interfaces
	for i, n := range neighbors {
		iface := ifaces[i]
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
		cfg += "set / network-instance default interface " + iface + ".0\n"
	}
	cfg += "set / network-instance default interface lo0.0\n\n"
	// BGP
	cfg += "set / network-instance default protocols bgp autonomous-system " + as + "\n"
	cfg += "set / network-instance default protocols bgp router-id " + routerID + "\n"
	cfg += "set / network-instance default protocols bgp group leafs export-policy all\n"
	cfg += "set / network-instance default protocols bgp group leafs import-policy all\n"
	for _, n := range neighbors {
		cfg += "set / network-instance default protocols bgp neighbor " + n.Peer + " peer-as " + n.PeerAS + "\n"
		cfg += "set / network-instance default protocols bgp neighbor " + n.Peer + " peer-group leafs\n"
	}
	cfg += "\n"
	// Policy
	cfg += "set / routing-policy policy all default-action policy-result accept\n"
	return cfg
}

func srlLeaf(name, routerID, as string, neighbors []srlNeighbor, uplink1, uplink2, serverAddr, serverIface string) string {
	cfg := "set / system information location \"Labbed DC Fabric\"\n"
	cfg += "set / system information description \"" + name + "\"\n\n"
	// Uplinks
	for i, n := range neighbors {
		iface := uplink1
		if i == 1 {
			iface = uplink2
		}
		cfg += "set / interface " + iface + " admin-state enable\n"
		cfg += "set / interface " + iface + " subinterface 0 ipv4 admin-state enable\n"
		cfg += "set / interface " + iface + " subinterface 0 ipv4 address " + n.Addr + "\n\n"
	}
	// Server-facing
	cfg += "set / interface " + serverIface + " admin-state enable\n"
	cfg += "set / interface " + serverIface + " subinterface 0 ipv4 admin-state enable\n"
	cfg += "set / interface " + serverIface + " subinterface 0 ipv4 address " + serverAddr + "\n\n"
	// Loopback
	cfg += "set / interface lo0 admin-state enable\n"
	cfg += "set / interface lo0 subinterface 0 ipv4 admin-state enable\n"
	cfg += "set / interface lo0 subinterface 0 ipv4 address " + routerID + "/32\n\n"
	// Network instance
	cfg += "set / network-instance default type default\n"
	cfg += "set / network-instance default router-id " + routerID + "\n"
	cfg += "set / network-instance default interface " + uplink1 + ".0\n"
	cfg += "set / network-instance default interface " + uplink2 + ".0\n"
	cfg += "set / network-instance default interface " + serverIface + ".0\n"
	cfg += "set / network-instance default interface lo0.0\n\n"
	// BGP
	cfg += "set / network-instance default protocols bgp autonomous-system " + as + "\n"
	cfg += "set / network-instance default protocols bgp router-id " + routerID + "\n"
	cfg += "set / network-instance default protocols bgp group spines export-policy all\n"
	cfg += "set / network-instance default protocols bgp group spines import-policy all\n"
	for _, n := range neighbors {
		cfg += "set / network-instance default protocols bgp neighbor " + n.Peer + " peer-as " + n.PeerAS + "\n"
		cfg += "set / network-instance default protocols bgp neighbor " + n.Peer + " peer-group spines\n"
	}
	cfg += "\n"
	// Policy
	cfg += "set / routing-policy policy all default-action policy-result accept\n"
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
