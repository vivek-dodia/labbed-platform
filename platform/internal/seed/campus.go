package seed

var campusCollection = CollectionDef{
	Name: "Campus Network",
	Templates: []Template{
		{
			Name: "Campus Core - OSPF + Hosts",
			Definition: `# Two-tier campus: core + distribution routers with host endpoints
name: campus-core
topology:
  nodes:
    core:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - core-daemons:/etc/frr/daemons
        - core.conf:/etc/frr/frr.conf
    dist1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - dist1-daemons:/etc/frr/daemons
        - dist1.conf:/etc/frr/frr.conf
    dist2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - dist2-daemons:/etc/frr/daemons
        - dist2.conf:/etc/frr/frr.conf
    pc1:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.10.1.10/24 dev eth1
        - ip route add default via 10.10.1.1
    pc2:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.10.2.10/24 dev eth1
        - ip route add default via 10.10.2.1

  links:
    - endpoints: ["core:eth1", "dist1:eth1"]
    - endpoints: ["core:eth2", "dist2:eth1"]
    - endpoints: ["dist1:eth2", "pc1:eth1"]
    - endpoints: ["dist2:eth2", "pc2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "core-daemons", Content: ospfDaemons},
				{FilePath: "core.conf", Content: `frr version 10.3
frr defaults datacenter
hostname core
!
interface lo
 ip address 10.255.0.1/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.1.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth2
 ip address 172.16.2.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
line vty
`},
				{FilePath: "dist1-daemons", Content: ospfDaemons},
				{FilePath: "dist1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname dist1
!
interface lo
 ip address 10.255.0.2/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.1.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.10.1.1/24
 ip ospf area 0
!
router ospf
 ospf router-id 10.255.0.2
!
line vty
`},
				{FilePath: "dist2-daemons", Content: ospfDaemons},
				{FilePath: "dist2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname dist2
!
interface lo
 ip address 10.255.0.3/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.2.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.10.2.1/24
 ip ospf area 0
!
router ospf
 ospf router-id 10.255.0.3
!
line vty
`},
			},
		},
		{
			Name: "Campus with DHCP + DNS",
			Definition: `# Campus network with Kea DHCP, CoreDNS, and client endpoints
name: campus-dhcp-dns
topology:
  nodes:
    core:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - core-daemons:/etc/frr/daemons
        - core.conf:/etc/frr/frr.conf
    dist:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - dist-daemons:/etc/frr/daemons
        - dist.conf:/etc/frr/frr.conf
    dhcp:
      kind: linux
      image: docker.cloudsmith.io/isc/docker/kea-dhcp4:2.6
      binds:
        - kea-dhcp4.conf:/etc/kea/kea-dhcp4.conf
      exec:
        - ip addr add 10.10.1.2/24 dev eth1
        - ip route add default via 10.10.1.1
    dns:
      kind: linux
      image: coredns/coredns:1.12.0
      binds:
        - Corefile:/etc/coredns/Corefile
        - hosts.db:/etc/coredns/hosts.db
      cmd: "-conf /etc/coredns/Corefile"
      exec:
        - ip addr add 10.10.2.2/24 dev eth1
        - ip route add default via 10.10.2.1
    pc1:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 10.10.3.10/24 dev eth1
        - ip route add default via 10.10.3.1
    pc2:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 10.10.4.10/24 dev eth1
        - ip route add default via 10.10.4.1

  links:
    - endpoints: ["core:eth1", "dist:eth1"]
    - endpoints: ["dist:eth2", "dhcp:eth1"]
    - endpoints: ["dist:eth3", "dns:eth1"]
    - endpoints: ["dist:eth4", "pc1:eth1"]
    - endpoints: ["dist:eth5", "pc2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "core-daemons", Content: ospfDaemons},
				{FilePath: "core.conf", Content: `frr version 10.3
frr defaults datacenter
hostname core
!
interface lo
 ip address 10.255.0.1/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.0.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
line vty
`},
				{FilePath: "dist-daemons", Content: ospfDaemons},
				{FilePath: "dist.conf", Content: `frr version 10.3
frr defaults datacenter
hostname dist
!
interface lo
 ip address 10.255.0.2/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.0.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.10.1.1/24
 ip ospf area 0
!
interface eth3
 ip address 10.10.2.1/24
 ip ospf area 0
!
interface eth4
 ip address 10.10.3.1/24
 ip ospf area 0
!
interface eth5
 ip address 10.10.4.1/24
 ip ospf area 0
!
router ospf
 ospf router-id 10.255.0.2
!
line vty
`},
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
          {"name": "routers", "data": "10.10.1.1"},
          {"name": "domain-name-servers", "data": "10.10.2.2"}
        ]
      }
    ]
  }
}
`},
				{FilePath: "Corefile", Content: `campus.lab {
    hosts /etc/coredns/hosts.db
    log
}

