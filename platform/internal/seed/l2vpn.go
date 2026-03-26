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
