package seed

var l2vpnCollection = CollectionDef{
	Name: "L2VPN",
	Templates: []Template{
		{
			Name: "EoIP Tunnel — Site-to-Site L2",
			Definition: `# Two RouterOS sites bridged via EoIP tunnel — hosts share the same broadcast domain
name: eoip-tunnel
topology:
  nodes:
    site1:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: site1.rsc
    site2:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: site2.rsc
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 192.168.100.10/24 dev eth1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 192.168.100.20/24 dev eth1

  links:
    - endpoints: ["host1:eth1", "site1:eth1"]
    - endpoints: ["site1:eth2", "site2:eth2"]
    - endpoints: ["site2:eth1", "host2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "site1.rsc", NosKind: "mikrotik_ros", Content: `# site1 — EoIP tunnel endpoint, bridges local LAN with tunnel
# WAN address on ether3 (eth2 in clab)
/ip/address/add address=172.16.0.0/31 interface=ether3
# EoIP tunnel to site2 — tunnel-id must match on both ends
/interface/eoip/add name=eoip-tunnel1 remote-address=172.16.0.1 tunnel-id=100
# Bridge local LAN (ether2) with EoIP tunnel
/interface/bridge/add name=customer-bridge
/interface/bridge/port/add bridge=customer-bridge interface=ether2
/interface/bridge/port/add bridge=customer-bridge interface=eoip-tunnel1
`},
				{FilePath: "site2.rsc", NosKind: "mikrotik_ros", Content: `# site2 — EoIP tunnel endpoint, bridges local LAN with tunnel
# WAN address on ether3 (eth2 in clab)
/ip/address/add address=172.16.0.1/31 interface=ether3
# EoIP tunnel to site1 — tunnel-id must match on both ends
/interface/eoip/add name=eoip-tunnel1 remote-address=172.16.0.0 tunnel-id=100
# Bridge local LAN (ether2) with EoIP tunnel
/interface/bridge/add name=customer-bridge
/interface/bridge/port/add bridge=customer-bridge interface=ether2
/interface/bridge/port/add bridge=customer-bridge interface=eoip-tunnel1
`},
			},
		},
		{
			Name: "VXLAN Bridge — L2 Over L3 Underlay",
			Definition: `# Two RouterOS VTEPs bridge remote LANs over VXLAN with OSPF underlay
name: vxlan-bridge
topology:
  nodes:
    vtep1:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: vtep1.rsc
    vtep2:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: vtep2.rsc
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.100.0.10/24 dev eth1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.100.0.20/24 dev eth1

  links:
    - endpoints: ["host1:eth1", "vtep1:eth1"]
    - endpoints: ["vtep1:eth2", "vtep2:eth2"]
    - endpoints: ["vtep2:eth1", "host2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "vtep1.rsc", NosKind: "mikrotik_ros", Content: `# vtep1 — VXLAN VTEP with OSPF underlay
# Loopback for OSPF RID and VXLAN source
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.1/32 interface=loopback
# Underlay link to vtep2 (ether3 = eth2 in clab)
/ip/address/add address=172.16.0.0/31 interface=ether3
# OSPF underlay — loopback reachability for VXLAN endpoints
/routing/ospf/instance/add name=default router-id=10.255.0.1
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=backbone interfaces=ether3 type=ptp
# VXLAN interface — VNI 100, sourced from loopback
/interface/vxlan/add name=vxlan100 vni=100 port=4789 local-address=10.255.0.1
/interface/vxlan/vteps/add interface=vxlan100 remote-ip=10.255.0.2
# Customer bridge — physical access + VXLAN overlay
/interface/bridge/add name=customer-bridge
/interface/bridge/port/add bridge=customer-bridge interface=ether2
/interface/bridge/port/add bridge=customer-bridge interface=vxlan100
`},
				{FilePath: "vtep2.rsc", NosKind: "mikrotik_ros", Content: `# vtep2 — VXLAN VTEP with OSPF underlay
# Loopback for OSPF RID and VXLAN source
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.2/32 interface=loopback
# Underlay link to vtep1 (ether3 = eth2 in clab)
/ip/address/add address=172.16.0.1/31 interface=ether3
# OSPF underlay
/routing/ospf/instance/add name=default router-id=10.255.0.2
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=backbone interfaces=ether3 type=ptp
# VXLAN interface — same VNI 100, sourced from loopback
/interface/vxlan/add name=vxlan100 vni=100 port=4789 local-address=10.255.0.2
/interface/vxlan/vteps/add interface=vxlan100 remote-ip=10.255.0.1
# Customer bridge
/interface/bridge/add name=customer-bridge
/interface/bridge/port/add bridge=customer-bridge interface=ether2
/interface/bridge/port/add bridge=customer-bridge interface=vxlan100
`},
			},
		},
		{
			Name:  "SRL + FRR EVPN-VXLAN Bridge",
			Draft: true, // SRL EVPN-VXLAN config needs EVI + version-specific tuning
			Definition: `# SR Linux and FRR bridge remote LANs over EVPN-VXLAN with OSPF underlay + iBGP EVPN overlay
name: srl-frr-vxlan
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
      exec:
        - ip link add vxlan100 type vxlan id 100 local 10.255.0.2 dstport 4789 nolearning
        - ip link add br-cust type bridge
        - ip link set vxlan100 master br-cust
        - ip link set eth2 master br-cust
        - ip link set vxlan100 up
        - ip link set br-cust up
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.100.0.10/24 dev eth1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.100.0.20/24 dev eth1

  links:
    - endpoints: ["host1:eth1", "srl:e1-2"]
    - endpoints: ["srl:e1-1", "frr:eth1"]
    - endpoints: ["frr:eth2", "host2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "srl.cfg", NosKind: "srl", Content: `set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 172.16.0.0/31

set / interface ethernet-1/2 admin-state enable
set / interface ethernet-1/2 subinterface 0 type bridged

set / interface lo0 admin-state enable
set / interface lo0 subinterface 0 ipv4 admin-state enable
set / interface lo0 subinterface 0 ipv4 address 10.255.0.1/32

set / routing-policy policy all default-action policy-result accept

set / network-instance default type default
set / network-instance default router-id 10.255.0.1
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface lo0.0
set / network-instance default protocols ospf instance main admin-state enable
set / network-instance default protocols ospf instance main router-id 10.255.0.1
set / network-instance default protocols ospf instance main area 0.0.0.0 interface ethernet-1/1.0 interface-type point-to-point
set / network-instance default protocols ospf instance main area 0.0.0.0 interface lo0.0

set / tunnel-interface vxlan1 vxlan-interface 100 type bridged
set / tunnel-interface vxlan1 vxlan-interface 100 ingress vni 100
set / tunnel-interface vxlan1 vxlan-interface 100 egress source-ip use-system-ipv4-address

set / network-instance default protocols bgp autonomous-system 65000
set / network-instance default protocols bgp router-id 10.255.0.1
set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp afi-safi evpn admin-state enable
set / network-instance default protocols bgp group overlay export-policy [ all ]
set / network-instance default protocols bgp group overlay import-policy [ all ]
set / network-instance default protocols bgp group overlay afi-safi ipv4-unicast admin-state disable
set / network-instance default protocols bgp group overlay afi-safi evpn admin-state enable
set / network-instance default protocols bgp group overlay local-as as-number 65000
set / network-instance default protocols bgp group overlay peer-as 65000
set / network-instance default protocols bgp neighbor 10.255.0.2 peer-group overlay

set / network-instance vxlan-bridge type mac-vrf
set / network-instance vxlan-bridge interface ethernet-1/2.0
set / network-instance vxlan-bridge vxlan-interface vxlan1.100
set / network-instance vxlan-bridge protocols bgp-evpn bgp-instance 1 admin-state enable
set / network-instance vxlan-bridge protocols bgp-evpn bgp-instance 1 vxlan-interface vxlan1.100
`},
				{FilePath: "frr-daemons", NosKind: "frr", Content: `zebra=yes
bgpd=yes
ospfd=yes
`},
				{FilePath: "frr.conf", NosKind: "frr", Content: `hostname frr
!
interface lo
 ip address 10.255.0.2/32
 ip ospf area 0.0.0.0
!
interface eth1
 ip address 172.16.0.1/31
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.2
!
router bgp 65000
 bgp router-id 10.255.0.2
 no bgp ebgp-requires-policy
 neighbor 10.255.0.1 remote-as 65000
 neighbor 10.255.0.1 update-source lo
 !
 address-family l2vpn evpn
  neighbor 10.255.0.1 activate
  advertise-all-vni
 exit-address-family
!
`},
			},
		},
		{
			Name:  "SRL + RouterOS VXLAN Bridge",
			Draft: true, // SRL requires EVPN for VXLAN, RouterOS doesn't support EVPN
			Definition: `# SR Linux and RouterOS bridge remote LANs over static VXLAN with OSPF underlay
name: srl-ros-vxlan
topology:
  nodes:
    srl:
      kind: srl
      image: ghcr.io/vivek-dodia/mirror-srlinux:24.10.1
      startup-config: srl.cfg
    ros:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: ros.rsc
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.100.0.10/24 dev eth1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.100.0.20/24 dev eth1

  links:
    - endpoints: ["host1:eth1", "srl:e1-2"]
    - endpoints: ["srl:e1-1", "ros:eth2"]
    - endpoints: ["ros:eth1", "host2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "srl.cfg", NosKind: "srl", Content: `set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 172.16.0.0/31

set / interface ethernet-1/2 admin-state enable
set / interface ethernet-1/2 subinterface 0 type bridged

set / interface lo0 admin-state enable
set / interface lo0 subinterface 0 ipv4 admin-state enable
set / interface lo0 subinterface 0 ipv4 address 10.255.0.1/32

set / routing-policy policy all default-action policy-result accept

set / network-instance default type default
set / network-instance default router-id 10.255.0.1
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface lo0.0
set / network-instance default protocols ospf instance main admin-state enable
set / network-instance default protocols ospf instance main router-id 10.255.0.1
set / network-instance default protocols ospf instance main area 0.0.0.0 interface ethernet-1/1.0 interface-type point-to-point
set / network-instance default protocols ospf instance main area 0.0.0.0 interface lo0.0

set / tunnel-interface vxlan1 vxlan-interface 100 type bridged
set / tunnel-interface vxlan1 vxlan-interface 100 ingress vni 100
set / tunnel-interface vxlan1 vxlan-interface 100 egress source-ip use-system-ipv4-address

set / network-instance default protocols bgp autonomous-system 65000
set / network-instance default protocols bgp router-id 10.255.0.1
set / network-instance default protocols bgp afi-safi ipv4-unicast admin-state enable
set / network-instance default protocols bgp afi-safi evpn admin-state enable
set / network-instance default protocols bgp group overlay export-policy [ all ]
set / network-instance default protocols bgp group overlay import-policy [ all ]
set / network-instance default protocols bgp group overlay afi-safi ipv4-unicast admin-state disable
set / network-instance default protocols bgp group overlay afi-safi evpn admin-state enable
set / network-instance default protocols bgp group overlay local-as as-number 65000
set / network-instance default protocols bgp group overlay peer-as 65000
set / network-instance default protocols bgp neighbor 10.255.0.2 peer-group overlay

set / network-instance vxlan-bridge type mac-vrf
set / network-instance vxlan-bridge interface ethernet-1/2.0
set / network-instance vxlan-bridge vxlan-interface vxlan1.100
set / network-instance vxlan-bridge protocols bgp-evpn bgp-instance 1 admin-state enable
set / network-instance vxlan-bridge protocols bgp-evpn bgp-instance 1 vxlan-interface vxlan1.100
`},
				{FilePath: "ros.rsc", NosKind: "mikrotik_ros", Content: `# ros — VXLAN VTEP with OSPF underlay
# Loopback for OSPF RID and VXLAN source
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.2/32 interface=loopback
# Underlay link to SRL (ether3 = eth2 in clab)
/ip/address/add address=172.16.0.1/31 interface=ether3
# OSPF underlay — loopback reachability for VXLAN endpoints
/routing/ospf/instance/add name=default router-id=10.255.0.2
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=backbone interfaces=ether3 type=ptp
# VXLAN interface — VNI 100, sourced from loopback
/interface/vxlan/add name=vxlan100 vni=100 port=4789 local-address=10.255.0.2
/interface/vxlan/vteps/add interface=vxlan100 remote-ip=10.255.0.1
# Customer bridge — physical access + VXLAN overlay
/interface/bridge/add name=customer-bridge
/interface/bridge/port/add bridge=customer-bridge interface=ether2
/interface/bridge/port/add bridge=customer-bridge interface=vxlan100
`},
			},
		},
		{
			Name:  "SONiC + FRR VXLAN Bridge",
			Draft: true, // SONiC-vs VXLAN config_db.json needs validation
			Definition: `# SONiC-vs and FRR bridge remote LANs over static VXLAN with OSPF underlay
name: sonic-frr-vxlan
topology:
  nodes:
    sonic:
      kind: sonic-vs
      image: ghcr.io/vivek-dodia/mirror-sonic-vs:latest
      startup-config: sonic.json
      exec:
        - vtysh -c "configure terminal" -c "interface Loopback0" -c "ip ospf area 0.0.0.0" -c "exit" -c "interface Ethernet0" -c "ip ospf area 0.0.0.0" -c "ip ospf network point-to-point" -c "exit" -c "router ospf" -c "ospf router-id 10.255.0.1" -c "exit" -c "exit" -c "write memory"
    frr:
      kind: linux
      image: ghcr.io/vivek-dodia/mirror-frr:10.3.1
      binds:
        - frr-daemons:/etc/frr/daemons
        - frr.conf:/etc/frr/frr.conf
      exec:
        - ip link add vxlan100 type vxlan id 100 local 10.255.0.2 remote 10.255.0.1 dstport 4789
        - ip link add br-cust type bridge
        - ip link set vxlan100 master br-cust
        - ip link set eth2 master br-cust
        - ip link set vxlan100 up
        - ip link set br-cust up
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.100.0.10/24 dev eth1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.100.0.20/24 dev eth1

  links:
    - endpoints: ["host1:eth1", "sonic:eth2"]
    - endpoints: ["sonic:eth1", "frr:eth1"]
    - endpoints: ["frr:eth2", "host2:eth1"]
`,
			BindFiles: []BindFile{
				{FilePath: "sonic.json", NosKind: "sonic-vs", Content: sonicVxlanConfig()},
				{FilePath: "frr-daemons", NosKind: "frr", Content: `zebra=yes
ospfd=yes
`},
				{FilePath: "frr.conf", NosKind: "frr", Content: `hostname frr
!
interface lo
 ip address 10.255.0.2/32
 ip ospf area 0.0.0.0
!
interface eth1
 ip address 172.16.0.1/31
 ip ospf area 0.0.0.0
 ip ospf network point-to-point
!
router ospf
 ospf router-id 10.255.0.2
!
`},
			},
		},
		{
			Name:  "VPLS over MPLS — Multi-Site L2VPN",
			Draft: true, // 3 RouterOS VMs — needs >8GB RAM
			Definition: `# Three PE routers with MPLS/LDP backbone and VPLS bridging customer sites
name: vpls-mpls
topology:
  nodes:
    pe1:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: pe1.rsc
    pe2:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: pe2.rsc
    pe3:
      kind: mikrotik_ros
      image: ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8
      startup-config: pe3.rsc
    host1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.0.0.1/24 dev eth1
    host2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.0.0.2/24 dev eth1
    host3:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
      exec:
        - ip addr add 10.0.0.3/24 dev eth1

  links:
    - endpoints: ["host1:eth1", "pe1:eth1"]
    - endpoints: ["host2:eth1", "pe2:eth1"]
    - endpoints: ["host3:eth1", "pe3:eth1"]
    - endpoints: ["pe1:eth2", "pe2:eth2"]
    - endpoints: ["pe2:eth3", "pe3:eth3"]
    - endpoints: ["pe3:eth2", "pe1:eth3"]
`,
			BindFiles: []BindFile{
				{FilePath: "pe1.rsc", NosKind: "mikrotik_ros", Content: `# pe1 — MPLS/LDP PE with VPLS, OSPF backbone
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.1/32 interface=loopback
# Backbone interfaces (ether3=eth2 to pe2, ether4=eth3 to pe3)
/ip/address/add address=172.16.12.0/31 interface=ether3
/ip/address/add address=172.16.13.0/31 interface=ether4
# OSPF
/routing/ospf/instance/add name=default router-id=10.255.0.1
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4 type=ptp
# MPLS LDP
/mpls/ldp/add afi=ip lsr-id=10.255.0.1 transport-addresses=10.255.0.1
/mpls/ldp/interface/add interface=ether3
/mpls/ldp/interface/add interface=ether4
# VPLS tunnels
/interface/vpls/add name=vpls-to-pe2 remote-peer=10.255.0.2 vpls-id=100:0
/interface/vpls/add name=vpls-to-pe3 remote-peer=10.255.0.3 vpls-id=100:0
# Customer bridge with split-horizon on VPLS ports
/interface/bridge/add name=customer-vpls
/interface/bridge/port/add bridge=customer-vpls interface=ether2
/interface/bridge/port/add bridge=customer-vpls interface=vpls-to-pe2 horizon=1
/interface/bridge/port/add bridge=customer-vpls interface=vpls-to-pe3 horizon=1
`},
				{FilePath: "pe2.rsc", NosKind: "mikrotik_ros", Content: `# pe2 — MPLS/LDP PE with VPLS, OSPF backbone
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.2/32 interface=loopback
/ip/address/add address=172.16.12.1/31 interface=ether3
/ip/address/add address=172.16.23.0/31 interface=ether4
# OSPF
/routing/ospf/instance/add name=default router-id=10.255.0.2
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4 type=ptp
# MPLS LDP
/mpls/ldp/add afi=ip lsr-id=10.255.0.2 transport-addresses=10.255.0.2
/mpls/ldp/interface/add interface=ether3
/mpls/ldp/interface/add interface=ether4
# VPLS tunnels
/interface/vpls/add name=vpls-to-pe1 remote-peer=10.255.0.1 vpls-id=100:0
/interface/vpls/add name=vpls-to-pe3 remote-peer=10.255.0.3 vpls-id=100:0
# Customer bridge
/interface/bridge/add name=customer-vpls
/interface/bridge/port/add bridge=customer-vpls interface=ether2
/interface/bridge/port/add bridge=customer-vpls interface=vpls-to-pe1 horizon=1
/interface/bridge/port/add bridge=customer-vpls interface=vpls-to-pe3 horizon=1
`},
				{FilePath: "pe3.rsc", NosKind: "mikrotik_ros", Content: `# pe3 — MPLS/LDP PE with VPLS, OSPF backbone
/interface/bridge/add name=loopback
/ip/address/add address=10.255.0.3/32 interface=loopback
/ip/address/add address=172.16.13.1/31 interface=ether3
/ip/address/add address=172.16.23.1/31 interface=ether4
# OSPF
/routing/ospf/instance/add name=default router-id=10.255.0.3
/routing/ospf/area/add name=backbone instance=default area-id=0.0.0.0
/routing/ospf/interface-template/add area=backbone interfaces=loopback
/routing/ospf/interface-template/add area=backbone interfaces=ether3,ether4 type=ptp
# MPLS LDP
/mpls/ldp/add afi=ip lsr-id=10.255.0.3 transport-addresses=10.255.0.3
/mpls/ldp/interface/add interface=ether3
/mpls/ldp/interface/add interface=ether4
# VPLS tunnels
/interface/vpls/add name=vpls-to-pe1 remote-peer=10.255.0.1 vpls-id=100:0
/interface/vpls/add name=vpls-to-pe2 remote-peer=10.255.0.2 vpls-id=100:0
# Customer bridge
/interface/bridge/add name=customer-vpls
/interface/bridge/port/add bridge=customer-vpls interface=ether2
/interface/bridge/port/add bridge=customer-vpls interface=vpls-to-pe1 horizon=1
/interface/bridge/port/add bridge=customer-vpls interface=vpls-to-pe2 horizon=1
`},
			},
		},
	},
}