. {
    forward . 8.8.8.8
    log
}
`},
				{FilePath: "hosts.db", Content: `10.10.1.2  dhcp.campus.lab
10.10.2.2  dns.campus.lab
10.10.3.10 pc1.campus.lab
10.10.4.10 pc2.campus.lab
`},
			},
		},
		{
			Name: "Full Campus",
			Definition: `# Full campus: dual distribution, Kea DHCP, CoreDNS, and multiple hosts
name: full-campus
topology:
  nodes:
    core:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - core-daemons:/etc/frr/daemons
        - core.conf:/etc/frr/frr.conf
    dist1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - dist1-daemons:/etc/frr/daemons
        - dist1.conf:/etc/frr/frr.conf
    dist2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - dist2-daemons:/etc/frr/daemons
        - dist2.conf:/etc/frr/frr.conf
    dhcp:
      kind: linux
      image: docker.cloudsmith.io/isc/docker/kea-dhcp4:2.6
      binds:
        - kea-dhcp4.conf:/etc/kea/kea-dhcp4.conf
      exec:
        - ip addr add 10.10.1.2/24 dev eth1
        - ip route add default via 10.10.1.1
    dns:
      kind: linux
      image: coredns/coredns:1.12.0
      binds:
        - Corefile:/etc/coredns/Corefile
        - hosts.db:/etc/coredns/hosts.db
      cmd: "-conf /etc/coredns/Corefile"
      exec:
        - ip addr add 10.10.2.2/24 dev eth1
        - ip route add default via 10.10.2.1
    pc1:
      kind: linux
      image: ghcr.io/srl-labs/network-multitool
      exec:
        - ip addr add 10.10.3.10/24 dev eth1
        - ip route add default via 10.10.3.1
    pc2:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.20.1.10/24 dev eth1
        - ip route add default via 10.20.1.1
    pc3:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.20.2.10/24 dev eth1
        - ip route add default via 10.20.2.1

  links:
    # Core to distribution
    - endpoints: ["core:eth1", "dist1:eth1"]
    - endpoints: ["core:eth2", "dist2:eth1"]
    # dist1: services + one client
    - endpoints: ["dist1:eth2", "dhcp:eth1"]
    - endpoints: ["dist1:eth3", "dns:eth1"]
    - endpoints: ["dist1:eth4", "pc1:eth1"]
    # dist2: client endpoints
    - endpoints: ["dist2:eth2", "pc2:eth1"]
    - endpoints: ["dist2:eth3", "pc3:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "core-daemons", Content: ospfDaemons},
				{FilePath: "core.conf", Content: `frr version 10.3
frr defaults datacenter
hostname core
!
interface lo
 ip address 10.255.0.1/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.1.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth2
 ip address 172.16.2.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
line vty
`},
				{FilePath: "dist1-daemons", Content: ospfDaemons},
				{FilePath: "dist1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname dist1
!
interface lo
 ip address 10.255.0.2/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.1.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.10.1.1/24
 ip ospf area 0
!
interface eth3
 ip address 10.10.2.1/24
 ip ospf area 0
!
interface eth4
 ip address 10.10.3.1/24
 ip ospf area 0
!
router ospf
 ospf router-id 10.255.0.2
!
line vty
`},
				{FilePath: "dist2-daemons", Content: ospfDaemons},
				{FilePath: "dist2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname dist2
!
interface lo
 ip address 10.255.0.3/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.2.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth2
 ip address 10.20.1.1/24
 ip ospf area 0
!
interface eth3
 ip address 10.20.2.1/24
 ip ospf area 0
!
router ospf
 ospf router-id 10.255.0.3
!
line vty
`},
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
          {"name": "routers", "data": "10.10.1.1"},
          {"name": "domain-name-servers", "data": "10.10.2.2"}
        ]
      }
    ]
  }
}
`},
				{FilePath: "Corefile", Content: `campus.lab {
    hosts /etc/coredns/hosts.db
    log
}

. {
    forward . 8.8.8.8
    log
}
`},
				{FilePath: "hosts.db", Content: `10.10.1.2  dhcp.campus.lab
10.10.2.2  dns.campus.lab
10.10.3.10 pc1.campus.lab
10.20.1.10 pc2.campus.lab
10.20.2.10 pc3.campus.lab
`},
			},
		},
	},
}
