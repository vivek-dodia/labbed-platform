package seed

var routingCollection = CollectionDef{
	Name: "Routing",
	Templates: []Template{
		{
			Name: "eBGP Peering - Two Routers",
			Definition: `# Two FRR routers with eBGP peering and Alpine hosts
name: ebgp-peering
topology:
  nodes:
    router1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - router1-daemons:/etc/frr/daemons
        - router1.conf:/etc/frr/frr.conf
    router2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - router2-daemons:/etc/frr/daemons
        - router2.conf:/etc/frr/frr.conf
    host1:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.1.1.10/24 dev eth1
        - ip route add 10.2.2.0/24 via 10.1.1.1
    host2:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.2.2.10/24 dev eth1
        - ip route add 10.1.1.0/24 via 10.2.2.1

  links:
    - endpoints: ["host1:eth1", "router1:eth1"]
    - endpoints: ["router1:eth2", "router2:eth2"]
    - endpoints: ["router2:eth1", "host2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "router1-daemons", Content: bgpDaemons},
				{FilePath: "router1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname router1
!
interface eth1
 ip address 10.1.1.1/24
!
interface eth2
 ip address 172.16.0.1/30
!
router bgp 65001
 bgp router-id 1.1.1.1
 neighbor 172.16.0.2 remote-as 65002
 !
 address-family ipv4 unicast
  network 10.1.1.0/24
 exit-address-family
!
line vty
`},
				{FilePath: "router2-daemons", Content: bgpDaemons},
				{FilePath: "router2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname router2
!
interface eth1
 ip address 10.2.2.1/24
!
interface eth2
 ip address 172.16.0.2/30
!
router bgp 65002
 bgp router-id 2.2.2.2
 neighbor 172.16.0.1 remote-as 65001
 !
 address-family ipv4 unicast
  network 10.2.2.0/24
 exit-address-family
!
line vty
`},
			},
		},
		{
			Name: "OSPF Triangle",
			Definition: `# Three FRR routers in OSPF area 0 with Alpine hosts
name: ospf-triangle
topology:
  nodes:
    r1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - r1-daemons:/etc/frr/daemons
        - r1.conf:/etc/frr/frr.conf
    r2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - r2-daemons:/etc/frr/daemons
        - r2.conf:/etc/frr/frr.conf
    r3:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - r3-daemons:/etc/frr/daemons
        - r3.conf:/etc/frr/frr.conf
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
    pc3:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.10.3.10/24 dev eth1
        - ip route add default via 10.10.3.1

  links:
    # Host links
    - endpoints: ["pc1:eth1", "r1:eth1"]
    - endpoints: ["pc2:eth1", "r2:eth1"]
    - endpoints: ["pc3:eth1", "r3:eth1"]
    # Router triangle
    - endpoints: ["r1:eth2", "r2:eth2"]
    - endpoints: ["r2:eth3", "r3:eth2"]
    - endpoints: ["r3:eth3", "r1:eth3"]
`,
			BindFiles: []BindFile{
				{FilePath: "r1-daemons", Content: ospfDaemons},
				{FilePath: "r1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname r1
!
interface eth1
 ip address 10.10.1.1/24
 ip ospf area 0
!
interface eth2
 ip address 172.16.12.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.13.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface lo
 ip address 1.1.1.1/32
 ip ospf area 0
!
router ospf
 ospf router-id 1.1.1.1
!
line vty
`},
				{FilePath: "r2-daemons", Content: ospfDaemons},
				{FilePath: "r2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname r2
!
interface eth1
 ip address 10.10.2.1/24
 ip ospf area 0
!
interface eth2
 ip address 172.16.12.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.23.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface lo
 ip address 2.2.2.2/32
 ip ospf area 0
!
router ospf
 ospf router-id 2.2.2.2
!
line vty
`},
				{FilePath: "r3-daemons", Content: ospfDaemons},
				{FilePath: "r3.conf", Content: `frr version 10.3
frr defaults datacenter
hostname r3
!
interface eth1
 ip address 10.10.3.1/24
 ip ospf area 0
!
interface eth2
 ip address 172.16.23.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface eth3
 ip address 172.16.13.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
interface lo
 ip address 3.3.3.3/32
 ip ospf area 0
!
router ospf
 ospf router-id 3.3.3.3
!
line vty
`},
			},
		},
		{
			Name: "OSPF Multi-Area",
			Definition: `# OSPF multi-area: core ABR bridges area 1 and area 2
name: ospf-multi-area
topology:
  nodes:
    core:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - core-daemons:/etc/frr/daemons
        - core.conf:/etc/frr/frr.conf
    area1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - area1-daemons:/etc/frr/daemons
        - area1.conf:/etc/frr/frr.conf
    area2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - area2-daemons:/etc/frr/daemons
        - area2.conf:/etc/frr/frr.conf
    host1:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.1.0.10/24 dev eth1
        - ip route add default via 10.1.0.1
    host2:
      kind: linux
      image: alpine:3.20
      exec:
        - ip addr add 10.2.0.10/24 dev eth1
        - ip route add default via 10.2.0.1

  links:
    - endpoints: ["core:eth1", "area1:eth1"]
    - endpoints: ["core:eth2", "area2:eth1"]
    - endpoints: ["area1:eth2", "host1:eth1"]
    - endpoints: ["area2:eth2", "host2:eth1"]
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
 ip ospf area 1
 ip ospf network point-to-point
!
interface eth2
 ip address 172.16.2.1/30
 ip ospf area 2
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
line vty
`},
				{FilePath: "area1-daemons", Content: ospfDaemons},
				{FilePath: "area1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname area1
!
interface lo
 ip address 10.255.0.2/32
 ip ospf area 1
!
interface eth1
 ip address 172.16.1.2/30
 ip ospf area 1
 ip ospf network point-to-point
!
interface eth2
 ip address 10.1.0.1/24
 ip ospf area 1
!
router ospf
 ospf router-id 10.255.0.2
!
line vty
`},
				{FilePath: "area2-daemons", Content: ospfDaemons},
				{FilePath: "area2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname area2
!
interface lo
 ip address 10.255.0.3/32
 ip ospf area 2
!
interface eth1
 ip address 172.16.2.2/30
 ip ospf area 2
 ip ospf network point-to-point
!
interface eth2
 ip address 10.2.0.1/24
 ip ospf area 2
!
router ospf
 ospf router-id 10.255.0.3
!
line vty
`},
			},
		},
		{
			Name: "BGP + OSPF Backbone",
			Definition: `# SP-style backbone: iBGP between PE routers (OSPF IGP), eBGP to CEs
name: bgp-ospf-backbone
topology:
  nodes:
    pe1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - pe1-daemons:/etc/frr/daemons
        - pe1.conf:/etc/frr/frr.conf
    pe2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - pe2-daemons:/etc/frr/daemons
        - pe2.conf:/etc/frr/frr.conf
    ce1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - ce1-daemons:/etc/frr/daemons
        - ce1.conf:/etc/frr/frr.conf
    ce2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
      binds:
        - ce2-daemons:/etc/frr/daemons
        - ce2.conf:/etc/frr/frr.conf

  links:
    - endpoints: ["ce1:eth1", "pe1:eth1"]
    - endpoints: ["pe1:eth2", "pe2:eth2"]
    - endpoints: ["pe2:eth1", "ce2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "pe1-daemons", Content: bgpOspfDaemons},
				{FilePath: "pe1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname pe1
!
interface lo
 ip address 10.255.0.1/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.1.1/30
!
interface eth2
 ip address 172.16.0.1/30
 ip ospf area 0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.1
!
router bgp 65000
 bgp router-id 10.255.0.1
 neighbor 10.255.0.2 remote-as 65000
 neighbor 10.255.0.2 update-source lo
 neighbor 172.16.1.2 remote-as 65001
 !
 address-family ipv4 unicast
  neighbor 10.255.0.2 next-hop-self
 exit-address-family
!
line vty
`},
				{FilePath: "pe2-daemons", Content: bgpOspfDaemons},
				{FilePath: "pe2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname pe2
!
interface lo
 ip address 10.255.0.2/32
 ip ospf area 0
!
interface eth1
 ip address 172.16.2.1/30
!
interface eth2
 ip address 172.16.0.2/30
 ip ospf area 0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.2
!
router bgp 65000
 bgp router-id 10.255.0.2
 neighbor 10.255.0.1 remote-as 65000
 neighbor 10.255.0.1 update-source lo
 neighbor 172.16.2.2 remote-as 65002
 !
 address-family ipv4 unicast
  neighbor 10.255.0.1 next-hop-self
 exit-address-family
!
line vty
`},
				{FilePath: "ce1-daemons", Content: bgpDaemons},
				{FilePath: "ce1.conf", Content: `frr version 10.3
frr defaults datacenter
hostname ce1
!
interface lo
 ip address 10.255.1.1/32
!
interface eth1
 ip address 172.16.1.2/30
!
router bgp 65001
 bgp router-id 10.255.1.1
 neighbor 172.16.1.1 remote-as 65000
 !
 address-family ipv4 unicast
  network 10.1.0.0/24
 exit-address-family
!
ip route 10.1.0.0/24 Null0
!
line vty
`},
				{FilePath: "ce2-daemons", Content: bgpDaemons},
				{FilePath: "ce2.conf", Content: `frr version 10.3
frr defaults datacenter
hostname ce2
!
interface lo
 ip address 10.255.2.1/32
!
interface eth1
 ip address 172.16.2.2/30
!
router bgp 65002
 bgp router-id 10.255.2.1
 neighbor 172.16.2.1 remote-as 65000
 !
 address-family ipv4 unicast
  network 10.2.0.0/24
 exit-address-family
!
ip route 10.2.0.0/24 Null0
!
line vty
`},
			},
		},
	},
}
